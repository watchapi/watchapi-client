/**
 * WatchAPI VS Code Extension
 * Main entry point
 */

import * as vscode from "vscode";
import { logger, LogLevel, COMMANDS, HTTP_CLIENT } from "@/shared";
import { getConfig } from "@/shared/config";
import { AuthService } from "@/auth";
import {
  CollectionNode,
  CollectionsService,
  CollectionsTreeProvider,
  EndpointNode,
} from "@/collections";
import { EndpointsService } from "@/endpoints";
import { CacheService, SyncService } from "@/sync";
import { StatusBarManager, UploadModal } from "@/ui";
import {
  parseAllNextJsRoutes,
  parseTRPCRouters,
  hasNextJs,
  hasTRPC,
} from "@/parser";
import type { ApiEndpoint } from "@/shared/types";
import { EndpointsFileSystemProvider } from "./endpoints/endpoints.fs";
import {
  humanizeRouteName,
  openEndpointEditor,
} from "./endpoints/endpoints.editor";
import { OrganizationService } from "@/organizations";

/**
 * Extension activation
 */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  logger.info("WatchAPI extension activating");
  logger.setLogLevel(LogLevel.INFO);

  try {
    // Initialize services
    const authService = new AuthService(context);
    const organizationService = new OrganizationService(context);
    const localStorage = new (await import("@/storage")).LocalStorageService(
      context,
    );

    const collectionsService = new CollectionsService();
    const endpointsService = new EndpointsService();

    // Set up local storage for offline mode
    collectionsService.setLocalStorage(localStorage, () =>
      authService.isAuthenticated(),
    );
    endpointsService.setLocalStorage(localStorage, () =>
      authService.isAuthenticated(),
    );

    const cacheService = new CacheService(context);
    const syncService = new SyncService(
      context,
      collectionsService,
      endpointsService,
      cacheService,
    );
    syncService.setLocalStorage(localStorage);

    // Initialize UI components
    const statusBar = new StatusBarManager();
    const uploadModal = new UploadModal(collectionsService, endpointsService);

    const fsProvider = new EndpointsFileSystemProvider(endpointsService);

    context.subscriptions.push(
      vscode.workspace.registerFileSystemProvider("watchapi", fsProvider, {
        isCaseSensitive: true,
      }),
    );

    // Initialize tree provider
    const treeProvider = new CollectionsTreeProvider(
      collectionsService,
      endpointsService,
    );

    // Register tree view
    const treeView = vscode.window.createTreeView("watchapi.collections", {
      treeDataProvider: treeProvider,
      canSelectMany: true,
    });

    context.subscriptions.push(
      vscode.window.registerUriHandler({
        handleUri: async (uri) => {
          await authService.handleAuthCallback(uri);
        },
      }),
    );

    // Extension works locally by default, sync only when authenticated
    const authState = await authService.getAuthState();
    if (authState.isAuthenticated) {
      await syncService.initialize();
    } else {
      // Load local data when not authenticated
      logger.info("Working in local mode (not authenticated)");
    }

    // Register commands
    registerCommands(
      context,
      authService,
      organizationService,
      collectionsService,
      endpointsService,
      syncService,
      treeProvider,
      uploadModal,
    );

    // Set up event listeners
    setupEventListeners(
      authService,
      organizationService,
      syncService,
      statusBar,
      treeProvider,
    );
    // Initialize auth
    await authService.initialize();

    // Check for HTTP Client extension
    await checkHttpClientExtension();

    // Check for supported project types
    await checkProjectType();

    // Add all disposables
    context.subscriptions.push(
      authService,
      organizationService,
      syncService,
      statusBar,
      treeProvider,
      treeView,
    );

    logger.info("WatchAPI extension activated successfully");
    logger.info(`API URL: ${getConfig().apiUrl}`);
  } catch (error) {
    logger.error("Failed to activate extension", error);
    vscode.window.showErrorMessage(`WatchAPI activation failed: ${error}`);
    throw error;
  }
}

/**
 * Register all extension commands
 */
