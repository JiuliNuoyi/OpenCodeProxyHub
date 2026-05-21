import { JsonFileStore } from "../storage/jsonFile.js";

export interface SystemSettings {
  requestBodyLimitBytes: number;
  upstreamTimeoutMs: number;
  defaultStream: boolean;
  logPrompts: boolean;
  openAiStreamTransformModels: string[];
  logEnabled: boolean;
  logAudit: boolean;
  logApiRequests: boolean;
  logMaxBodyChars: number;
  logRetentionDays: number;
}

interface SettingsFile {
  version: 1;
  settings: SystemSettings;
}

export type SystemSettingsUpdate = Partial<SystemSettings>;

const DEFAULT_SETTINGS: SystemSettings = {
  requestBodyLimitBytes: 10 * 1024 * 1024,
  upstreamTimeoutMs: 120000,
  defaultStream: false,
  logPrompts: false,
  openAiStreamTransformModels: [],
  logEnabled: false,
  logAudit: true,
  logApiRequests: true,
  logMaxBodyChars: 2000,
  logRetentionDays: 7,
};

export class SettingsStore {
  private readonly store: JsonFileStore<SettingsFile>;
  private settings: SystemSettings = { ...DEFAULT_SETTINGS };

  constructor(settingsFile: string, overrides: Partial<SystemSettings> = {}) {
    this.store = new JsonFileStore<SettingsFile>(settingsFile);
    this.settings = { ...DEFAULT_SETTINGS, ...overrides };
  }

  load(): void {
    const data = this.store.read({ version: 1, settings: this.settings });
    this.settings = { ...DEFAULT_SETTINGS, ...this.settings, ...data.settings };
    this.persist();
  }

  get(): SystemSettings {
    return { ...this.settings };
  }

  update(input: SystemSettingsUpdate): SystemSettings {
    if (input.requestBodyLimitBytes !== undefined) {
      if (!Number.isFinite(input.requestBodyLimitBytes) || input.requestBodyLimitBytes < 1024) {
        throw new Error("requestBodyLimitBytes must be at least 1024");
      }
      this.settings.requestBodyLimitBytes = Math.trunc(input.requestBodyLimitBytes);
    }

    if (input.upstreamTimeoutMs !== undefined) {
      if (!Number.isFinite(input.upstreamTimeoutMs) || input.upstreamTimeoutMs < 1000) {
        throw new Error("upstreamTimeoutMs must be at least 1000");
      }
      this.settings.upstreamTimeoutMs = Math.trunc(input.upstreamTimeoutMs);
    }

    if (input.defaultStream !== undefined) this.settings.defaultStream = Boolean(input.defaultStream);
    if (input.logPrompts !== undefined) this.settings.logPrompts = Boolean(input.logPrompts);
    if (input.logEnabled !== undefined) this.settings.logEnabled = Boolean(input.logEnabled);
    if (input.logAudit !== undefined) this.settings.logAudit = Boolean(input.logAudit);
    if (input.logApiRequests !== undefined) this.settings.logApiRequests = Boolean(input.logApiRequests);
    if (input.logMaxBodyChars !== undefined) {
      if (!Number.isFinite(input.logMaxBodyChars) || input.logMaxBodyChars < 0) throw new Error("logMaxBodyChars must be at least 0");
      this.settings.logMaxBodyChars = Math.trunc(input.logMaxBodyChars);
    }
    if (input.logRetentionDays !== undefined) {
      if (!Number.isFinite(input.logRetentionDays) || input.logRetentionDays < 0) throw new Error("logRetentionDays must be at least 0");
      this.settings.logRetentionDays = Math.trunc(input.logRetentionDays);
    }
    if (input.openAiStreamTransformModels !== undefined) {
      if (!Array.isArray(input.openAiStreamTransformModels)) {
        throw new Error("openAiStreamTransformModels must be an array");
      }
      this.settings.openAiStreamTransformModels = [...new Set(input.openAiStreamTransformModels
        .map((model) => String(model).trim())
        .filter(Boolean))];
    }

    this.persist();
    return this.get();
  }

  private persist(): void {
    this.store.write({ version: 1, settings: this.settings });
  }
}
