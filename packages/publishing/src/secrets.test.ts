import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { encryptKey, decryptKey, hashPassword, verifyPassword } from "./secrets";

test("AEAD authenticates ciphertext, purpose and version, with fresh nonce", () => {
  const env = { CONFIG_MASTER_KEY: randomBytes(32).toString("base64"), CONFIG_KEY_VERSION: "1" };
  const a = encryptKey("fixture-secret", "chat", env),
    b = encryptKey("fixture-secret", "chat", env);
  assert.notEqual(a.nonce, b.nonce);
  assert.equal(decryptKey(a, "chat", env), "fixture-secret");
  assert.ok(!JSON.stringify(a).includes("fixture-secret"));
  assert.throws(() =>
    decryptKey({ ...a, ciphertext: Buffer.from("tampered").toString("base64") }, "chat", env),
  );
  assert.throws(() => decryptKey(a, "embedding", env));
  assert.throws(() => decryptKey(a, "chat", { ...env, CONFIG_KEY_VERSION: "2" }));
});
test("scrypt salts passwords and validates without plaintext storage", async () => {
  const password = "fixture-password-only";
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(!a.includes(password));
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong", a), false);
});
