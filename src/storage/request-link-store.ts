import * as vscode from "vscode";

const KEY = "watchapi.requestLinks";
const MAX_ENTRIES = 300;

type RequestLinks = Record<string, string>;

export class RequestLinkStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private getAll(): RequestLinks {
    return this.context.workspaceState.get<RequestLinks>(KEY, {});
  }

  getEndpointId(uri: vscode.Uri): string | undefined {
    const links = this.getAll();
    return links[uri.toString()];
  }

  async linkEndpoint(uri: vscode.Uri, endpointId: string) {
    const links = this.getAll();
    links[uri.toString()] = endpointId;

    const entries = Object.entries(links);
    if (entries.length > MAX_ENTRIES) {
      const pruned = Object.fromEntries(entries.slice(-MAX_ENTRIES));
      await this.context.workspaceState.update(KEY, pruned);
      return;
    }

    await this.context.workspaceState.update(KEY, links);
  }
}

