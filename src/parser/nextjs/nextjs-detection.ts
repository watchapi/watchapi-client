/**
 * Next.js route detection utilities
 */

import * as path from 'path';
import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import {
	APP_ROUTER_METHODS,
	DYNAMIC_SEGMENT_REGEX,
	CATCH_ALL_REGEX,
	OPTIONAL_CATCH_ALL_REGEX,
	RESERVED_SEGMENTS,
} from './nextjs-constants';
import type { DynamicSegment, RouteDetectionResult, DebugLogger } from './nextjs-types';
import type { HttpMethod } from '@/shared/constants';

/**
 * Detect if file is an App Router route file
 */
export function isAppRouterFile(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, '/');
	return normalized.includes('/app/') && normalized.endsWith('/route.ts') || normalized.endsWith('/route.js');
}

/**
 * Detect if file is a Pages Router API file
 */
export function isPagesRouterFile(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, '/');
	return normalized.includes('/pages/api/') && !normalized.endsWith('/route.ts') && !normalized.endsWith('/route.js');
}

/**
 * Extract route path from file path
 */
export function extractRoutePath(
	filePath: string,
	rootDir: string,
	debug: DebugLogger,
): RouteDetectionResult {
	const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
	let routePath = '';
	let isAppRouter = false;
	let isPagesRouter = false;

	debug(`Extracting route path from: ${relativePath}`);

	if (isAppRouterFile(filePath)) {
		// App Router: app/api/users/[id]/route.ts -> /api/users/:id
		isAppRouter = true;
		routePath = relativePath
			.replace(/^(src\/)?app/, '')
			.replace(/\/route\.(ts|js)$/, '')
			.replace(/^\//, '');

		// Ensure API routes start with /api
		if (!routePath.startsWith('api/') && routePath !== '') {
			routePath = routePath;
		} else {
			routePath = '/' + routePath;
		}
	} else if (isPagesRouterFile(filePath)) {
		// Pages Router: pages/api/users/[id].ts -> /api/users/:id
		isPagesRouter = true;
		routePath = relativePath
			.replace(/^(src\/)?pages/, '')
			.replace(/\.(ts|js)$/, '')
			.replace(/\/index$/, '');

		if (!routePath) {
			routePath = '/';
		}
	}

	// Extract dynamic segments
	const dynamicSegments = extractDynamicSegments(routePath);

	// Convert [param] to :param
	routePath = convertDynamicSegments(routePath);

	debug(`Extracted route path: ${routePath} (App: ${isAppRouter}, Pages: ${isPagesRouter})`);

	return {
		isAppRouter,
		isPagesRouter,
		routePath,
		dynamicSegments,
	};
}

/**
 * Extract dynamic segments from route path
 */
export function extractDynamicSegments(routePath: string): DynamicSegment[] {
	const segments: DynamicSegment[] = [];
	const matches = routePath.matchAll(DYNAMIC_SEGMENT_REGEX);

	for (const match of matches) {
		const fullMatch = match[0];
		const paramName = match[1];

		// Check for optional catch-all: [[...slug]]
		if (OPTIONAL_CATCH_ALL_REGEX.test(fullMatch)) {
			const optMatch = fullMatch.match(OPTIONAL_CATCH_ALL_REGEX);
			if (optMatch) {
				segments.push({
					name: optMatch[1],
					isCatchAll: true,
					isOptional: true,
				});
			}
			continue;
		}

		// Check for catch-all: [...slug]
		if (CATCH_ALL_REGEX.test(fullMatch)) {
			const catchMatch = fullMatch.match(CATCH_ALL_REGEX);
			if (catchMatch) {
				segments.push({
					name: catchMatch[1],
					isCatchAll: true,
					isOptional: false,
				});
			}
			continue;
		}

		// Regular dynamic segment: [id]
		segments.push({
			name: paramName,
			isCatchAll: false,
			isOptional: false,
		});
	}

	return segments;
}

/**
 * Convert Next.js dynamic segments to Express-style params
 */
export function convertDynamicSegments(routePath: string): string {
	return routePath
		.replace(/\[\[\.\.\.([^\]]+)\]\]/g, ':$1*?') // Optional catch-all
		.replace(/\[\.\.\.([^\]]+)\]/g, ':$1*') // Catch-all
		.replace(/\[([^\]]+)\]/g, ':$1'); // Regular param
}

