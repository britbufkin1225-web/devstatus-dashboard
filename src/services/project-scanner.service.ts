import { config } from "../config";
import { Project, ProjectWithMetadata } from "../types";
import { getDocumentationHealth } from "./documentation.service";
import { getGitMetadata } from "./git.service";
import { getGitHubMetadata } from "./github.service";
import { readJsonFile, writeJsonFile } from "./json-file.service";

let projectCache: ProjectWithMetadata[] = [];

export async function getProjects(): Promise<Project[]> {
  return readJsonFile<Project[]>(config.projectsFile, []);
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await writeJsonFile(config.projectsFile, projects);
}

export async function scanProject(project: Project): Promise<ProjectWithMetadata> {
  const [git, documentation] = await Promise.all([
    getGitMetadata(project),
    getDocumentationHealth(project)
  ]);
  const githubProject = project.githubUrl
    ? project
    : { ...project, githubUrl: git.remoteOriginUrl || "" };
  const github = await getGitHubMetadata(githubProject);
  return { ...project, git, github, documentation };
}

export async function scanAllProjects(): Promise<ProjectWithMetadata[]> {
  const projects = await getProjects();
  projectCache = await Promise.all(projects.map(scanProject));
  return projectCache;
}

export async function getLiveProjects(force = false): Promise<ProjectWithMetadata[]> {
  if (force || projectCache.length === 0) {
    return scanAllProjects();
  }
  return projectCache;
}

export function clearProjectCache(): void {
  projectCache = [];
}
