import { Router } from "express";
import {
  getWorkflowLogs,
  normalizeWorkflowLog,
  saveWorkflowLogs
} from "../services/workflow-log.service";

export const workflowRouter = Router();

workflowRouter.get("/", async (request, response, next) => {
  try {
    let logs = await getWorkflowLogs();
    const { projectId, status, tag } = request.query;
    if (typeof projectId === "string" && projectId) {
      logs = logs.filter((log) => log.projectId === projectId);
    }
    if (typeof status === "string" && status) {
      logs = logs.filter((log) => log.status === status);
    }
    if (typeof tag === "string" && tag) {
      logs = logs.filter((log) => log.tags.includes(tag));
    }
    response.json(logs);
  } catch (error) {
    next(error);
  }
});

workflowRouter.get("/project/:projectId", async (request, response, next) => {
  try {
    const logs = await getWorkflowLogs();
    response.json(logs.filter((log) => log.projectId === request.params.projectId));
  } catch (error) {
    next(error);
  }
});

workflowRouter.post("/", async (request, response, next) => {
  try {
    const log = normalizeWorkflowLog(request.body);
    if (!log.projectId) {
      response.status(400).json({ error: "projectId is required." });
      return;
    }
    const logs = await getWorkflowLogs();
    if (logs.some((item) => item.id === log.id)) {
      response.status(409).json({ error: "A workflow log with that id already exists." });
      return;
    }
    logs.unshift(log);
    await saveWorkflowLogs(logs);
    response.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

workflowRouter.patch("/:id", async (request, response, next) => {
  try {
    const logs = await getWorkflowLogs();
    const index = logs.findIndex((item) => item.id === request.params.id);
    if (index === -1) {
      response.status(404).json({ error: "Workflow log not found." });
      return;
    }
    logs[index] = normalizeWorkflowLog(
      { ...request.body, id: logs[index].id },
      logs[index]
    );
    await saveWorkflowLogs(logs);
    response.json(logs[index]);
  } catch (error) {
    next(error);
  }
});