/**
 * Collect exported HTTP method handlers from source file
 */
export function collectHttpMethodHandlers(
	sourceFile: SourceFile,
	debug: DebugLogger,
): Map<HttpMethod, Node> {
	const handlers = new Map<HttpMethod, Node>();

	// Find all exported function declarations
	sourceFile.getFunctions().forEach((func) => {
		if (!func.isExported()) {
			return;
		}

		const name = func.getName();
		if (name && APP_ROUTER_METHODS.includes(name as HttpMethod)) {
			debug(`Found exported ${name} handler`);
			handlers.set(name as HttpMethod, func);
		}
	});

	// Find all exported variable declarations with arrow functions
	sourceFile.getVariableDeclarations().forEach((decl) => {
		const name = decl.getName();
		if (!APP_ROUTER_METHODS.includes(name as HttpMethod)) {
			return;
		}

		// Check if it's exported
		const statement = decl.getVariableStatement();
		if (statement?.isExported()) {
			const initializer = decl.getInitializer();
			if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
				debug(`Found exported ${name} handler (arrow/function expression)`);
				handlers.set(name as HttpMethod, initializer);
			}
		}
	});

	// Find named exports
	sourceFile.getExportedDeclarations().forEach((declarations, name) => {
		if (!APP_ROUTER_METHODS.includes(name as HttpMethod)) {
			return;
		}

		declarations.forEach((decl) => {
			if (Node.isFunctionDeclaration(decl) || Node.isVariableDeclaration(decl)) {
				debug(`Found named export ${name} handler`);
				handlers.set(name as HttpMethod, decl);
			}
		});
	});

	return handlers;
}

/**
 * Detect Pages Router handler pattern
 */
export function detectPagesRouterHandler(sourceFile: SourceFile, debug: DebugLogger): Node | null {
	// Look for default export
	const defaultExport = sourceFile.getDefaultExportSymbol();
	if (defaultExport) {
		const declarations = defaultExport.getDeclarations();
		if (declarations.length > 0) {
			debug('Found default export handler');
			return declarations[0];
		}
	}

	// Look for named export 'handler'
	const handlerExport = sourceFile.getExportedDeclarations().get('handler');
	if (handlerExport && handlerExport.length > 0) {
		debug('Found named handler export');
		return handlerExport[0];
	}

	return null;
}

/**
 * Detect HTTP methods used in Pages Router handler
 */
export function detectPagesRouterMethods(handler: Node, debug: DebugLogger): HttpMethod[] {
	const methods: HttpMethod[] = [];
	const handlerText = handler.getText();

	// Look for req.method === 'METHOD' or req.method === "METHOD"
	const methodChecks = handlerText.matchAll(/req\.method\s*===\s*['"](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"]/g);

	for (const match of methodChecks) {
		const method = match[1] as HttpMethod;
		if (!methods.includes(method)) {
			debug(`Detected ${method} method in handler`);
			methods.push(method);
		}
	}

	// Look for switch cases on req.method
	const switchCases = handlerText.matchAll(/case\s+['"](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"]/g);

	for (const match of switchCases) {
		const method = match[1] as HttpMethod;
		if (!methods.includes(method)) {
			debug(`Detected ${method} method in switch case`);
			methods.push(method);
		}
	}

	// If no specific methods found, default to GET
	if (methods.length === 0) {
		debug('No specific methods found, defaulting to GET');
		methods.push('GET');
	}

	return methods;
}

/**
 * Check if handler uses middleware
 */
export function hasMiddleware(sourceFile: SourceFile): boolean {
	const text = sourceFile.getText();
	return /middleware|NextRequest|authenticate|authorize|auth\(/.test(text);
}

/**
 * Check if file is a Server Action
 */
export function isServerAction(sourceFile: SourceFile): boolean {
	const text = sourceFile.getText();
	return text.includes("'use server'") || text.includes('"use server"');
}

/**
 * Normalize route path
 */
export function normalizeRoutePath(routePath: string): string {
	// Remove trailing slashes except for root
	if (routePath !== '/' && routePath.endsWith('/')) {
		routePath = routePath.slice(0, -1);
	}

	// Ensure leading slash
	if (!routePath.startsWith('/')) {
		routePath = '/' + routePath;
	}

	return routePath;
}

/**
 * Check if segment is reserved
 */
export function isReservedSegment(segment: string): boolean {
	return RESERVED_SEGMENTS.has(segment);
}
