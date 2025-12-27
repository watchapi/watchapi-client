/**
 * tRPC procedure parser
 * Detects and parses tRPC router procedures
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '@/shared/logger';
import { FILE_PATTERNS } from '@/shared/constants';
import type { ParsedRoute } from '@/shared/types';
import type { HttpMethod } from '@/shared/constants';

/**
 * Detect if current workspace has tRPC
 */
export async function hasTRPC(): Promise<boolean> {
	try {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return false;
		}

		// Check for package.json with @trpc/server dependency
		for (const folder of workspaceFolders) {
			const packageJsonUri = vscode.Uri.joinPath(folder.uri, 'package.json');
			try {
				const content = await vscode.workspace.fs.readFile(packageJsonUri);
				const packageJson = JSON.parse(content.toString());

				if (
					packageJson.dependencies?.['@trpc/server'] ||
					packageJson.devDependencies?.['@trpc/server']
				) {
					logger.info('Detected tRPC project');
					return true;
				}
			} catch {
				// Continue to next workspace folder
			}
		}

		return false;
	} catch (error) {
		logger.error('Failed to detect tRPC', error);
		return false;
	}
}

/**
 * Parse tRPC router files
 */
export async function parseTRPCRouters(): Promise<ParsedRoute[]> {
	try {
		logger.debug('Parsing tRPC routers');
		const routes: ParsedRoute[] = [];

		// Find all router files
		const files = await vscode.workspace.findFiles(
			FILE_PATTERNS.TRPC_ROUTERS,
			'**/node_modules/**'
		);

		for (const file of files) {
			const parsedRoutes = await parseTRPCRouterFile(file);
			routes.push(...parsedRoutes);
		}

		logger.info(`Parsed ${routes.length} tRPC procedures`);
		return routes;
	} catch (error) {
		logger.error('Failed to parse tRPC routers', error);
		return [];
	}
}

/**
 * Parse a single tRPC router file
 */
async function parseTRPCRouterFile(uri: vscode.Uri): Promise<ParsedRoute[]> {
	try {
		const content = await vscode.workspace.fs.readFile(uri);
		const text = content.toString();
		const routes: ParsedRoute[] = [];

		// Extract router name from file path or export
		const fileName = path.basename(uri.fsPath, path.extname(uri.fsPath));
		const routerName = fileName.replace(/\.router$/, '');

		// Find all procedure definitions
		// Pattern: .query('procedureName' or .mutation('procedureName'
		const queryRegex = /\.query\(['"]([^'"]+)['"]/g;
		const mutationRegex = /\.mutation\(['"]([^'"]+)['"]/g;

		// Parse queries (GET)
		let match;
		while ((match = queryRegex.exec(text)) !== null) {
			const procedureName = match[1];
			const routePath = `/api/trpc/${routerName}.${procedureName}`;

			routes.push({
				name: `GET ${routePath}`,
				path: routePath,
				method: 'GET',
				filePath: uri.fsPath,
				type: 'trpc',
			});
		}

		// Parse mutations (POST)
		while ((match = mutationRegex.exec(text)) !== null) {
			const procedureName = match[1];
			const routePath = `/api/trpc/${routerName}.${procedureName}`;

			routes.push({
				name: `POST ${routePath}`,
				path: routePath,
				method: 'POST',
				filePath: uri.fsPath,
				type: 'trpc',
			});
		}

		return routes;
	} catch (error) {
		logger.error(`Failed to parse tRPC router file: ${uri.fsPath}`, error);
		return [];
	}
}

/**
 * Get tRPC base path from configuration
 */
export async function getTRPCBasePath(): Promise<string> {
	try {
		// Look for tRPC endpoint configuration
		const files = await vscode.workspace.findFiles(
			'**/pages/api/trpc/[trpc].{ts,js}',
			'**/node_modules/**'
		);

		if (files.length > 0) {
			return '/api/trpc';
		}

		// Check for App Router tRPC endpoint
		const appFiles = await vscode.workspace.findFiles(
			'**/app/api/trpc/[...trpc]/route.{ts,js}',
			'**/node_modules/**'
		);

		if (appFiles.length > 0) {
			return '/api/trpc';
		}

		// Default
		return '/api/trpc';
	} catch (error) {
		logger.error('Failed to get tRPC base path', error);
		return '/api/trpc';
	}
}

/**
 * Convert tRPC route to HTTP endpoint
 * tRPC uses POST for both queries and mutations, but we use GET for queries
 */
export function convertTRPCRouteToHTTP(route: ParsedRoute): ParsedRoute {
	// For tRPC queries, use GET; for mutations, use POST
	const method: HttpMethod = route.path.includes('query') ? 'GET' : 'POST';

	return {
		...route,
		method,
	};
}
