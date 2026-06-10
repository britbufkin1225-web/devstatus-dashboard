import { Router } from "express";
import { fetchGitRemote } from "../services/git.service";
import {
  getLiveProjects,
  getProjects,
  scanAllProjects
} from "../services/project-scanner.service";
import { buildStatus } from "../services/status.service";
import { getWorkflowLogs } from "../services/workflow-log.service";
import {
  GitFetchResult,
  ProjectSyncResult,
  RefreshError
} from "../types";

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

interface SyncOptions {
  fetchRequested: boolean;
  fetchAllRemotes: boolean;
  projectId?: string;
}

async function refreshProjects(options: SyncOptions) {
  const registeredProjects = await getProjects();
  const fetchResults = new Map<string, GitFetchResult>();

  await Promise.all(
    registeredProjects.map(async (project) => {
      if (!options.fetchRequested) {
        fetchResults.set(project.id, {
          attempted: false,
          status: "skipped",
          message: "Fetch was not requested."
        });
        return;
      }

      if (options.projectId && project.id !== options.projectId) {
        fetchResults.set(project.id, {
          attempted: false,
          status: "skipped",
          message: `Fetch was limited to project '${options.projectId}'.`
        });
        return;
      }

      fetchResults.set(
        project.id,
        await fetchGitRemote(project, options.fetchAllRemotes)
      );
    })
  );

  const [projects, logs] = await Promise.all([scanAllProjects(), getWorkflowLogs()]);
  const results: ProjectSyncResult[] = projects.map((project) => {
    const fetchResult = fetchResults.get(project.id) || {
      attempted: false,
      status: "skipped" as const,
      message: "Fetch was not requested."
    };
    return {
      projectId: project.id,
      projectName: project.name,
      fetchAttempted: fetchResult.attempted,
      fetchStatus: fetchResult.status,
      fetchMessage: fetchResult.message,
      git: project.git
    };
  });

  return {
    projects,
    results,
    summary: buildStatus(projects, logs)
  };
}

syncRouter.post("/", async (request, response, next) => {
  try {
    const projectId =
      typeof request.body?.projectId === "string" && request.body.projectId.trim()
        ? request.body.projectId.trim()
        : undefined;
    const registeredProjects = await getProjects();

    if (projectId && !registeredProjects.some((project) => project.id === projectId)) {
      response.status(404).json({ error: `Project '${projectId}' was not found.` });
      return;
    }

    const result = await refreshProjects({
      fetchRequested: request.body?.fetch === true,
      fetchAllRemotes: false,
      projectId
    });
    response.json({
      summary: result.summary,
      projects: result.projects,
      results: result.results
    });
  } catch (error) {
    next(error);
  }
});

function githubErrorType(message: string): string {
  return /rate limit|returned 403|returned 429/i.test(message)
    ? "github_rate_limited"
    : "github_refresh_failed";
}

export const refreshRouter = Router();

refreshRouter.post("/", async (_request, response) => {
  const refreshedAt = new Date().toISOString();

  try {
    const result = await refreshProjects({
      fetchRequested: true,
      fetchAllRemotes: true
    });
    const errors: RefreshError[] = [];

    for (const project of result.projects) {
      const syncResult = result.results.find(
        (item) => item.projectId === project.id
      );
      if (syncResult && syncResult.fetchStatus !== "success") {
        errors.push({
          projectId: project.id,
          type:
            syncResult.fetchStatus === "failed"
              ? "git_fetch_failed"
              : "git_fetch_skipped",
          message: syncResult.fetchMessage
        });
      }
      if (project.github.error) {
        errors.push({
          projectId: project.id,
          type: githubErrorType(project.github.error),
          message: project.github.error
        });
      }
    }

    const partial = errors.length > 0;
    response.json({
      status: partial ? "partial" : "ok",
      message: partial
        ? "Project metadata refreshed with errors"
        : "Project metadata refreshed",
      refreshedAt,
      projects: result.projects,
      errors,
      summary: result.summary,
      results: result.results
    });
  } catch (error) {
    response.status(500).json({
      status: "error",
      message: "Metadata refresh failed",
      refreshedAt,
      projects: [],
      errors: [
        {
          type: "refresh_failed",
          message:
            error instanceof Error ? error.message : "Unexpected refresh failure"
        }
      ]
    });
  }
});
