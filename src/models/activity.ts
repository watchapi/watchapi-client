export type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface ActivityItem {
  id: string;
  method: Method;
  url: string;
  timestamp: number;
}
