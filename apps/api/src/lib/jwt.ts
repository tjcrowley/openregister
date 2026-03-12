import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export interface DeviceTokenPayload {
  sub: string; // deviceId
  merchantId: string;
  locationId: string;
  iat: number;
  exp: number;
}

// Cache imported keys to avoid re-parsing on every request
let _privateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;
let _publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

async function getPrivateKey() {
  if (_privateKey) return _privateKey;
  const keyPem = config.JWT_PRIVATE_KEY;
  if (!keyPem) throw new Error('JWT_PRIVATE_KEY not configured');
  _privateKey = await importPKCS8(keyPem, 'RS256');
  return _privateKey;
}

async function getPublicKey() {
  if (_publicKey) return _publicKey;
  const keyPem = config.JWT_PUBLIC_KEY;
  if (!keyPem) throw new Error('JWT_PUBLIC_KEY not configured');
  _publicKey = await importSPKI(keyPem, 'RS256');
  return _publicKey;
}

export async function signDeviceToken(payload: {
  deviceId: string;
  merchantId: string;
  locationId: string;
}): Promise<string> {
  const privateKey = await getPrivateKey();
  return new SignJWT({
    merchantId: payload.merchantId,
    locationId: payload.locationId,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(payload.deviceId)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(privateKey);
}

export async function verifyDeviceToken(token: string): Promise<DeviceTokenPayload> {
  const publicKey = await getPublicKey();
  const { payload } = await jwtVerify(token, publicKey, { algorithms: ['RS256'] });
  return payload as unknown as DeviceTokenPayload;
}

/** Sign a short-lived admin token using HMAC-SHA256 with the admin secret. */
export function signAdminToken(payload: {
  userId: string;
  email: string;
  role: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 * 8,
    })
  ).toString('base64url');
  const sig = createHmac('sha256', config.JWT_ADMIN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

/** Verify an admin token. Throws on invalid signature or expiry. */
export function verifyAdminToken(token: string): { userId: string; email: string; role: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [header, body, sig] = parts;
  const expectedSig = createHmac('sha256', config.JWT_ADMIN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig, 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid token signature');
  }
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
    userId: string;
    email: string;
    role: string;
    exp: number;
  };
  if (parsed.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return { userId: parsed.userId, email: parsed.email, role: parsed.role };
}
