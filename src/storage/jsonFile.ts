import fs from "node:fs";
import path from "node:path";

export class JsonFileStore<T> {
  constructor(private readonly filePath: string) {}

  read(fallback: T): T {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  write(value: T): void {
    const parent = path.dirname(this.filePath);
    if (parent && parent !== ".") fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}
