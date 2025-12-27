/**
 * Endpoints service
 * Handles business logic for API endpoint CRUD operations
 * Supports both local storage (offline) and cloud sync (when authenticated)
 */

import { trpc } from "@/api/trpc-client";
import { logger } from "@/shared/logger";
import { NotFoundError, ValidationError } from "@/shared/errors";
import type { LocalStorageService } from "@/storage";
import type {
  ApiEndpoint,
  CreateApiEndpointInput,
  UpdateApiEndpointInput,
} from "@/shared/types";

export class EndpointsService {
  private localStorage?: LocalStorageService;
  private isAuthenticatedFn?: () => Promise<boolean>;

  /**
   * Set local storage for offline mode
   */
  setLocalStorage(
    localStorage: LocalStorageService,
    isAuthenticatedFn: () => Promise<boolean>,
  ): void {
    this.localStorage = localStorage;
    this.isAuthenticatedFn = isAuthenticatedFn;
  }

  private async isCloudMode(): Promise<boolean> {
    if (!this.isAuthenticatedFn) {
      return false;
    }
    return await this.isAuthenticatedFn();
  }

  /**
   * Get all endpoints (from cloud or local storage)
   */
  async getAll(): Promise<ApiEndpoint[]> {
    try {
      const isCloud = await this.isCloudMode();

      if (isCloud) {
        logger.debug("Fetching endpoints from cloud");
        const endpoints = await trpc.getEndpoints();
        logger.info(`Fetched ${endpoints.length} endpoints from cloud`);
        return endpoints;
      } else {
        logger.debug("Fetching endpoints from local storage");
        const endpoints = await this.localStorage!.getEndpoints();
        logger.info(`Fetched ${endpoints.length} endpoints from local`);
        return endpoints;
      }
    } catch (error) {
      logger.error("Failed to fetch endpoints", error);
      throw error;
    }
  }

  /**
   * Get a single endpoint by ID
   */
  async getById(id: string): Promise<ApiEndpoint> {
    try {
      const isCloud = await this.isCloudMode();

      if (isCloud) {
        logger.debug(`Fetching endpoint from cloud: ${id}`);
        const endpoint = await trpc.getEndpoint({ id });

        if (!endpoint) {
          throw new NotFoundError("Endpoint", id);
        }

        return endpoint as ApiEndpoint;
      } else {
        logger.debug(`Fetching endpoint from local: ${id}`);
        const endpoint = await this.localStorage!.getEndpoint(id);

        if (!endpoint) {
          throw new NotFoundError("Endpoint", id);
        }

        return endpoint;
      }
    } catch (error) {
      logger.error(`Failed to fetch endpoint: ${id}`, error);
      throw error;
    }
  }

  /**
   * Get all endpoints for a specific collection
   */
  async getByCollectionId(collectionId: string): Promise<ApiEndpoint[]> {
    try {
      const isCloud = await this.isCloudMode();

      if (isCloud) {
        logger.debug(
          `Fetching endpoints for collection from cloud: ${collectionId}`,
        );
        const allEndpoints = await trpc.getEndpoints();
        const endpoints = allEndpoints.filter(
          (e: any) => e.collectionId === collectionId,
        );
        logger.info(
          `Fetched ${endpoints.length} endpoints for collection from cloud: ${collectionId}`,
        );
        return endpoints as ApiEndpoint[];
      } else {
        logger.debug(
          `Fetching endpoints for collection locally: ${collectionId}`,
        );
        const endpoints = await this.localStorage!.getEndpointsByCollection(
          collectionId,
        );
        logger.info(
          `Fetched ${endpoints.length} endpoints for collection locally: ${collectionId}`,
        );
        return endpoints;
      }
    } catch (error) {
      logger.error(
        `Failed to fetch endpoints for collection: ${collectionId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create a new endpoint
   */
  async create(input: CreateApiEndpointInput): Promise<ApiEndpoint> {
    try {
      // Validate input
      if (!input.name || input.name.trim().length === 0) {
        throw new ValidationError("Endpoint name is required");
      }

      if (!input.url || input.url.trim().length === 0) {
        throw new ValidationError("Endpoint URL is required");
      }

      const isCloud = await this.isCloudMode();

      if (isCloud) {
        logger.debug("Creating endpoint in cloud", input);
        const endpoint = await trpc.createEndpoint(input);
        logger.info(
          `Created endpoint in cloud: ${endpoint.name} (${endpoint.id})`,
        );
        return endpoint;
      } else {
        logger.debug("Creating endpoint locally", input);
        const endpoint = await this.localStorage!.createEndpoint(input as any);
        logger.info(
          `Created endpoint locally: ${endpoint.name} (${endpoint.id})`,
        );
        return endpoint;
      }
    } catch (error) {
      logger.error("Failed to create endpoint", error);
      throw error;
    }
  }

  /**
   * Update an existing endpoint
   */
  async update(
    id: string,
    input: UpdateApiEndpointInput,
  ): Promise<ApiEndpoint> {
    try {
      const isCloud = await this.isCloudMode();

      if (isCloud) {
        logger.debug(`Updating endpoint in cloud: ${id}`, input);
        const endpoint = await trpc.updateEndpoint({ id, ...input });
        logger.info(
          `Updated endpoint in cloud: ${endpoint.name} (${endpoint.id})`,
        );
        return endpoint;
      } else {
        logger.debug(`Updating endpoint locally: ${id}`, input);
        const endpoint = await this.localStorage!.updateEndpoint(id, input);

        if (!endpoint) {
          throw new NotFoundError("Endpoint", id);
        }

        logger.info(
          `Updated endpoint locally: ${endpoint.name} (${endpoint.id})`,
        );
        return endpoint;
      }
    } catch (error) {
      logger.error(`Failed to update endpoint: ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete an endpoint
   */
  async delete(id: string): Promise<void> {
    try {
      const isCloud = await this.isCloudMode();

      if (isCloud) {
        logger.debug(`Deleting endpoint from cloud: ${id}`);
        await trpc.deleteEndpoint({ id });
        logger.info(`Deleted endpoint from cloud: ${id}`);
      } else {
        logger.debug(`Deleting endpoint locally: ${id}`);
        const deleted = await this.localStorage!.deleteEndpoint(id);

        if (!deleted) {
          throw new NotFoundError("Endpoint", id);
        }

        logger.info(`Deleted endpoint locally: ${id}`);
      }
    } catch (error) {
      logger.error(`Failed to delete endpoint: ${id}`, error);
      throw error;
    }
  }

  /**
   * Bulk create endpoints (for upload feature)
   */
  async bulkCreate(
    endpoints: CreateApiEndpointInput[],
  ): Promise<ApiEndpoint[]> {
    try {
      logger.debug(`Bulk creating ${endpoints.length} endpoints`);
      const created: ApiEndpoint[] = [];

      for (const input of endpoints) {
        const endpoint = await this.create(input);
        created.push(endpoint);
      }

      logger.info(`Bulk created ${created.length} endpoints`);
      return created;
    } catch (error) {
      logger.error("Failed to bulk create endpoints", error);
      throw error;
    }
  }
}
