import { HttpMethod } from "./request";

export type CollectionEndpoint = {
  id: string;
  name?: string;
  method: HttpMethod;
  url: string;
  headers?: Record<string, string> | null;
  body?: string | null;
  timestamp: number;
};

export type Collection = {
  id: string;
  name: string;
  createdAt: number;
  endpoints: CollectionEndpoint[];
};
