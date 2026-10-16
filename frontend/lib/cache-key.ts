function cacheKeyValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null) return ["null"];
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "number") return ["number", Number.isNaN(value) ? "NaN" : Object.is(value, -0) ? "-0" : String(value)];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "undefined") return ["undefined"];
  if (typeof value === "function") return ["function", String(value)];
  if (typeof value !== "object") return [typeof value, String(value)];
  if (seen.has(value)) throw new TypeError("Cannot serialize cyclic RPC cache arguments");
  seen.add(value);
  let result: unknown;
  if (Array.isArray(value)) result = ["array", value.map((item) => cacheKeyValue(item, seen))];
  else if (value instanceof Map) result = ["map", Array.from(value.entries()).map(([key, item]) => [cacheKeyValue(key, seen), cacheKeyValue(item, seen)])];
  else result = ["object", Object.keys(value).sort().map((key) => [key, cacheKeyValue((value as Record<string, unknown>)[key], seen)])];
  seen.delete(value);
  return result;
}

export function serializeReadCacheKey(functionName: string, args: unknown[] = [], latest = false): string {
  return JSON.stringify([cacheKeyValue(functionName), cacheKeyValue(args), cacheKeyValue(latest)]);
}
