import { describe, expect, it } from "vitest";
import { serializeReadCacheKey } from "./crux";

describe("RPC read cache keys", () => {
  it("serializes BigInt pagination without precision loss", () => {
    const key = serializeReadCacheKey("list_cases", [0n, 90071992547409931234567890n]);
    expect(key).toContain('["bigint","90071992547409931234567890"]');
  });

  it("keeps types and pagination dimensions distinct", () => {
    expect(serializeReadCacheKey("list_cases", [1])).not.toBe(serializeReadCacheKey("list_cases", [1n]));
    expect(serializeReadCacheKey("list_cases", [0n, 24n])).not.toBe(serializeReadCacheKey("list_cases", [24n, 0n]));
    expect(serializeReadCacheKey("get_case", ["1"])).not.toBe(serializeReadCacheKey("get_case", [1]));
    expect(serializeReadCacheKey("get_case", ["cx-1"], false)).not.toBe(serializeReadCacheKey("get_case", ["cx-1"], true));
  });

  it("is deterministic for object argument key order", () => {
    expect(serializeReadCacheKey("read", [{ b: 2, a: 1 }])).toBe(serializeReadCacheKey("read", [{ a: 1, b: 2 }]));
  });
});
