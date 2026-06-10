# DevStatus Usage Guide

## 1. Start the Dashboard

Open PowerShell in the `devstatus-dashboard` folder:

```powershell
npm install
npm run dev
```

Visit `http://localhost:3030`. Keep the PowerShell window open while using the dashboard.

## 2. Point It at Your Projects

Open `src/data/projects.json`. Replace each placeholder `repoPath` and `githubUrl` with the real values. Windows paths may use forward slashes, which keeps the JSON easy to read.

Example:

```json
"repoPath": "C:/Users/britb/Documents/zerosoc",
"githubUrl": "https://github.com/your-name/zerosoc"
```

Save the file, then click **Sync Now** in the dashboard.

## 3. Read Git Status

- **WTC** means the working tree is clean.
- **Dirty** means Git sees modified, staged, deleted, or untracked files.
- **Unavailable** means the path is missing, is not a Git repository, or Git could not inspect it.
- **Ahead/behind** compares the current commit with the locally known `origin/defaultBranch`.

The dashboard only reads Git information. It will not commit, push, fetch, reset, or delete anything.

## 4. Add a Workflow Session

Use the form on the right:

1. Pick a project.
2. Enter the session title and status.
3. Write a short summary.
4. Put one pass, blocker, or next step on each line.
5. Enter comma-separated tags.
6. Save the log.

Use **Edit** on any session card to update it.

## 5. Filter Workflow Logs

Use the project and status menus above the timeline. The tag box matches partial tag text, so entering `back` will match `backend`.

## 6. Open a Project in VS Code

Select a project row. Its detail panel provides commands you can copy:

```powershell
cd "C:/path/to/project"
code "C:/path/to/project"
git -C "C:/path/to/project" status
git -C "C:/path/to/project" log --oneline -5
```

Paste the selected command into PowerShell.

## 7. Use the Status in ChatGPT

Click **Copy for ChatGPT**. The dashboard refreshes project metadata and copies a readable status snapshot. Paste that snapshot into ChatGPT and ask it to use the information as the current source of truth.

For example:

```text
Use this DevStatus snapshot for our session. Give me a DStat, then recommend the next task.
```

This explicit copy is the sync step. The app cannot directly change ChatGPT account Memory, and your project data stays local until you choose to paste it.

## 8. Shorthand

| Code | Meaning |
| --- | --- |
| WTC | Working tree clean |
| Com | Commit to GitHub |
| T100 | Completed task |
| W100 | Completed workflow |
| FIN | Finished testing |
| DStat | Daily project status diagnostic report |
| ftop | From the top |
| lost | Explain as if I am a beginner |
| merg | Merge conflict |
| T404 | Task failed |
| W404 | Workflow failed |
| serv404 | Server failed to start |

## Troubleshooting

- If the server does not start, check that Node.js 18+ is installed and run `npm install`.
- If Git is unavailable, run `git --version` in PowerShell.
- If a repository is unavailable, verify its exact `repoPath`.
- If GitHub metadata fails, verify the URL and optionally add `GITHUB_TOKEN` to `.env`.
- If clipboard copying fails, access the app through `http://localhost:3030` and click the button again.
