import { randomUUID } from "node:crypto";
import { config } from "../config";
import { WorkflowLog } from "../types";
import { readJsonFile, writeJsonFile } from "./json-file.service";

export async function getWorkflowLogs(): Promise<WorkflowLog[]> {
  return readJsonFile<WorkflowLog[]>(config.workflowFile, []);
}

export async function saveWorkflowLogs(logs: WorkflowLog[]): Promise<void> {
  await writeJsonFile(config.workflowFile, logs);
}

export function normalizeWorkflowLog(
  input: Partial<WorkflowLog>,
  existing?: WorkflowLog
): WorkflowLog {
  const value = { ...existing, ...input };
  return {
    id: value.id?.trim() || `session-${randomUUID().slice(0, 8)}`,
    projectId: value.projectId?.trim() || "",
    sessionTitle: value.sessionTitle?.trim() || "Untitled session",
    date: value.date || new Date().toISOString().slice(0, 10),
    status: value.status || "in-progress",
    summary: value.summary?.trim() || "",
    passes: Array.isArray(value.passes) ? value.passes.filter(Boolean) : [],
    blockers: Array.isArray(value.blockers) ? value.blockers.filter(Boolean) : [],
    nextSteps: Array.isArray(value.nextSteps) ? value.nextSteps.filter(Boolean) : [],
    gitStatus: value.gitStatus?.trim() || "",
    commitHash: value.commitHash?.trim() || "",
    tags: Array.isArray(value.tags) ? value.tags.filter(Boolean) : []
  };
}
