import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

let cachedSecret: Uint8Array | null = null;

/**
 * Resolved lazily (NOT at module scope) so that `next build` page-data
 * collection never throws on machines without env vars. The production
 * guard still fires on first real use at runtime.
 */
function getSessionSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET environment variable is required in production"
      );
    }
    console.warn(
      "SESSION_SECRET not set — using insecure dev fallback. Do not use in production."
    );
    cachedSecret = new TextEncoder().encode(
      "fallback-dev-secret-do-not-use-in-prod"
    );
    return cachedSecret;
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}
const COOKIE_NAME = "ahmed_site_session";
const MAX_AGE = 60 * 60 * 24; // 24 hours

export interface SessionPayload {
  authenticated: true;
  iat: number;
  exp: number;
}

export async function createSessionToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ authenticated: true as const })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + MAX_AGE)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (payload.authenticated) {
      return payload as unknown as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.error("ADMIN_PASSWORD_HASH not set");
    return false;
  }
  return bcrypt.compare(password, hash);
}
