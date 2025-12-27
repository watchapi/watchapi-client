import * as vscode from "vscode";
import { logger } from "@/shared/logger";
import type { ApiEndpoint, ParsedRoute } from "@/shared/types";

/**
 * Open endpoint in .http editor
 */
export async function openEndpointEditor(endpoint: ApiEndpoint): Promise<void> {
  logger.debug("Opening endpoint editor", {
    endpointId: endpoint.id,
    method: endpoint.method,
    path: endpoint.url,
  });
  try {
    const uri = vscode.Uri.parse(`watchapi:/endpoints/${endpoint.id}.http`);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });

    logger.info("Opened endpoint editor", { endpointId: endpoint.id });
  } catch (error) {
    logger.error("Failed to open endpoint editor", {
      endpointId: endpoint.id,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export function humanizeRouteName(route: {
  path: string;
  method: string;
}): string {
  const parts = route.path
    .replace("{{domain}}", "")
    .split("/")
    .filter(Boolean)
    .filter((p) => p !== "api");

  const resource = parts.slice(-2).join(" ");

  const actionMap: Record<string, string> = {
    GET: "Get",
    POST: "Create",
    PUT: "Update",
    PATCH: "Update",
    DELETE: "Delete",
  };

  const action = actionMap[route.method.toUpperCase()] ?? "Handle";

  return `${action} ${capitalize(resource)}`.trim();
}

function capitalize(text: string): string {
  return text
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
