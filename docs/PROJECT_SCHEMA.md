# Project and Workflow Schemas

Data is stored as formatted JSON arrays under `src/data`. Writes use a temporary file and rename operation to reduce the chance of a partial file.

## Project Registry

File: `src/data/projects.json`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Unique URL-safe project identifier |
| `name` | string | yes | Display name |
| `type` | string | yes | Project category |
| `status` | string | yes | Usually `active`, `paused`, `completed`, or `archived` |
| `repoPath` | string | yes | Absolute local repository path |
| `githubUrl` | string | no | GitHub HTTPS or SSH repository URL |
| `defaultBranch` | string | yes | Branch used for ahead/behind comparison |
| `techStack` | string[] | yes | Languages and frameworks |
| `currentSession` | string | no | Current area of work |
| `nextStep` | string | no | Recommended next action |
| `notes` | string | no | Free-form project context |
| `vscodeOpenCommand` | string | no | Copyable VS Code command |

Live `git` and `github` objects are added to API responses. They are not written into `projects.json`, which prevents temporary scan results from polluting user-managed data.

The API also adds a `documentation` object with `readmePresent`, `docsDirectoryPresent`, `documentationFiles`, and a summary `status` of `healthy`, `partial`, `missing`, or `unavailable`.

## Git Metadata

| Field | Type | Description |
| --- | --- | --- |
| `available` | boolean | Whether local Git data could be read |
| `isRepository` | boolean | Whether the path is a Git working tree |
| `error` | string | Human-readable failure reason |
| `branch` | string | Current branch or `(detached)` |
| `clean` | boolean | Whether porcelain status is empty |
| `modifiedFiles` | number | Tracked changed entries |
| `untrackedFiles` | number | Untracked entries |
| `lastCommitHash` | string | Full commit hash |
| `lastCommitMessage` | string | Subject of the latest commit |
| `lastCommitDate` | string | ISO commit date |
| `remoteOriginUrl` | string | Origin URL |
| `ahead` | number | Commits ahead of the local origin tracking ref |
| `behind` | number | Commits behind the local origin tracking ref |

## Workflow Log

File: `src/data/workflow-log.json`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Unique session identifier; generated if omitted |
| `projectId` | string | yes | Matching project id |
| `sessionTitle` | string | yes | Human-readable session title |
| `date` | string | yes | `YYYY-MM-DD` date |
| `status` | string | yes | `in-progress`, `PASS`, `T100`, `W100`, `WTC`, `T404`, or `W404` |
| `summary` | string | no | Brief work summary |
| `passes` | string[] | yes | Successful checks or completed items |
| `blockers` | string[] | yes | Open problems |
| `nextSteps` | string[] | yes | Follow-up actions |
| `gitStatus` | string | no | Workflow shorthand such as `WTC` |
| `commitHash` | string | no | Related commit |
| `tags` | string[] | yes | Search and filtering labels |

Unknown status strings are retained so the schema can grow without a migration.

## ChatGPT Context

`GET /api/chatgpt/context` returns Markdown generated at request time from:

- The project registry
- Fresh local Git and optional GitHub scans
- Up to three recent workflow logs per project
- Current blockers and next steps
- The configured shorthand glossary

Use `?format=json` to receive `{ "generatedAt": "...", "context": "..." }`.
