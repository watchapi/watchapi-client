/**
 * Next.js route parser
 * Detects and parses Next.js App Router and Pages Router API routes
 */

import * as vscode from "vscode";
import * as path from "path";
import { logger } from "@/shared/logger";
import { FILE_PATTERNS } from "@/shared/constants";
import type { ParsedRoute } from "@/shared/types";
import type { HttpMethod } from "@/shared/constants";

/**
 * Detect if current workspace has Next.js
 */
export async function hasNextJs(): Promise<boolean> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    // Check for package.json with next dependency
    for (const folder of workspaceFolders) {
      const packageJsonUri = vscode.Uri.joinPath(folder.uri, "package.json");
      try {
        const content = await vscode.workspace.fs.readFile(packageJsonUri);
        const packageJson = JSON.parse(content.toString());

        if (
          packageJson.dependencies?.next ||
          packageJson.devDependencies?.next
        ) {
          logger.info("Detected Next.js project");
          return true;
        }
      } catch {
        // Continue to next workspace folder
      }
    }

    return false;
  } catch (error) {
    logger.error("Failed to detect Next.js", error);
    return false;
  }
}

/**
 * Parse Next.js App Router routes (app/api/..../route.ts pattern)
 */
export async function parseAppRoutes(): Promise<ParsedRoute[]> {
  try {
    logger.debug("Parsing Next.js App Router routes");
    const routes: ParsedRoute[] = [];

    // Find all route files
    const files = await vscode.workspace.findFiles(
      FILE_PATTERNS.NEXTJS_APP_ROUTES,
      "**/node_modules/**",
    );

    for (const file of files) {
      const parsedRoutes = await parseAppRouteFile(file);
      routes.push(...parsedRoutes);
    }

    logger.info(`Parsed ${routes.length} App Router routes`);
    return routes;
  } catch (error) {
    logger.error("Failed to parse App Router routes", error);
    return [];
  }
}

/**
 * Parse a single App Router route file
 */
async function parseAppRouteFile(uri: vscode.Uri): Promise<ParsedRoute[]> {
  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = content.toString();
    const routes: ParsedRoute[] = [];

    // Extract route path from file path
    // e.g., /app/api/users/[id]/route.ts -> /api/users/[id]
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return routes;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    const routePath = extractAppRoutePath(relativePath);

    // Detect exported HTTP method handlers
    const methods: HttpMethod[] = [];
    if (text.match(/export\s+(async\s+)?function\s+GET/)) {
      methods.push("GET");
    }
    if (text.match(/export\s+(async\s+)?function\s+POST/)) {
      methods.push("POST");
    }
    if (text.match(/export\s+(async\s+)?function\s+PUT/)) {
      methods.push("PUT");
    }
    if (text.match(/export\s+(async\s+)?function\s+PATCH/)) {
      methods.push("PATCH");
    }
    if (text.match(/export\s+(async\s+)?function\s+DELETE/)) {
      methods.push("DELETE");
    }

    // Create a route for each method
    for (const method of methods) {
      routes.push({
        name: routePath,
        path: routePath,
        method,
        filePath: uri.fsPath,
        type: "nextjs-app",
      });
    }

    return routes;
  } catch (error) {
    logger.error(`Failed to parse route file: ${uri.fsPath}`, error);
    return [];
  }
}

/**
 * Extract API route path from file path
 */
function extractAppRoutePath(relativePath: string): string {
  // Normalize leading src/
  let normalized = relativePath.replace(/^src\//, "");

  // Remove 'app/' prefix and '/route.ts|js' suffix
  let routePath = normalized
    .replace(/^app\//, "/")
    .replace(/\/route\.(ts|js)$/, "");

  // Replace [param] with :param
  routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");

  return routePath;
}

/**
 * Parse Next.js Pages Router routes (pages/api pattern)
 */
export async function parsePageRoutes(): Promise<ParsedRoute[]> {
  try {
    logger.debug("Parsing Next.js Pages Router routes");
    const routes: ParsedRoute[] = [];

    // Find all API route files
    const files = await vscode.workspace.findFiles(
      FILE_PATTERNS.NEXTJS_PAGE_ROUTES,
      "**/node_modules/**",
    );

    for (const file of files) {
      const parsedRoute = await parsePageRouteFile(file);
      if (parsedRoute) {
        routes.push(parsedRoute);
      }
    }

    logger.info(`Parsed ${routes.length} Pages Router routes`);
    return routes;
  } catch (error) {
    logger.error("Failed to parse Pages Router routes", error);
    return [];
  }
}

/**
 * Parse a single Pages Router route file
 */
async function parsePageRouteFile(
  uri: vscode.Uri,
): Promise<ParsedRoute | null> {
  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = content.toString();

    // Extract route path from file path
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return null;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    const routePath = extractPageRoutePath(relativePath);

    // Try to detect HTTP method from request handler
    let method: HttpMethod = "GET"; // Default

    if (text.match(/req\.method\s*===\s*['"]POST['"]/)) {
      method = "POST";
    } else if (text.match(/req\.method\s*===\s*['"]PUT['"]/)) {
      method = "PUT";
    } else if (text.match(/req\.method\s*===\s*['"]PATCH['"]/)) {
      method = "PATCH";
    } else if (text.match(/req\.method\s*===\s*['"]DELETE['"]/)) {
      method = "DELETE";
    }

    return {
      name: `${method} ${routePath}`,
      path: routePath,
      method,
      filePath: uri.fsPath,
      type: "nextjs-page",
    };
  } catch (error) {
    logger.error(`Failed to parse page route file: ${uri.fsPath}`, error);
    return null;
  }
}

/**
 * Extract API route path from file path (Pages Router)
 */
function extractPageRoutePath(relativePath: string): string {
  // Remove 'pages/api/' prefix and file extension
  let routePath = relativePath
    .replace(/^pages\/api\//, "/api/")
    .replace(/\.(ts|js)$/, "");

  // Replace [param] with :param for consistency
  routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");

  // Handle index routes
  routePath = routePath.replace(/\/index$/, "");

  return routePath || "/api";
}

/**
 * Parse all Next.js routes (both App and Pages Router)
 */
export async function parseAllNextJsRoutes(): Promise<ParsedRoute[]> {
  const [appRoutes, pageRoutes] = await Promise.all([
    parseAppRoutes(),
    parsePageRoutes(),
  ]);

  return [...appRoutes, ...pageRoutes];
}
