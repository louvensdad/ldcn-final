import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Fase 13 (IA e Providers): provider API keys are the one genuinely sensitive thing this UI
 * touches, so they're encrypted at rest with a real cipher, not just masked client-side.
 * LDCN_CREDENTIAL_ENCRYPTION_KEY must be set — there's no insecure default to fall back to, on
 * purpose. scrypt derives a proper 32-byte AES key from whatever secret is configured, the same
 * way you'd derive a key from a passphrase.
 */
function resolveKey(): Buffer {
  const secret = process.env.LDCN_CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('LDCN_CREDENTIAL_ENCRYPTION_KEY is not configured — cannot store or read provider credentials.');
  }
  return scryptSync(secret, 'ldcn-provider-credential-v1', 32);
}

/** iv + authTag + ciphertext, concatenated and base64-encoded — one opaque string per row. */
export function encryptCredential(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptCredential(encoded: string): string {
  const key = resolveKey();
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** The only form of the key that's ever allowed to leave the server. */
export function maskCredential(plaintext: string): string {
  if (plaintext.length <= 8) return '••••••••';
  return `${plaintext.slice(0, 4)}${'•'.repeat(8)}${plaintext.slice(-3)}`;
}
