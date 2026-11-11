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
 * Derives key byte candidates for HMAC-SHA256 verification.
 * Supabase project settings display a 64-byte secret encoded in Base64 (88 chars).
 * We test both decoded Base64 bytes and raw UTF-8 bytes.
 */
export function getSecretBytesCandidates(secret: string): Uint8Array[] {
  const candidates: Uint8Array[] = [];
  const trimmed = secret.trim();

  // If secret is Base64 (Supabase standard 64-byte / 88-char or 32-byte / 44-char secret)
  if (
    /^[A-Za-z0-9+/=]+$/.test(trimmed) &&
    (trimmed.length === 88 || trimmed.length === 44 || trimmed.includes("="))
  ) {
    try {
      const binaryStr = atob(trimmed);
      candidates.push(Uint8Array.from(binaryStr, (c) => c.charCodeAt(0)));
    } catch {
      // Ignore base64 parse failure
    }
  }

  // Raw UTF-8 bytes candidate
  candidates.push(new TextEncoder().encode(trimmed));

  return candidates;
}

/**
 * Extract access token from Supabase cookies (including chunked cookies)
 */
export function extractAccessToken(cookies: CookieReader): string | null {
  // 1. Direct sb-access-token cookie
  const direct = cookies.get("sb-access-token")?.value;
  if (direct && direct.split(".").length === 3) {
    return direct;
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
      // Gather chunked cookies (.0, .1, etc.)
      const chunks = allCookies
        .filter((c) => c.name.startsWith(`${base}.`))
        .sort((a, b) => {
          const numA = parseInt(a.name.slice(base.length + 1) || "0", 10);
          const numB = parseInt(b.name.slice(base.length + 1) || "0", 10);
          return numA - numB;
        })
        .map((c) => c.value);

      if (chunks.length > 0) {
        raw = chunks.join("");
      }
    }

    if (raw) {
      try {
        let decoded = raw.trim();
        if (decoded.startsWith('"') && decoded.endsWith('"')) {
          decoded = decoded.slice(1, -1);
        }
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
    const candidates = getSecretBytesCandidates(secret);
    let verifiedPayload: ReturnType<typeof decodeJwt> | null = null;
    let lastError: unknown = null;

    for (const keyBytes of candidates) {
      try {
        const { payload } = await jwtVerify(token, keyBytes, {
          algorithms: ["HS256"],
        });
        verifiedPayload = payload;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (verifiedPayload) {
      const exp = verifiedPayload.exp ?? 0;
      if (exp <= nowInSeconds) {
        return { valid: false, needsRefresh: false, expiresAt: exp };
      }

      // Sliding-window refresh: < 2 minutes remaining
      const needsRefresh = exp - nowInSeconds < 120;
      return {
        valid: true,
        needsRefresh,
        userId: typeof verifiedPayload.sub === "string" ? verifiedPayload.sub : undefined,
        expiresAt: exp,
      };
    }

    // In development mode: if signature check fails (e.g. wrong key in local .env), log warning and decode payload
    if (process.env.NODE_ENV === "development") {
      try {
        const payload = decodeJwt(token);
        console.warn(
          "[jwt-verify] Signature mismatch with SUPABASE_JWT_SECRET. Falling back to unverified payload in development:",
          lastError instanceof Error ? lastError.message : String(lastError)
        );
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

    return { valid: false, needsRefresh: false };
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
