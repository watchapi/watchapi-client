// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ActivityProvider } from "./providers/activity-provider";
import { ActivityStore } from "./storage/activity-store";
import { Method } from "./models/activity";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "watchapi-client" is now active!',
  );

  const store = new ActivityStore(context);
  const provider = new ActivityProvider(store);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "watchapi-client.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from watchapi-client!");
    },
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("watchapi.activity", provider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "watchapi.activity.add",
      async (method: Method, url: string) => {
        await store.add({
          id: crypto.randomUUID(),
          method,
          url,
          timestamp: Date.now(),
        });
        provider.refresh();
      },
    ),
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
