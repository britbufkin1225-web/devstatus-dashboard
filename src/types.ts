export type ProjectStatus = "active" | "paused" | "completed" | "archived" | string;
export type WorkflowStatus =
  | "in-progress"
  | "PASS"
  | "T100"
  | "W100"
  | "WTC"
  | "T404"
  | "W404"
  | string;

export interface Project {
  id: string;
  name: string;
  type: string;
  status: ProjectStatus;
  repoPath: string;
  githubUrl: string;
  defaultBranch: string;
  techStack: string[];
  currentSession: string;
  nextStep: string;
  notes: string;
  vscodeOpenCommand: string;
}

export interface GitMetadata {
  available: boolean;
  isRepository: boolean;
  error?: string;
  branch?: string;
  clean?: boolean;
  modifiedFiles: number;
  untrackedFiles: number;
  lastCommitHash?: string;
  lastCommitMessage?: string;
  lastCommitDate?: string;
  remoteOriginUrl?: string;
  ahead?: number;
  behind?: number;
}

export type GitFetchStatus = "skipped" | "success" | "failed";

export interface GitFetchResult {
  attempted: boolean;
  status: GitFetchStatus;
  message: string;
}

export interface ProjectSyncResult {
  projectId: string;
  projectName: string;
  fetchAttempted: boolean;
  fetchStatus: GitFetchStatus;
  fetchMessage: string;
  git: GitMetadata;
}

export interface RefreshError {
  projectId?: string;
  type: string;
  message: string;
}

export interface GitHubMetadata {
  available: boolean;
  error?: string;
  name?: string;
  description?: string | null;
  stars?: number;
  forks?: number;
  openIssues?: number;
  defaultBranch?: string;
  lastPushedDate?: string | null;
  lastUpdatedDate?: string | null;
  visibility?: string;
  primaryLanguage?: string | null;
  topics?: string[];
}

export interface DocumentationHealth {
  available: boolean;
  readmePresent: boolean;
  docsDirectoryPresent: boolean;
  documentationFiles: number;
  status: "healthy" | "partial" | "missing" | "unavailable";
}

export interface ProjectWithMetadata extends Project {
  git: GitMetadata;
  github: GitHubMetadata;
  documentation: DocumentationHealth;
}

export interface WorkflowLog {
  id: string;
  projectId: string;
  sessionTitle: string;
  date: string;
  status: WorkflowStatus;
  summary: string;
  passes: string[];
  blockers: string[];
  nextSteps: string[];
  gitStatus: string;
  commitHash: string;
  tags: string[];
}

export interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  dirtyWorkingTrees: number;
  cleanWorkingTrees: number;
  unavailableRepositories: number;
  openBlockers: number;
  latestWorkflowSession: WorkflowLog | null;
  lastSyncedAt: string;
}
