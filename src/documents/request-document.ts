import { RequestLike } from "../models/request";
import { loadRestClientEnvVariables } from "../utils/rest-client-env";
import { normalizeHeaders } from "../utils/normalize-headers";

export async function buildRequestDocument(
  request: RequestLike & { name?: string },
): Promise<string> {
  const headerRecord = normalizeHeaders(request.headers);
  const body = request.body?.trim();

  function safePathname(input: string) {
    try {
      return new URL(input).pathname;
    } catch {
      return input;
    }
  }

  const envLines = await loadRestClientEnvVariables("local");
  const nameSuffix = request.name?.trim() ? ` - ${request.name.trim()}` : "";

  const lines: string[] = [];
  if (envLines.length) {
    lines.push(...envLines, "");
  }

  lines.push(
    `### ${request.method} ${safePathname(request.url)}${nameSuffix}`,
    ``,
    `${request.method} ${request.url}`,
    ``,
  );

  if (headerRecord && Object.keys(headerRecord).length > 0) {
    for (const key of Object.keys(headerRecord).sort((a, b) =>
      a.localeCompare(b),
    )) {
      lines.push(`${key}: ${headerRecord[key]}`);
    }
    lines.push("");
  }

  if (body && body.length > 0) {
    lines.push(body, "");
  }

  return lines.join("\n");
}

// intentionally re-export for ease of testing and reuse
export { normalizeHeaders };
