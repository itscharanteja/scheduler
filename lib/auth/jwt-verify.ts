import { decodeJwt, jwtVerify } from "jose";

export interface TokenVerificationResult {
  valid: boolean;
  needsRefresh: boolean;
  userId?: string;
  expiresAt?: number;
}

export interface CookieReader {
  getAll: () => { name: string; value: string }[];
  get: (name: string) => { value: string } | undefined;
}

/**
 * Decode base64url string in standards-compliant Web environment
 */
export function decodeBase64URL(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binaryStr = atob(b64 + pad);
  const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Extract access token from Supabase cookies (including chunked cookies)
 */
export function extractAccessToken(cookies: CookieReader): string | null {
  // 1. Direct sb-access-token cookie
  const direct = cookies.get("sb-access-token")?.value;
  if (direct) {
    if (direct.split(".").length === 3) return direct;
  }

  const allCookies = cookies.getAll();

  // Find cookie names matching auth-token pattern
  const authBases = new Set<string>();
  for (const c of allCookies) {
    if (
      c.name.includes("-auth-token") ||
      (c.name.startsWith("sb-") && c.name.includes("token"))
    ) {
      const base = c.name.replace(/\.\d+$/, "");
      authBases.add(base);
    }
  }

  for (const base of authBases) {
    let raw = cookies.get(base)?.value;
    if (!raw) {
      const chunks: string[] = [];
      for (let i = 0; ; i++) {
        const chunk = cookies.get(`${base}.${i}`)?.value;
        if (!chunk) break;
        chunks.push(chunk);
      }
      if (chunks.length > 0) {
        raw = chunks.join("");
      }
    }

    if (raw) {
      try {
        let decoded = raw;
        if (decoded.startsWith("base64-")) {
          decoded = decodeBase64URL(decoded.slice(7));
        } else if (
          decoded.startsWith("%") ||
          decoded.includes("%22") ||
          decoded.includes("%5B")
        ) {
          decoded = decodeURIComponent(decoded);
        }

        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed) && typeof parsed[0] === "string") {
          return parsed[0];
        }
        if (parsed && typeof parsed.access_token === "string") {
          return parsed.access_token;
        }
      } catch {
        // Fallback: raw JWT if string has 3 dot-separated parts
        if (raw.split(".").length === 3) {
          return raw;
        }
      }
    }
  }

  return null;
}

/**
 * Verify JWT signature and expiration locally with zero network calls
 */
export async function verifyAccessToken(
  token: string,
  secret?: string
): Promise<TokenVerificationResult> {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (secret) {
    try {
      const secretBytes = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, secretBytes, {
        algorithms: ["HS256"],
      });

      const exp = payload.exp ?? 0;
      if (exp <= nowInSeconds) {
        return { valid: false, needsRefresh: false, expiresAt: exp };
      }

      // Sliding-window refresh: < 2 minutes remaining
      const needsRefresh = exp - nowInSeconds < 120;
      return {
        valid: true,
        needsRefresh,
        userId: typeof payload.sub === "string" ? payload.sub : undefined,
        expiresAt: exp,
      };
    } catch {
      return { valid: false, needsRefresh: false };
    }
  } else {
    // Development fallback when SUPABASE_JWT_SECRET is not configured
    try {
      const payload = decodeJwt(token);
      const exp = payload.exp ?? 0;
      if (exp <= nowInSeconds) {
        return { valid: false, needsRefresh: false, expiresAt: exp };
      }

      const needsRefresh = exp - nowInSeconds < 120;
      return {
        valid: true,
        needsRefresh,
        userId: typeof payload.sub === "string" ? payload.sub : undefined,
        expiresAt: exp,
      };
    } catch {
      return { valid: false, needsRefresh: false };
    }
  }
}
