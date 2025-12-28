/**
 * Navigation command handlers
 * Commands: FOCUS, OPEN_DASHBOARD
 */

import * as vscode from "vscode";
import { COMMANDS } from "@/shared/constants";
import { getConfig } from "@/shared/config";

export function registerNavigationCommands(
	context: vscode.ExtensionContext,
): void {
	// Focus command - Focus the collections tree view
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMANDS.FOCUS, () => {
			vscode.commands.executeCommand("watchapi.collections.focus");
		}),
	);

	// Open dashboard command - Open web dashboard in browser
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMANDS.OPEN_DASHBOARD, () => {
			vscode.env.openExternal(vscode.Uri.parse(getConfig().dashboardUrl));
		}),
	);
}
