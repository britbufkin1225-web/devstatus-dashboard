# DevStatus Dashboard

DevStatus Dashboard is a local-first command center for active software projects. It combines an editable JSON project registry with live Git metadata, optional GitHub metadata, workflow session logs, VS Code commands, and a ChatGPT-ready status snapshot.

## Features

- Live branch, clean/dirty state, changed file counts, last commit, origin, and ahead/behind status
- README and top-level documentation folder health
- Optional GitHub repository description, stars, forks, issues, visibility, language, topics, and push date
- JSON-backed projects and workflow logs with no database
- Project summary cards, detail view, workflow timeline, filters, and editable workflow entries
- Copy buttons for `cd`, `code`, `git status`, and recent log commands
- ChatGPT context export built from the latest dashboard data
- Safe handling for missing paths, non-Git folders, unavailable remotes, and missing tokens

## Requirements

- Node.js 18 or newer
- Git available on `PATH`
- A modern browser

## Install and Run

```powershell
cd devstatus-dashboard
npm install
Copy-Item .env.example .env
npm run dev
```

Open [http://localhost:3030](http://localhost:3030).

For a production-style run:

```powershell
npm run build
npm start
```

## Configure Projects

Edit `src/data/projects.json`. The included entries are placeholders and are expected to report unavailable repositories until their paths and URLs are changed.

```json
{
  "id": "my-api",
  "name": "My API",
  "type": "backend-api",
  "status": "active",
  "repoPath": "C:/Users/me/Documents/my-api",
  "githubUrl": "https://github.com/me/my-api",
  "defaultBranch": "main",
  "techStack": ["Node.js", "TypeScript"],
  "currentSession": "Add request validation",
  "nextStep": "Test invalid payloads",
  "notes": "Portfolio API",
  "vscodeOpenCommand": "code \"C:/Users/me/Documents/my-api\""
}
```

Projects can also be created and patched through `POST /api/projects` and `PATCH /api/projects/:id`.

## Git and GitHub Sync

Git metadata is read with local `git` commands. The dashboard does not modify repositories, fetch remotes, commit, push, or delete files. Ahead/behind counts are based on the local remote-tracking ref, so they reflect the last fetch performed outside this app.

Public GitHub repository metadata can usually be read without a token, subject to low anonymous rate limits. Add a token to `.env` for private repositories and higher limits:

```dotenv
GITHUB_TOKEN=github_pat_your_token
```

The token is used only by the local server and is never sent to the browser. Restart the server after changing `.env`.

## VS Code Commands

Each project exposes copyable commands for changing directory, opening the folder in VS Code, checking Git status, and viewing five recent commits. The app copies commands; it does not execute VS Code or shell commands from the browser.

## Workflow Logs

Workflow sessions are stored in `src/data/workflow-log.json`. Add or edit them in the dashboard. Lists such as passes and blockers use one item per line; tags are comma-separated.

```json
{
  "id": "session-005",
  "projectId": "work-timer",
  "sessionTitle": "Session 5 - Validation",
  "date": "2026-06-10",
  "status": "in-progress",
  "summary": "Added the validation foundation.",
  "passes": ["Routes verified"],
  "blockers": [],
  "nextSteps": ["Test invalid payloads"],
  "gitStatus": "WTC",
  "commitHash": "",
  "tags": ["backend", "validation"]
}
```

## ChatGPT Context Sync

Click **Copy for ChatGPT** to generate and copy a Markdown snapshot containing project status, Git details, recent workflows, blockers, next steps, and shorthand definitions. Paste it into a ChatGPT conversation as current project context.

The endpoint is:

```text
GET /api/chatgpt/context
GET /api/chatgpt/context?format=json
```

This does not silently write to ChatGPT account Memory. ChatGPT does not expose a general local-app API for directly changing that memory. The explicit copied snapshot keeps the user in control and prevents stale status from being saved without review.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/status` | Dashboard summary |
| GET | `/api/projects` | Projects with live Git/GitHub metadata |
| GET | `/api/projects/:id` | Full project detail and workflow logs |
| POST | `/api/projects` | Add a project |
| PATCH | `/api/projects/:id` | Update a project |
| GET | `/api/workflow` | All logs, with optional query filters |
| GET | `/api/workflow/project/:projectId` | Project logs |
| POST | `/api/workflow` | Add a workflow log |
| PATCH | `/api/workflow/:id` | Update a workflow log |
| POST | `/api/sync` | Refresh live metadata |
| GET | `/api/chatgpt/context` | Generate ChatGPT-ready context |

## Known Limitations

- JSON persistence is intended for one local user, not concurrent multi-user writes.
- GitHub calls can be rate-limited, especially without a token.
- Ahead/behind information does not run `git fetch` and may be stale.
- Documentation checks inspect the repository root and the first level of `docs/`; they do not score document quality or recurse through nested folders.
- Browser clipboard access may require localhost and a user click.
