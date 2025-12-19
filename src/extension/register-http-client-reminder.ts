import * as vscode from "vscode";

const HTTP_CLIENT_EXTENSION_ID = "humao.rest-client";

export function registerHttpClientReminder(context: vscode.ExtensionContext) {
  const updateContext = () => {
    const missing = !vscode.extensions.getExtension(HTTP_CLIENT_EXTENSION_ID);
    void vscode.commands.executeCommand(
      "setContext",
      "watchapi.httpClientMissing",
      missing,
    );
  };

  updateContext();

  context.subscriptions.push(
    vscode.extensions.onDidChange(updateContext),
    vscode.commands.registerCommand(
      "watchapi.httpClient.promptInstall",
      async () => {
        const choice = await vscode.window.showWarningMessage(
          "Install the REST Client extension to open and edit WatchAPI request files.",
          "Open Extension",
        );
        if (choice === "Open Extension") {
          await vscode.commands.executeCommand(
            "extension.open",
            HTTP_CLIENT_EXTENSION_ID,
          );
        }
      },
    ),
  );
}
