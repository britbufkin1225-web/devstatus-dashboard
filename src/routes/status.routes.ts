import { Router } from "express";
import { getLiveProjects, scanAllProjects } from "../services/project-scanner.service";
import { buildStatus } from "../services/status.service";
import { getWorkflowLogs } from "../services/workflow-log.service";

export const statusRouter = Router();

statusRouter.get("/", async (_request, response, next) => {
  try {
    const [projects, logs] = await Promise.all([
      getLiveProjects(),
      getWorkflowLogs()
    ]);
    response.json(buildStatus(projects, logs));
  } catch (error) {
    next(error);
  }
});

export const syncRouter = Router();

syncRouter.post("/", async (_request, response, next) => {
  try {
    const [projects, logs] = await Promise.all([
      scanAllProjects(),
      getWorkflowLogs()
    ]);
    response.json({
      summary: buildStatus(projects, logs),
      projects
    });
  } catch (error) {
    next(error);
  }
});
