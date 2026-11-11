import test from "node:test";
import assert from "node:assert";
import { SignJWT } from "jose";
import {
  extractAccessToken,
  verifyAccessToken,
  decodeBase64URL,
} from "../../lib/auth/jwt-verify.ts";

const TEST_SECRET = "super-secret-jwt-key-minimum-32-chars-long!";

test("decodeBase64URL properly decodes URL-safe base64 strings", () => {
  const original = '["token_part_1","token_part_2"]';
  const encoded = Buffer.from(original).toString("base64url");
  const decoded = decodeBase64URL(encoded);
  assert.strictEqual(decoded, original);
});

test("extractAccessToken extracts from direct sb-access-token cookie", () => {
  const fakeJwt = "header.payload.signature";
  const reader = {
    getAll: () => [{ name: "sb-access-token", value: fakeJwt }],
    get: (name: string) => (name === "sb-access-token" ? { value: fakeJwt } : undefined),
  };

  const extracted = extractAccessToken(reader);
  assert.strictEqual(extracted, fakeJwt);
});

test("extractAccessToken extracts from JSON array format in sb-project-auth-token", () => {
  const fakeJwt = "jwt.access.token";
  const jsonArray = JSON.stringify([fakeJwt, "refresh-token-xyz"]);
  const reader = {
    getAll: () => [{ name: "sb-mockproject-auth-token", value: jsonArray }],
    get: (name: string) => (name === "sb-mockproject-auth-token" ? { value: jsonArray } : undefined),
  };

  const extracted = extractAccessToken(reader);
  assert.strictEqual(extracted, fakeJwt);
});

test("extractAccessToken extracts from base64-encoded cookie", () => {
  const fakeJwt = "jwt.access.base64";
  const rawJson = JSON.stringify([fakeJwt, "refresh-token"]);
  const encoded = "base64-" + Buffer.from(rawJson).toString("base64url");

  const reader = {
    getAll: () => [{ name: "sb-mockproject-auth-token", value: encoded }],
    get: (name: string) => (name === "sb-mockproject-auth-token" ? { value: encoded } : undefined),
  };

  const extracted = extractAccessToken(reader);
  assert.strictEqual(extracted, fakeJwt);
});

test("extractAccessToken reconstructs chunked cookies (.0, .1)", () => {
  const fakeJwt = "jwt.part1.part2.part3";
  const rawJson = JSON.stringify([fakeJwt, "refresh-token"]);
  const half = Math.floor(rawJson.length / 2);
  const chunk0 = rawJson.slice(0, half);
  const chunk1 = rawJson.slice(half);

  const reader = {
    getAll: () => [
      { name: "sb-chunked-auth-token.0", value: chunk0 },
      { name: "sb-chunked-auth-token.1", value: chunk1 },
    ],
    get: (name: string) => {
      if (name === "sb-chunked-auth-token.0") return { value: chunk0 };
      if (name === "sb-chunked-auth-token.1") return { value: chunk1 };
      return undefined;
    },
  };

  const extracted = extractAccessToken(reader);
  assert.strictEqual(extracted, fakeJwt);
});

test("verifyAccessToken validates signature using HMAC-SHA256", async () => {
  const secretKey = new TextEncoder().encode(TEST_SECRET);
  const token = await new SignJWT({ sub: "user-abc-123", role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secretKey);

  const result = await verifyAccessToken(token, TEST_SECRET);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.userId, "user-abc-123");
  assert.strictEqual(result.needsRefresh, false);
});

test("verifyAccessToken validates signature with 64-byte Base64-encoded Supabase secret", async () => {
  const rawBytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) rawBytes[i] = (i * 7) % 256;
  const b64Secret = Buffer.from(rawBytes).toString("base64");

  const token = await new SignJWT({ sub: "supabase-user-789" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(rawBytes);

  const result = await verifyAccessToken(token, b64Secret);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.userId, "supabase-user-789");
});

test("verifyAccessToken validates ES256 asymmetric token in development fallback", async () => {
  const { generateKeyPair } = await import("jose");
  const { privateKey } = await generateKeyPair("ES256");
  const token = await new SignJWT({ sub: "es256-user-456" })
    .setProtectedHeader({ alg: "ES256" })
    .setExpirationTime("1h")
    .sign(privateKey);

  const result = await verifyAccessToken(token);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.userId, "es256-user-456");
});

test("verifyAccessToken rejects invalid / tampered signature", async () => {
  const secretKey = new TextEncoder().encode(TEST_SECRET);
  const token = await new SignJWT({ sub: "user-abc-123" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secretKey);

  // Verify with wrong secret
  const wrongResult = await verifyAccessToken(token, "wrong-secret-key-32-chars-minimum!!");
  assert.strictEqual(wrongResult.valid, false);

  // Verify with tampered token
  const tampered = token.slice(0, -5) + "abcde";
  const tamperedResult = await verifyAccessToken(tampered, TEST_SECRET);
  assert.strictEqual(tamperedResult.valid, false);
});

test("verifyAccessToken rejects expired tokens", async () => {
  const secretKey = new TextEncoder().encode(TEST_SECRET);
  const expiredToken = await new SignJWT({ sub: "user-expired" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("-10s") // expired 10 seconds ago
    .sign(secretKey);

  const result = await verifyAccessToken(expiredToken, TEST_SECRET);
  assert.strictEqual(result.valid, false);
});

test("verifyAccessToken flags sliding-window refresh when < 2 minutes remaining", async () => {
  const secretKey = new TextEncoder().encode(TEST_SECRET);
  const nearExpiryToken = await new SignJWT({ sub: "user-refresh-needed" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("60s") // 1 minute left (< 120s)
    .sign(secretKey);

  const result = await verifyAccessToken(nearExpiryToken, TEST_SECRET);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.needsRefresh, true);
});
