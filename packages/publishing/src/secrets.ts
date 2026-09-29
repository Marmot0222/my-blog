import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";

export type KeyEnvelope = { version: string; nonce: string; tag: string; ciphertext: string };
export class SecretUnavailable extends Error {
  constructor() {
    super("秘密配置不可用，请检查服务器主密钥");
  }
}
function master(env: NodeJS.ProcessEnv) {
  const key = Buffer.from(env.CONFIG_MASTER_KEY ?? "", "base64");
  if (
    key.length !== 32 ||
    !env.CONFIG_KEY_VERSION ||
    env.CONFIG_MASTER_KEY === env.ADMIN_SESSION_SECRET
  )
    throw new SecretUnavailable();
  return { key, version: env.CONFIG_KEY_VERSION };
}
export function encryptKey(
  value: string,
  purpose: string,
  env: NodeJS.ProcessEnv = process.env,
): KeyEnvelope {
  const { key, version } = master(env);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(`${version}:${purpose}`));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    version,
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}
export function decryptKey(
  envelope: KeyEnvelope,
  purpose: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  try {
    const { key, version } = master(env);
    if (envelope.version !== version) throw new SecretUnavailable();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64"));
    decipher.setAAD(Buffer.from(`${version}:${purpose}`));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SecretUnavailable();
  }
}
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256)
    throw new Error("管理员密码长度须为 12–256 字符");
  const salt = randomBytes(32);
  return `scrypt-v1:${salt.toString("hex")}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length > 256) return false;
  const [version, salt, hash] = stored.split(":");
  if (
    version !== "scrypt-v1" ||
    !/^[a-f0-9]{64}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(hash ?? "")
  )
    return false;
  return timingSafeEqual(
    await derive(password, Buffer.from(salt, "hex")),
    Buffer.from(hash, "hex"),
  );
}
export function sessionHash(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}
