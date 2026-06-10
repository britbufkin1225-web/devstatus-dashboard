import { Router } from "express";
import { buildChatGptContext } from "../services/chatgpt-sync.service";
import { getLiveProjects } from "../services/project-scanner.service";
import { buildStatus } from "../services/status.service";
import { getWorkflowLogs } from "../services/workflow-log.service";

export const chatGptRouter = Router();

chatGptRouter.get("/context", async (request, response, next) => {
  try {
    const [projects, logs] = await Promise.all([
      getLiveProjects(true),
      getWorkflowLogs()
    ]);
    const summary = buildStatus(projects, logs);
    const context = buildChatGptContext(projects, logs, summary);

    if (request.query.format === "json") {
      response.json({ generatedAt: summary.lastSyncedAt, context });
      return;
    }

    response.type("text/markdown").send(context);
  } catch (error) {
    next(error);
  }
});
