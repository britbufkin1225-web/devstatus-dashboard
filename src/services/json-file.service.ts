import { promises as fs } from "node:fs";
import path from "node:path";

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      await writeJsonFile(filePath, fallback);
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}
