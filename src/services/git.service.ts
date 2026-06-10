import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { GitFetchResult, GitMetadata, Project } from "../types";

const execFileAsync = promisify(execFile);

async function runGit(
  repoPath: string,
  args: string[],
  timeout = 8000
): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  return stdout.trim();
}

function unavailable(error: string): GitMetadata {
  return {
    available: false,
    isRepository: false,
    error,
    modifiedFiles: 0,
    untrackedFiles: 0
  };
}

async function validateRepository(project: Project): Promise<string | null> {
  if (!project.repoPath) {
    return "No local repository path configured.";
  }

  try {
    const stats = await fs.stat(project.repoPath);
    if (!stats.isDirectory()) {
      return "Configured repository path is not a directory.";
    }
  } catch {
    return "Configured repository path does not exist.";
  }

  try {
    const isInside = await runGit(project.repoPath, [
      "rev-parse",
      "--is-inside-work-tree"
    ]);
    if (isInside !== "true") {
      return "Configured path is not a Git working tree.";
    }
  } catch {
    return "Configured path is not a Git repository or Git is unavailable.";
  }

  return null;
}

function gitErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Git fetch failed for an unknown reason.";
  }

  const details = error as Error & { stderr?: string };
  return details.stderr?.trim() || error.message;
}

export async function fetchGitRemote(
  project: Project,
  allRemotes = false
): Promise<GitFetchResult> {
  const validationError = await validateRepository(project);
  if (validationError) {
    return {
      attempted: false,
      status: "skipped",
      message: validationError
    };
  }

  try {
    const remotes = await runGit(project.repoPath, ["remote"]);
    if (!remotes) {
      return {
        attempted: false,
        status: "skipped",
        message: "No Git remote is configured."
      };
    }
  } catch (error) {
    return {
      attempted: false,
      status: "skipped",
      message: `Unable to inspect Git remotes: ${gitErrorMessage(error)}`
    };
  }

  try {
    await runGit(
      project.repoPath,
      allRemotes ? ["fetch", "--all", "--prune"] : ["fetch", "--prune"],
      60000
    );
    return {
      attempted: true,
      status: "success",
      message: allRemotes
        ? "Fetched all remotes and pruned remote-tracking refs."
        : "Fetched and pruned remote-tracking refs."
    };
  } catch (error) {
    return {
      attempted: true,
      status: "failed",
      message: gitErrorMessage(error)
    };
  }
}

export async function getGitMetadata(project: Project): Promise<GitMetadata> {
  const validationError = await validateRepository(project);
  if (validationError) {
    return unavailable(validationError);
  }

  try {
    const [branchResult, statusResult, logResult, remoteResult] = await Promise.allSettled([
      runGit(project.repoPath, ["branch", "--show-current"]),
      runGit(project.repoPath, ["status", "--porcelain"]),
      runGit(project.repoPath, ["log", "-1", "--pretty=format:%H%x1f%s%x1f%cI"]),
      runGit(project.repoPath, ["remote", "get-url", "origin"])
    ]);

    const statusOutput = statusResult.status === "fulfilled" ? statusResult.value : "";
    const statusLines = statusOutput ? statusOutput.split(/\r?\n/) : [];
    const untrackedFiles = statusLines.filter((line) => line.startsWith("??")).length;
    const modifiedFiles = statusLines.length - untrackedFiles;

    const metadata: GitMetadata = {
      available: true,
      isRepository: true,
      branch: branchResult.status === "fulfilled" ? branchResult.value || "(detached)" : undefined,
      clean: statusLines.length === 0,
      modifiedFiles,
      untrackedFiles,
      remoteOriginUrl: remoteResult.status === "fulfilled" ? remoteResult.value : undefined
    };

    if (logResult.status === "fulfilled" && logResult.value) {
      const [hash, message, date] = logResult.value.split("\x1f");
      metadata.lastCommitHash = hash;
      metadata.lastCommitMessage = message;
      metadata.lastCommitDate = date;
    }

    const remoteBranch = project.defaultBranch || metadata.branch;
    if (remoteBranch) {
      try {
        const counts = await runGit(project.repoPath, [
          "rev-list",
          "--left-right",
          "--count",
          `origin/${remoteBranch}...HEAD`
        ]);
        const [behind, ahead] = counts.split(/\s+/).map(Number);
        metadata.behind = behind;
        metadata.ahead = ahead;
      } catch {
        // A missing origin or remote branch is expected for local-only repositories.
      }
    }

    return metadata;
  } catch (error) {
    return {
      ...unavailable(error instanceof Error ? error.message : "Unable to read Git metadata."),
      isRepository: true
    };
  }
}
