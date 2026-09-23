/**
 * JWT auth — payload shape and JWT_SECRET stay identical to
 * sales-portal-next/src/lib/auth.ts (a token minted by either app's login is
 * still valid in both, and either app can independently verify the other's
 * token). The TRANSPORT differs here: this app carries the token in an
 * httpOnly/Secure/SameSite=Lax cookie rather than a header, so update
 * sales-portal-next separately if it should also move off Authorization
 * headers -- this file only controls testing-portal's own cookie.
 */
import jwt from "jsonwebtoken";

const JWT_ALGORITHM = "HS256" as const;
const JWT_EXPIRY_SECONDS = 60 * 60 * 12; // 12 hours

export const AUTH_COOKIE_NAME = "auth_token";

/** Passed to NextResponse.cookies.set(...) on login, and reused (with
 * maxAge: 0) to clear the cookie on logout -- Set-Cookie deletion only takes
 * effect in every browser when the attributes match the cookie that was set. */
export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: JWT_EXPIRY_SECONDS,
  };
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
}

/** Reads the auth cookie straight off the Cookie request header rather than
 * via next/headers' cookies() -- keeps decodeToken a plain sync function of
 * `req: Request`, matching every route handler's existing call shape. */
function readAuthCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === AUTH_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export interface TokenClaims {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AuthError";
  }
}

export interface TokenUser {
  id: string;
  email: string;
  role: string | null;
}

export function createToken(user: TokenUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    email: user.email,
    role: user.role ?? "testing",
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };
  return jwt.sign(payload, getSecret(), { algorithm: JWT_ALGORITHM });
}

export function decodeToken(req: Request): TokenClaims {
  const token = readAuthCookie(req);
  if (!token) {
    throw new AuthError("Not authenticated", 401);
  }
  try {
    return jwt.verify(token, getSecret(), {
      algorithms: [JWT_ALGORITHM],
    }) as TokenClaims;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError("Token expired", 401);
    }
    throw new AuthError("Invalid token", 401);
  }
}

export function requireAdmin(req: Request): TokenClaims {
  const claims = decodeToken(req);
  if (claims.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
  return claims;
}
