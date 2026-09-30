import { Pool } from "pg";
// Run only as an explicit deployment step with the PostgreSQL bootstrap administrator.
const env = process.env;
const names = [
  env.POSTGRES_DB,
  env.POSTGRES_USER,
  env.BLOG_DB_USER,
  env.MEDIA_DB_NAME,
  env.MEDIA_DB_USER,
];
if (names.some((name) => !name || !/^[a-z][a-z0-9_]{0,62}$/.test(name)))
  throw new Error("Database identifiers invalid");
const [blog, admin, blogUser, media, mediaUser] = names as string[];
if (blog === media || new Set([admin, blogUser, mediaUser]).size !== 3)
  throw new Error("Database roles must be separate");
const pool = new Pool({
  host: env.PGHOST ?? "db",
  port: Number(env.PGPORT ?? 5432),
  user: admin,
  password: env.POSTGRES_PASSWORD,
  database: blog,
});
const client = await pool.connect();
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
try {
  await client.query("SELECT pg_advisory_lock(711117)");
  for (const [role, password] of [
    [blogUser, env.BLOG_DB_PASSWORD],
    [mediaUser, env.MEDIA_DB_PASSWORD],
  ]) {
    if (!password || password.length < 20) throw new Error("Password configuration missing");
    const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]);
    if (!exists.rowCount)
      await client.query(
        `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${quote(password)}`,
      );
    // Existing passwords are never changed. A login check below catches mismatched configuration.
    const privileged = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname=$1 AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)",
      [role],
    );
    const memberships = await client.query(
      "SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1",
      [role],
    );
    if (privileged.rowCount || memberships.rowCount)
      throw new Error("Runtime role has excessive privileges");
  }
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [media])).rowCount)
    await client.query(`CREATE DATABASE "${media}" OWNER "${mediaUser}"`);
  await client.query(`REVOKE CONNECT ON DATABASE "${media}" FROM PUBLIC`);
  await client.query(`GRANT CONNECT ON DATABASE "${media}" TO "${mediaUser}"`);
  await client.query(`REVOKE CONNECT ON DATABASE "${blog}" FROM PUBLIC`);
  await client.query(`GRANT CONNECT ON DATABASE "${blog}" TO "${blogUser}"`);
  await client.query(`GRANT USAGE ON SCHEMA public TO "${blogUser}"`);
  await client.query(
    `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${blogUser}"`,
  );
  await client.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${blogUser}"`);
  await client.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE "${admin}" IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO "${blogUser}"`,
  );
  for (const [database, user, password] of [
    [blog, blogUser, env.BLOG_DB_PASSWORD],
    [media, mediaUser, env.MEDIA_DB_PASSWORD],
  ]) {
    const check = new Pool({
      host: env.PGHOST ?? "db",
      port: Number(env.PGPORT ?? 5432),
      database,
      user,
      password,
      connectionTimeoutMillis: 5000,
    });
    try {
      await check.query("SELECT 1");
    } finally {
      await check.end();
    }
  }
  console.info("Database roles ready; existing credentials preserved");
} catch {
  console.error(
    "Database initialization failed; verify role ownership and configured credentials (existing passwords were not changed)",
  );
  process.exitCode = 1;
} finally {
  await client.query("SELECT pg_advisory_unlock(711117)");
  client.release();
  await pool.end();
}