function registerCommands(
  context: vscode.ExtensionContext,
  authService: AuthService,
  organizationService: OrganizationService,
  collectionsService: CollectionsService,
  endpointsService: EndpointsService,
  syncService: SyncService,
  treeProvider: CollectionsTreeProvider,
  uploadModal: UploadModal,
): void {
  // Refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.REFRESH, async () => {
      try {
        await syncService.sync();
        treeProvider.refresh();
        vscode.window.showInformationMessage("Collections refreshed");
      } catch (error) {
        vscode.window.showErrorMessage(`Refresh failed: ${error}`);
      }
    }),
  );

  // Login command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.LOGIN, async () => {
      try {
        await authService.login();
      } catch (error) {
        vscode.window.showErrorMessage(`Login failed: ${error}`);
      }
    }),
  );

  // Logout command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.LOGOUT, async () => {
      try {
        await authService.logout();
        syncService.stopAutoSync();
        treeProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Logout failed: ${error}`);
      }
    }),
  );

  // Select organization command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SWITCH_ORGANIZATION, async () => {
      try {
        const isAuthenticated = await authService.isAuthenticated();
        if (!isAuthenticated) {
          vscode.window.showErrorMessage("Please login first");
          return;
        }

        // Fetch user's organizations
        const organizations = await organizationService.getUserOrganizations();

        if (!organizations || organizations.length === 0) {
          vscode.window.showInformationMessage("No organizations found");
          return;
        }

        // Get current organization
        const currentOrgId =
          await organizationService.getCurrentOrganizationId();

        // Show quick pick
        const items = organizations.map((org) => ({
          label: org.name,
          description: `${org.role} • ${org.plan}`,
          detail: currentOrgId === org.id ? "Currently selected" : undefined,
          organizationId: org.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Select an organization",
          title: "Select Organization",
        });

        if (!selected) {
          return;
        }

        // Don't switch if already on this organization
        if (selected.organizationId === currentOrgId) {
          return;
        }

        // Switch organization
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Switching to ${selected.label}...`,
            cancellable: false,
          },
          async () => {
            await organizationService.switchOrganization(
              selected.organizationId,
            );

            // Refresh collections after switching
            await syncService.sync();
            treeProvider.refresh();
          },
        );

        vscode.window.showInformationMessage(
          `Selected organization: ${selected.label}`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to switch organization: ${error}`,
        );
      }
    }),
  );

  // Focus command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.FOCUS, () => {
      vscode.commands.executeCommand("watchapi.collections.focus");
    }),
  );

  // Open dashboard command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.OPEN_DASHBOARD, () => {
      vscode.env.openExternal(vscode.Uri.parse(getConfig().dashboardUrl));
    }),
  );

  // Add collection command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.ADD_COLLECTION, async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter collection name",
        placeHolder: "e.g., User API",
      });

      if (!name) {
        return;
      }

      try {
        await collectionsService.create({ name });
        treeProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create collection: ${error}`);
      }
    }),
  );

  // Delete collection command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMANDS.DELETE_COLLECTION,
      async (item: CollectionNode, items?: CollectionNode[]) => {
        const targets = items?.length ? items : [item];
        if (!targets.length) return;

        const confirm = await vscode.window.showWarningMessage(
          `Delete ${targets.length} collection${
            targets.length > 1 ? "s" : ""
          }?`,
          { modal: true },
          "Delete",
        );

        if (confirm !== "Delete") return;

        for (const node of targets) {
          await collectionsService.delete(node.collection.id);
        }

        treeProvider.refresh();
      },
    ),
  );

  // Add endpoint command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMANDS.ADD_ENDPOINT,
      async (collectionNode: CollectionNode) => {
        // 1️⃣ Ask for HTTP method
        const method = await vscode.window.showQuickPick(
          ["GET", "POST", "PUT", "PATCH", "DELETE"],
          {
            title: "Select HTTP method",
            placeHolder: "Choose method",
          },
        );

        if (!method) {
          return;
        }

        const url = await vscode.window.showInputBox({
          title: "Endpoint path",
          prompt: "Enter endpoint path",
          placeHolder: "/users/:id",
          validateInput: (value) =>
            value.startsWith("/") ? null : "Path should start with /",
        });

        if (!url) {
          return;
        }

        const name = await vscode.window.showInputBox({
          title: "Endpoint name",
          prompt: "Enter endpoint name",
          value: humanizeRouteName({
            path: url,
            method,
          }), // 👈 preselect path as name
          valueSelection: [0, url.length], // 👈 select all so Enter saves fast
        });

        if (!name) {
          return;
        }

        await endpointsService.create({
          name,
          method: method as any,
          url,
          collectionId: collectionNode.collection.id,
        });

        treeProvider.refresh();
      },
    ),
  );

  // Delete endpoint command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMANDS.DELETE_ENDPOINT,
      async (item: EndpointNode, items?: EndpointNode[]) => {
        const targets = items?.length ? items : [item];
        if (!targets.length) return;

        const confirm = await vscode.window.showWarningMessage(
          `Delete ${targets.length} endpoint${targets.length > 1 ? "s" : ""}?`,
          { modal: true },
          "Delete",
        );

        if (confirm !== "Delete") return;

        for (const node of targets) {
          await endpointsService.delete(node.endpoint.id);
        }

        treeProvider.refresh();
      },
    ),
  );

  // Upload endpoints command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.UPLOAD_ENDPOINTS, async () => {
      try {
        const [hasNext, hasTrpc] = await Promise.all([hasNextJs(), hasTRPC()]);

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
        treeProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Upload failed: ${error}`);
      }
    }),
  );

  // Open endpoint command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "watchapi.openEndpoint",
      async (endpoint: ApiEndpoint) => {
        try {
          await openEndpointEditor(endpoint);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open endpoint: ${error}`);
        }
      },
    ),
  );

  // Show status command
  context.subscriptions.push(
    vscode.commands.registerCommand("watchapi.showStatus", async () => {
      // Implemented in StatusBarManager
    }),
  );
}

