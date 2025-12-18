import { RequestLike } from "../models/request";

export function buildRequestDocument(
  request: RequestLike & { name?: string },
): string {
  if (request.httpContent?.trim()) {
    const content = request.httpContent.trimEnd() + "\n";
    return content;
  }

  function safePathname(input: string) {
    try {
      return new URL(input).pathname;
    } catch {
      return input;
    }
  }

  return [
    `### ${request.method} ${safePathname(request.url)} - ${request.name}`,
    ``,
    `${request.method} ${request.url}`,
    ``,
  ].join("\n");
}
