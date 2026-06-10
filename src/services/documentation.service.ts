import { promises as fs } from "node:fs";
import path from "node:path";
import { DocumentationHealth, Project } from "../types";

const documentationExtensions = new Set([".md", ".mdx", ".txt", ".rst", ".adoc"]);

export async function getDocumentationHealth(
  project: Project
): Promise<DocumentationHealth> {
  if (!project.repoPath) {
    return {
      available: false,
      readmePresent: false,
      docsDirectoryPresent: false,
      documentationFiles: 0,
      status: "unavailable"
    };
  }

  try {
    const entries = await fs.readdir(project.repoPath, { withFileTypes: true });
    const readmePresent = entries.some(
      (entry) => entry.isFile() && /^readme(?:\.[^.]+)?$/i.test(entry.name)
    );
    const docsEntry = entries.find(
      (entry) => entry.isDirectory() && entry.name.toLowerCase() === "docs"
    );
    let documentationFiles = readmePresent ? 1 : 0;

    if (docsEntry) {
      const docsPath = path.join(project.repoPath, docsEntry.name);
      const docsFiles = await fs.readdir(docsPath, { withFileTypes: true });
      documentationFiles += docsFiles.filter(
        (entry) =>
          entry.isFile() &&
          documentationExtensions.has(path.extname(entry.name).toLowerCase())
      ).length;
    }

    return {
      available: true,
      readmePresent,
      docsDirectoryPresent: Boolean(docsEntry),
      documentationFiles,
      status: readmePresent && docsEntry
        ? "healthy"
        : readmePresent || docsEntry
          ? "partial"
          : "missing"
    };
  } catch {
    return {
      available: false,
      readmePresent: false,
      docsDirectoryPresent: false,
      documentationFiles: 0,
      status: "unavailable"
    };
  }
}
