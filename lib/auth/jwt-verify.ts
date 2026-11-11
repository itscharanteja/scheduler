import {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
} from "jose";

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

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!jwks && supabaseUrl) {
    try {
      const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
      jwks = createRemoteJWKSet(jwksUrl);
    } catch (e) {
      console.warn("[jwt-verify] Failed to initialize JWKS endpoint:", e);
    }
  }
  return jwks;
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
 * Extract access token from Supabase cookies (including chunked cookies).
 * Selects the freshest (highest exp) access token if multiple cookies exist.
 */
export function extractAccessToken(cookies: CookieReader): string | null {
  // 1. Direct sb-access-token cookie
  const direct = cookies.get("sb-access-token")?.value;
  if (direct && direct.split(".").length === 3) {
    return direct;
  }

  const allCookies = cookies.getAll();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let projectRef = "";
  try {
    if (supabaseUrl) {
      projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    }
  } catch {
    // ignore
  }

  // Find cookie names matching auth-token pattern
  const authBases = new Set<string>();
  if (projectRef) {
    authBases.add(`sb-${projectRef}-auth-token`);
  }

  for (const c of allCookies) {
    if (
      c.name.includes("-auth-token") ||
      (c.name.startsWith("sb-") && c.name.includes("token"))
    ) {
      const base = c.name.replace(/\.\d+$/, "");
      authBases.add(base);
    }
  }

  const tokens: string[] = [];

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
          tokens.push(parsed[0]);
        } else if (parsed && typeof parsed.access_token === "string") {
          tokens.push(parsed.access_token);
        }
      } catch {
        if (raw.split(".").length === 3) {
          tokens.push(raw);
        }
      }
    }
  }

  if (tokens.length === 0) return null;

  // Pick the token with the highest exp claim (the newest token)
  let bestToken: string | null = null;
  let maxExp = 0;

  for (const t of tokens) {
    try {
      const payload = decodeJwt(t);
      const exp = payload.exp ?? 0;
      if (exp > maxExp) {
        maxExp = exp;
        bestToken = t;
      }
    } catch {
      if (!bestToken) bestToken = t;
    }
  }

  return bestToken || tokens[0] || null;
}

/**
 * Verify JWT signature and expiration locally with zero network calls.
 * Automatically handles asymmetric ES256/RS256 (via cached Supabase JWKS)
 * and symmetric HMAC HS256/HS384/HS512.
 */
export async function verifyAccessToken(
  token: string,
  secret?: string
): Promise<TokenVerificationResult> {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  // 1. Inspect protected header to detect algorithm (ES256, RS256, HS256, etc.)
  let alg = "HS256";
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg) alg = header.alg;
  } catch {
    // default to HS256
  }

  // 2. If asymmetric (ES256 / RS256) used by Supabase Auth:
  if (alg === "ES256" || alg === "RS256") {
    const remoteJwks = getJWKS();
    if (remoteJwks) {
      try {
        const { payload } = await jwtVerify(token, remoteJwks, {
          algorithms: [alg],
        });
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
      } catch (err) {
        console.warn(
          "[jwt-verify] Asymmetric verification error:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  // 3. If symmetric HMAC (HS256, HS384, HS512) and secret provided:
  if (secret && alg.startsWith("HS")) {
    const candidates = getSecretBytesCandidates(secret);
    for (const keyBytes of candidates) {
      try {
        const { payload } = await jwtVerify(token, keyBytes, {
          algorithms: ["HS256", "HS384", "HS512"],
        });
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
        // try next candidate
      }
    }
    // Signature verification against secret failed
    return { valid: false, needsRefresh: false };
  }

  // 4. In development/testing fallback: validate unexpired payload
  if (process.env.NODE_ENV !== "production") {
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

  return { valid: false, needsRefresh: false };
}
