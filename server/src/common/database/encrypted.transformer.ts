import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';
import { ValueTransformer } from 'typeorm';
import { env } from '../../config/env';

/**
 * Column-level encryption for PII at rest (PRODUCT_PLAN.md §8): passport number,
 * every financial figure, sponsor financials, and the whole visa-history table.
 *
 * AES-256-GCM.  Stored form: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.  The key
 * is PII_ENC_KEY (hex or base64, 32 bytes) hashed to a fixed 32 bytes so a
 * short dev key still works.
 */
function key(): Buffer {
  const raw = env.piiEncKey;
  const buf = /^[0-9a-fA-F]+$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : createHash('sha256').update(raw).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(stored: string): string {
  const [ver, ivB64, tagB64, dataB64] = stored.split(':');
  if (ver !== 'v1') return stored; // not encrypted (legacy / plain seed)
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

class EncryptedString implements ValueTransformer {
  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    return encrypt(String(value));
  }
  from(value: string | null): string | null {
    if (value === null || value === undefined) return null;
    try {
      return decrypt(value);
    } catch {
      return null;
    }
  }
}

class EncryptedNumber implements ValueTransformer {
  to(value: number | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return encrypt(String(value));
  }
  from(value: string | null): number | null {
    if (value === null || value === undefined) return null;
    try {
      const n = Number(decrypt(value));
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
}

class EncryptedJson implements ValueTransformer {
  to(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return encrypt(JSON.stringify(value));
  }
  from(value: string | null): unknown {
    if (value === null || value === undefined) return null;
    try {
      return JSON.parse(decrypt(value));
    } catch {
      return null;
    }
  }
}

export const encryptedString = new EncryptedString();
export const encryptedNumber = new EncryptedNumber();
export const encryptedJson = new EncryptedJson();
