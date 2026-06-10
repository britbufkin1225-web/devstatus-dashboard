# DevStatus Dashboard — Project Blueprint

## Project Overview

DevStatus Dashboard is a local-first developer command center for tracking active coding projects, workflow sessions, Git status, GitHub repository metadata, and VS Code workspace commands.

The goal is to give a single dashboard view of current development work across multiple repositories.

---

## Core Purpose

This project is designed to answer:

- What projects are currently active?
- What session or workflow is each project in?
- Which repositories have clean or dirty working trees?
- What was the most recent commit?
- What needs to happen next?
- Which projects have blockers?
- What workflow logs exist for each project?

---

## Planned Features

### Project Tracking

Each project should include:

- Project name
- Project type
- Status
- Local repository path
- GitHub repository URL
- Tech stack
- Current session
- Next step
- Notes
- VS Code open command

### Git Sync

The app should automatically detect:

- Current branch
- Working tree status
- Modified file count
- Untracked file count
- Last commit hash
- Last commit message
- Last commit date
- Remote origin URL

### GitHub Sync

When a GitHub token is available, the app should fetch:

- Repository name
- Description
- Visibility
- Default branch
- Last push date
- Primary language
- Stars
- Forks
- Open issues
- Topics

### Workflow Logs

Workflow logs should be grouped by project and support:

- Session title
- Date
- Status
- Summary
- Passes
- Blockers
- Next steps
- Git status
- Tags

---

## User Workflow Shorthand

| Shorthand | Meaning |
|---|---|
| WTC | Working tree clean |
| Com | Commit to GitHub |
| T100 | Completed task |
| W100 | Completed workflow |
| FIN | Finished testing |
| DStat | Daily project status diagnostic report |
| ftop | From the top |
| lost | Explain as if beginner |
| merg | Merge conflict |
| T404 | Task failed |
| W404 | Workflow failed |
| serv404 | Server failed to start |

---

## Planned Stack

- Node.js
- TypeScript
- Express
- HTML/CSS/JavaScript frontend
- JSON file persistence
- Git CLI integration
- Optional GitHub API integration

---

## Planned Folder Structure

```text
devstatus-dashboard/
  README.md
  package.json
  tsconfig.json
  .env.example
  src/
    server.ts
    config.ts
    types.ts
    services/
    routes/
    data/
  public/
    index.html
    styles.css
    app.js
  docs/
    PROJECT_BLUEPRINT.md
    DEVSTATUS_USAGE.md
    PROJECT_SCHEMA.md