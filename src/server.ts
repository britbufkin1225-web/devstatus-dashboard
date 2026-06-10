import express, { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { chatGptRouter } from "./routes/chatgpt.routes";
import { projectsRouter } from "./routes/projects.routes";
import { statusRouter, syncRouter } from "./routes/status.routes";
import { workflowRouter } from "./routes/workflow.routes";
import { scanAllProjects } from "./services/project-scanner.service";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(config.publicDir));
app.use("/api/status", statusRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/workflow", workflowRouter);
app.use("/api/sync", syncRouter);
app.use("/api/chatgpt", chatGptRouter);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "DevStatus Dashboard" });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error);
  response.status(500).json({
    error: error instanceof Error ? error.message : "Unexpected server error."
  });
});

async function start(): Promise<void> {
  try {
    await scanAllProjects();
  } catch (error) {
    console.error("Initial project scan failed:", error);
  }

  app.listen(config.port, () => {
    console.log(`DevStatus Dashboard running at http://localhost:${config.port}`);
  });
}

void start();
