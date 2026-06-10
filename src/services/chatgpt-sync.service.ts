import { DashboardSummary, ProjectWithMetadata, WorkflowLog } from "../types";

function list(values: string[]): string {
  return values.length ? values.join("; ") : "None";
}

export function buildChatGptContext(
  projects: ProjectWithMetadata[],
  logs: WorkflowLog[],
  summary: DashboardSummary
): string {
  const lines = [
    "# DevStatus Dashboard Context",
    "",
    `Generated: ${summary.lastSyncedAt}`,
    `Projects: ${summary.totalProjects} total, ${summary.activeProjects} active, ${summary.cleanWorkingTrees} clean, ${summary.dirtyWorkingTrees} dirty`,
    `Open blockers: ${summary.openBlockers}`,
    "",
    "Use this snapshot as the current source of truth for my developer project status. Ask before assuming details not present here.",
    ""
  ];

  for (const project of projects) {
    const recentLogs = logs
      .filter((log) => log.projectId === project.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);

    lines.push(
      `## ${project.name} (${project.id})`,
      `- Status: ${project.status}`,
      `- Type: ${project.type || "Not set"}`,
      `- Tech stack: ${list(project.techStack)}`,
      `- Current session: ${project.currentSession || "Not set"}`,
      `- Next step: ${project.nextStep || "Not set"}`,
      `- Local path: ${project.repoPath || "Not set"}`,
      `- GitHub: ${project.githubUrl || project.git.remoteOriginUrl || "Not set"}`,
      `- Git: ${project.git.available
        ? `${project.git.clean ? "WTC" : "dirty"}, branch ${project.git.branch || "unknown"}, ${project.git.modifiedFiles} modified, ${project.git.untrackedFiles} untracked`
        : `unavailable (${project.git.error || "unknown error"})`}`,
      `- Documentation: ${project.documentation.status} (README ${project.documentation.readmePresent ? "present" : "missing"}, docs folder ${project.documentation.docsDirectoryPresent ? "present" : "missing"})`,
      `- Last commit: ${project.git.lastCommitHash
        ? `${project.git.lastCommitHash.slice(0, 8)} ${project.git.lastCommitMessage || ""}`
        : "Not available"}`,
      `- Notes: ${project.notes || "None"}`
    );

    if (recentLogs.length) {
      lines.push("- Recent workflow:");
      for (const log of recentLogs) {
        lines.push(
          `  - ${log.date} | ${log.status} | ${log.sessionTitle} | blockers: ${list(log.blockers)} | next: ${list(log.nextSteps)}`
        );
      }
    }
    lines.push("");
  }

  lines.push(
    "## Shorthand",
    "- WTC: working tree clean",
    "- Com: commit to GitHub",
    "- T100: completed task",
    "- W100: completed workflow",
    "- FIN: finished testing",
    "- DStat: daily project status diagnostic report",
    "- ftop: from the top",
    "- lost: explain as if I am a beginner",
    "- merg: merge conflict",
    "- T404: task failed",
    "- W404: workflow failed",
    "- serv404: server failed to start"
  );

  return lines.join("\n");
}
