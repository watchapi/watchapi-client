export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type RequestLike = {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string> | null;
  body?: string | null;
  timestamp: number;
};
