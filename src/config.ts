import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const projectRoot = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT) || 3030,
  githubToken: process.env.GITHUB_TOKEN?.trim() || "",
  githubApiUrl: process.env.GITHUB_API_URL?.trim() || "https://api.github.com",
  projectRoot,
  publicDir: path.join(projectRoot, "public"),
  projectsFile: path.join(projectRoot, "src", "data", "projects.json"),
  workflowFile: path.join(projectRoot, "src", "data", "workflow-log.json")
};
