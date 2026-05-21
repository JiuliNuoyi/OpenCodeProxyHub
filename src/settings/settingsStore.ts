import { JsonFileStore } from "../storage/jsonFile.js";

export interface SystemSettings {
  requestBodyLimitBytes: number;
  upstreamTimeoutMs: number;
  defaultStream: boolean;
  logPrompts: boolean;
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

    this.persist();
    return this.get();
  }

  private persist(): void {
    this.store.write({ version: 1, settings: this.settings });
  }
}
