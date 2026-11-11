import test from "node:test";
import assert from "node:assert";
import {
  hydrateCache,
  memoryCache,
  lastFetchTimeByKey,
  getCacheEntry,
  buildCacheKey,
  clearUserCache,
} from "../../lib/cache/swr-cache.ts";

test("hydrateCache seeds memoryCache and lastFetchTimeByKey synchronously", () => {
  const testLocation = "loc-test-123";
  const testUser = "user-test-456";

  const entries = {
    employees: [{ id: "emp-1", name: "Alice" }],
    channels: [{ id: "chan-1", name: "General" }],
    "tasks:dashboard": [{ id: "task-1", title: "Open store" }],
  };

  const beforeTime = Date.now();
  hydrateCache(entries, { locationId: testLocation, userId: testUser });
  const afterTime = Date.now();

  // Verify memoryCache entries for user
  const empKeyUser = buildCacheKey(testUser, testLocation, "employees");
  const empEntry = getCacheEntry<Array<{ id: string; name: string }>>(empKeyUser);
  assert.ok(empEntry, "employees entry should exist in memoryCache");
  assert.strictEqual(empEntry?.data[0].name, "Alice");
  assert.ok(empEntry.timestamp >= beforeTime && empEntry.timestamp <= afterTime);

  // Verify dual seeding for anonymous fallback
  const empKeyAnon = buildCacheKey("anonymous", testLocation, "employees");
  const anonEntry = getCacheEntry<Array<{ id: string; name: string }>>(empKeyAnon);
  assert.ok(anonEntry, "anonymous entry should also be seeded for pre-auth mount");
  assert.strictEqual(anonEntry?.data[0].name, "Alice");

  // Verify lastFetchTimeByKey
  const fetchTime = lastFetchTimeByKey.get(empKeyUser);
  assert.ok(fetchTime !== undefined, "lastFetchTimeByKey should be seeded");
  assert.ok(fetchTime >= beforeTime && fetchTime <= afterTime);

  // Verify tasks
  const taskKeyUser = buildCacheKey(testUser, testLocation, "tasks:dashboard");
  const taskEntry = getCacheEntry<Array<{ id: string; title: string }>>(taskKeyUser);
  assert.ok(taskEntry);
  assert.strictEqual(taskEntry?.data[0].title, "Open store");

  // Cleanup
  clearUserCache(testUser);
  clearUserCache("anonymous");
});

test("hydrateCache handles undefined / empty inputs gracefully", () => {
  hydrateCache({}, { locationId: "loc-empty" });
  assert.ok(true, "Empty entries object handled cleanly");

  hydrateCache({ empty: undefined }, { locationId: "loc-empty" });
  const key = buildCacheKey("anonymous", "loc-empty", "empty");
  assert.strictEqual(memoryCache.has(key), false, "Undefined entries should not be seeded");
});
