/**
 * JWT auth — identical to sales-portal-next/src/lib/auth.ts. Same JWT_SECRET
 * and payload shape, so a token minted by either app's login is valid in both.
 */
import jwt from "jsonwebtoken";

const JWT_ALGORITHM = "HS256" as const;
const JWT_EXPIRY_SECONDS = 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
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
    role: user.role ?? "user",
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };
  return jwt.sign(payload, getSecret(), { algorithm: JWT_ALGORITHM });
}

export function decodeToken(req: Request): TokenClaims {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", 401);
  }
  const token = header.slice("Bearer ".length);
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
