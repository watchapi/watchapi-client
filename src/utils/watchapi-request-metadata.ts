export type WatchApiRequestMetadata = {
  endpointId?: string;
};

const ENDPOINT_ID_TAG = "watchapi.endpointId";
const ENDPOINT_ID_RE = new RegExp(
  String.raw`^\s*#\s*${ENDPOINT_ID_TAG}\s*:\s*(\S+)\s*$`,
  "m",
);
const WATCHAPI_TITLE_RE = /^\s*###\s*WatchAPI\s+Request\s*$/;

export function extractEndpointIdFromHttpDocument(text: string): string | null {
  const match = text.match(ENDPOINT_ID_RE);
  return match?.[1] ?? null;
}

export function ensureEndpointIdInHttpDocument(
  text: string,
  endpointId: string,
): string {
  if (extractEndpointIdFromHttpDocument(text)) {
    return text;
  }

  const lines = text.split(/\r?\n/);
  const titleIndex = lines.findIndex((line) => WATCHAPI_TITLE_RE.test(line));
  const tagLine = `# ${ENDPOINT_ID_TAG}: ${endpointId}`;

  if (titleIndex !== -1) {
    lines.splice(titleIndex + 1, 0, tagLine);
    const afterTag = lines[titleIndex + 2];
    if (afterTag !== undefined && afterTag.trim() !== "") {
      lines.splice(titleIndex + 2, 0, "");
    }
    return lines.join("\n");
  }

  const prefix = `${tagLine}\n`;
  return text.startsWith("\n") ? prefix + text.slice(1) : prefix + text;
}

