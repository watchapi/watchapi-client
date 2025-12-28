/**
 * Upload command handlers
 * Commands: UPLOAD_ENDPOINTS
 */

import * as vscode from "vscode";
import { COMMANDS } from "@/shared/constants";
import { wrapCommandWithRefresh } from "./command-wrapper";
import {
	parseAllNextJsRoutes,
	parseTRPCRouters,
	hasNextJs,
	hasTRPC,
} from "@/parser";
import type { UploadModal } from "@/ui";
import type { CollectionsTreeProvider } from "@/collections";

export function registerUploadCommands(
	context: vscode.ExtensionContext,
	uploadModal: UploadModal,
	treeProvider: CollectionsTreeProvider,
): void {
	// Upload endpoints command - Detect and upload routes
	context.subscriptions.push(
		vscode.commands.registerCommand(
			COMMANDS.UPLOAD_ENDPOINTS,
			wrapCommandWithRefresh(
				{
					commandName: "uploadEndpoints",
					errorMessagePrefix: "Upload failed",
				},
				async () => {
					const [hasNext, hasTrpc] = await Promise.all([
						hasNextJs(),
						hasTRPC(),
					]);

					if (!hasNext && !hasTrpc) {
						vscode.window.showWarningMessage(
							"No supported project type detected. This feature requires Next.js or tRPC.",
						);
						return;
					}

					// Show progress while detecting routes
					const routes = await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: "Detecting API routes...",
						},
						async () => {
							const [nextRoutes, trpcRoutes] = await Promise.all([
								hasNext ? parseAllNextJsRoutes() : [],
								hasTrpc ? parseTRPCRouters() : [],
							]);
							return [...nextRoutes, ...trpcRoutes];
						},
					);

					await uploadModal.show(routes);
				},
				() => treeProvider.refresh(),
			),
		),
	);
}
