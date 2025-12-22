export function normalizeHeaders(
  headers?: Record<string, string> | string | null,
): Record<string, string> | null {
  if (!headers) return null;
  if (typeof headers === "string") {
    try {
      const parsed = JSON.parse(headers);
      if (parsed && typeof parsed === "object") {
        return Object.entries(parsed).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            if (typeof value === "string") {
              acc[key] = value;
            }
            return acc;
          },
          {},
        );
      }
      return null;
    } catch {
      return null;
    }
  }
  return headers;
}
