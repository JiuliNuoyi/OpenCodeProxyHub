import { JsonFileStore } from "../storage/jsonFile.js";

export const DEFAULT_MODELS = [
  "deepseek-v4-flash-free",
  "big-pickle",
  "minimax-m2.5-free",
  "nemotron-3-super-free",
  "qwen3.6-plus-free",
] as const;

export interface ModelConfig {
  id: string;
  enabled: boolean;
  ownedBy: string;
  created: number;
  displayName?: string;
}

interface ModelConfigFile {
  version: 1;
  models: ModelConfig[];
}

export interface ModelUpdateInput {
  enabled?: boolean;
  ownedBy?: string;
  created?: number;
  displayName?: string;
}

export class ModelConfigStore {
  private readonly store: JsonFileStore<ModelConfigFile>;
  private models: ModelConfig[] = [];

  constructor(modelsFile: string) {
    this.store = new JsonFileStore<ModelConfigFile>(modelsFile);
  }

  load(): void {
    const data = this.store.read({ version: 1, models: [] });
    this.models = data.models.length > 0 ? data.models : this.defaultModels();
    this.persist();
  }

  list(): ModelConfig[] {
    return this.models.map((model) => ({ ...model }));
  }

  listEnabled(): ModelConfig[] {
    return this.list().filter((model) => model.enabled);
  }

  isEnabled(modelId: string): boolean {
    return this.models.some((model) => model.id === modelId && model.enabled);
  }

  enabledIds(): string[] {
    return this.listEnabled().map((model) => model.id);
  }

  upsert(id: string, input: ModelUpdateInput): ModelConfig {
    const cleanId = id.trim();
    if (!cleanId) throw new Error("Model id is required");

    let model = this.models.find((item) => item.id === cleanId);
    if (!model) {
      model = { id: cleanId, enabled: true, ownedBy: "opencode-free", created: 1779000000 };
      this.models.push(model);
    }

    if (input.enabled !== undefined) model.enabled = input.enabled;
    if (input.ownedBy !== undefined) model.ownedBy = input.ownedBy.trim() || "opencode-free";
    if (input.created !== undefined) model.created = input.created;
    if (input.displayName !== undefined) model.displayName = input.displayName.trim() || undefined;

    this.persist();
    return { ...model };
  }

  delete(id: string): boolean {
    const before = this.models.length;
    this.models = this.models.filter((model) => model.id !== id);
    if (this.models.length === before) return false;
    this.persist();
    return true;
  }

  private defaultModels(): ModelConfig[] {
    return DEFAULT_MODELS.map((id) => ({ id, enabled: true, ownedBy: "opencode-free", created: 1779000000 }));
  }

  private persist(): void {
    this.store.write({ version: 1, models: this.models });
  }
}
