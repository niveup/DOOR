import { test } from "node:test";
import assert from "node:assert/strict";
import { isPasscodeConfigured, verifySharedSecret } from "../src/lib/auth.ts";

test("verifySharedSecret accepts the correct passcode", () => {
  assert.equal(verifySharedSecret("correct-passcode", "correct-passcode"), true);
});

test("verifySharedSecret rejects a wrong passcode", () => {
  assert.equal(verifySharedSecret("wrong-passcode", "correct-passcode"), false);
});

test("verifySharedSecret rejects an empty received value", () => {
  assert.equal(verifySharedSecret("", "correct-passcode"), false);
});

test("isPasscodeConfigured rejects missing, short, and non-string values", () => {
  assert.equal(isPasscodeConfigured(undefined), false);
  assert.equal(isPasscodeConfigured(""), false);
  assert.equal(isPasscodeConfigured("short"), false); // < 8 chars
  assert.equal(isPasscodeConfigured(12345678), false);
});

test("isPasscodeConfigured accepts an 8+ character string", () => {
  assert.equal(isPasscodeConfigured("long-enough"), true);
});
