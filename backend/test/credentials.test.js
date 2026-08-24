import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AI_CREDENTIAL_ENCRYPTION_KEY = "unit-test-key-that-is-long-enough-1234";

const { encryptApiKey, decryptApiKey } = await import("../src/lib/ai/credentials.ts");

test("encrypt -> decrypt round-trips the provider key exactly", () => {
  const key = "sk-or-v1-abcdef0123456789abcdef";
  const sealed = encryptApiKey(key);
  assert.notEqual(sealed.encryptedApiKey, key);
  assert.equal(decryptApiKey(sealed), key);
});

test("every seal uses a fresh nonce and a 4-char hint", () => {
  const a = encryptApiKey("same-key-value");
  const b = encryptApiKey("same-key-value");
  assert.notEqual(a.encryptionIv, b.encryptionIv); // unique nonces
  assert.notEqual(a.encryptedApiKey, b.encryptedApiKey);
  assert.equal(a.keyHint, "ends in alue");
});

test("a tampered ciphertext fails authentication instead of returning junk", () => {
  const sealed = encryptApiKey("another-provider-key-99");
  const raw = Buffer.from(sealed.encryptedApiKey, "base64");
  raw[raw.length - 1] ^= 0xff; // flip one bit
  const tampered = { ...sealed, encryptedApiKey: raw.toString("base64") };
  assert.throws(() => decryptApiKey(tampered));
});
