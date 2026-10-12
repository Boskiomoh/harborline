const BASE = "http://harborline.invalid";

/**
 * A post-sign-in `next` target, only if it stays on this site. `startsWith("/")` alone lets
 * `/\evil.com` through, which browsers read as `//evil.com`, so the value is parsed as a URL and
 * rebuilt from its path, query and hash (dropping any tabs or newlines the parser stripped).
 */
export function safeNext(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return null;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
