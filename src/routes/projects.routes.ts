import { Router } from "express";
import { Project } from "../types";
import {
  clearProjectCache,
  getLiveProjects,
  getProjects,
  saveProjects,
  scanProject
} from "../services/project-scanner.service";
import { getWorkflowLogs } from "../services/workflow-log.service";

export const projectsRouter = Router();

projectsRouter.get("/", async (_request, response, next) => {
  try {
    response.json(await getLiveProjects(true));
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id", async (request, response, next) => {
  try {
    const projects = await getProjects();
    const project = projects.find((item) => item.id === request.params.id);
    if (!project) {
      response.status(404).json({ error: "Project not found." });
      return;
    }
    const [details, logs] = await Promise.all([
      scanProject(project),
      getWorkflowLogs()
    ]);
    response.json({
      ...details,
      workflowLogs: logs.filter((log) => log.projectId === project.id)
    });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/", async (request, response, next) => {
  try {
    const project = request.body as Project;
    if (!project.id?.trim() || !project.name?.trim()) {
      response.status(400).json({ error: "Project id and name are required." });
      return;
    }
    const projects = await getProjects();
    if (projects.some((item) => item.id === project.id)) {
      response.status(409).json({ error: "A project with that id already exists." });
      return;
    }
    projects.push(project);
    await saveProjects(projects);
    clearProjectCache();
    response.status(201).json(await scanProject(project));
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch("/:id", async (request, response, next) => {
  try {
    const projects = await getProjects();
    const index = projects.findIndex((item) => item.id === request.params.id);
    if (index === -1) {
      response.status(404).json({ error: "Project not found." });
      return;
    }
    const updated = { ...projects[index], ...request.body, id: projects[index].id };
    projects[index] = updated;
    await saveProjects(projects);
    clearProjectCache();
    response.json(await scanProject(updated));
  } catch (error) {
    next(error);
  }
});
