import crypto from "crypto";

export interface EncryptedCredential {
  encryptedApiKey: string;
  encryptionIv: string;
  authTag: string;
  keyHint: string;
}

function encryptionKey(): Buffer {
  const secret = process.env.AI_CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AI credential encryption requires AI_CREDENTIAL_ENCRYPTION_KEY or a strong SESSION_SECRET.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApiKey(apiKey: string): EncryptedCredential {
  const normalizedKey = apiKey.trim();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalizedKey, "utf8"), cipher.final()]);

  return {
    encryptedApiKey: encrypted.toString("base64"),
    encryptionIv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyHint: normalizedKey.length > 4 ? `ends in ${normalizedKey.slice(-4)}` : "saved",
  };
}

export function decryptApiKey(credential: {
  encryptedApiKey: string;
  encryptionIv: string;
  authTag: string;
}): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(credential.encryptionIv, "base64")
  );
  decipher.setAuthTag(Buffer.from(credential.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(credential.encryptedApiKey, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
