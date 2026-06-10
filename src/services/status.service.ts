import { DashboardSummary, ProjectWithMetadata, WorkflowLog } from "../types";

export function buildStatus(
  projects: ProjectWithMetadata[],
  workflowLogs: WorkflowLog[]
): DashboardSummary {
  const sortedLogs = [...workflowLogs].sort((a, b) => {
    const dateComparison = b.date.localeCompare(a.date);
    return dateComparison || b.id.localeCompare(a.id);
  });

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === "active").length,
    dirtyWorkingTrees: projects.filter((project) => project.git.available && !project.git.clean).length,
    cleanWorkingTrees: projects.filter((project) => project.git.available && project.git.clean).length,
    unavailableRepositories: projects.filter((project) => !project.git.available).length,
    openBlockers: workflowLogs.reduce((total, log) => total + log.blockers.length, 0),
    latestWorkflowSession: sortedLogs[0] || null,
    lastSyncedAt: new Date().toISOString()
  };
}