/**
 * Set up event listeners
 */
function setupEventListeners(
  authService: AuthService,
  organizationService: OrganizationService,
  syncService: SyncService,
  statusBar: StatusBarManager,
  treeProvider: CollectionsTreeProvider,
): void {
  // Listen to auth state changes
  authService.onDidChangeAuthState(async (state) => {
    statusBar.updateAuthState(state);
    treeProvider.refresh();

    vscode.commands.executeCommand(
      "setContext",
      "watchapi.loggedIn",
      state.isAuthenticated,
    );

    if (state.isAuthenticated) {
      // Fetch and display current organization
      try {
        const organizations = await organizationService.getUserOrganizations();
        const currentOrgId =
          await organizationService.getCurrentOrganizationId();
        const currentOrg = organizations.find((org) => org.id === currentOrgId);

        if (currentOrg) {
          statusBar.updateOrganization(currentOrg.name);
        }
      } catch (error) {
        logger.error("Failed to fetch organization info", error);
      }

      syncService.initialize().catch((error) => {
        vscode.window.showErrorMessage(`Sync failed: ${error}`);
      });
    } else {
      statusBar.updateOrganization(undefined);
      syncService.stopAutoSync();
    }
  });

  // Listen to organization changes
  organizationService.onDidChangeOrganization(async (organizationId) => {
    if (organizationId) {
      try {
        const organizations = await organizationService.getUserOrganizations();
        const org = organizations.find((o) => o.id === organizationId);

        if (org) {
          statusBar.updateOrganization(org.name);
        }
      } catch (error) {
        logger.error("Failed to fetch organization info", error);
      }
    } else {
      statusBar.updateOrganization(undefined);
    }
  });

  // Listen to sync state changes
  syncService.onDidChangeState((state) => {
    statusBar.updateSyncState(state);
  });
}

/**
 * Check if HTTP Client extension is installed and enabled
 */
async function checkHttpClientExtension() {
  const extension = vscode.extensions.getExtension(HTTP_CLIENT.EXTENSION_ID);

  // Not installed
  if (!extension) {
    logger.warn("HTTP Client extension not installed");

    const action = await vscode.window.showWarningMessage(
      `The ${HTTP_CLIENT.NAME} extension is recommended for better .http file editing experience.`,
      "Install Extension",
    );

    if (action === "Install Extension") {
      await vscode.commands.executeCommand(
        "workbench.extensions.installExtension",
        HTTP_CLIENT.EXTENSION_ID,
      );
    }

    return;
  }

  // Installed but disabled (or not yet activated)
  3;

  // Installed and enabled
  logger.info("HTTP Client extension is installed and enabled");
}

/**
 * Check and log supported project types
 */
async function checkProjectType(): Promise<void> {
  const [hasNext, hasTrpc] = await Promise.all([hasNextJs(), hasTRPC()]);

  if (hasNext || hasTrpc) {
    const types: string[] = [];
    if (hasNext) {
      types.push("Next.js");
    }
    if (hasTrpc) {
      types.push("tRPC");
    }
    logger.info(`Detected project types: ${types.join(", ")}`);
  } else {
    logger.info(
      "No supported project types detected (upload feature will be disabled)",
    );
  }
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  logger.info("WatchAPI extension deactivated");
}
