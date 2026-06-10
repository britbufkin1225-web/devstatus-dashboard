import { config } from "../config";
import { GitHubMetadata, Project } from "../types";

function parseGitHubRepository(url: string): { owner: string; repo: string } | null {
  if (!url) return null;

  const normalized = url
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname.toLowerCase() !== "github.com") return null;
    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    return owner && repo ? { owner, repo } : null;
  } catch {
    return null;
  }
}

export async function getGitHubMetadata(project: Project): Promise<GitHubMetadata> {
  const repository = parseGitHubRepository(project.githubUrl);
  if (!repository) {
    return { available: false, error: "No valid GitHub repository URL configured." };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "devstatus-dashboard",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }

  try {
    const response = await fetch(
      `${config.githubApiUrl}/repos/${repository.owner}/${repository.repo}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) {
      return {
        available: false,
        error: `GitHub returned ${response.status}. Public repositories work without a token; private repositories require GITHUB_TOKEN.`
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      available: true,
      name: data.name as string,
      description: (data.description as string | null) ?? null,
      stars: data.stargazers_count as number,
      forks: data.forks_count as number,
      openIssues: data.open_issues_count as number,
      defaultBranch: data.default_branch as string,
      lastPushedDate: (data.pushed_at as string | null) ?? null,
      visibility: (data.visibility as string) || ((data.private as boolean) ? "private" : "public"),
      primaryLanguage: (data.language as string | null) ?? null,
      topics: Array.isArray(data.topics) ? (data.topics as string[]) : []
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Unable to contact GitHub."
    };
  }
}
