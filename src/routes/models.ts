import type { FastifyInstance } from "fastify";
import type { ModelConfigStore } from "../models/catalog.js";

export const registerModelRoutes = async (app: FastifyInstance, models: ModelConfigStore): Promise<void> => {
  app.get("/v1/models", async () => ({
    object: "list",
    data: models.listEnabled().map((model) => ({
      id: model.id,
      object: "model",
      created: model.created,
      owned_by: model.ownedBy,
    })),
  }));
};
