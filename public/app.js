const state = {
  projects: [],
  logs: [],
  summary: null,
  selectedProjectId: null,
  syncResults: new Map()
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char]));
const shortDate = (value) => value ? new Date(value).toLocaleDateString() : "Not available";
const dateTime = (value) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  : "Not available";
const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const tags = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

function badge(text, kind = "info") {
  return `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
}

function statusKind(status) {
  const value = String(status).toLowerCase();
  if (["pass", "t100", "w100", "wtc", "completed", "active"].includes(value)) return "good";
  if (["t404", "w404", "failed", "blocked"].includes(value)) return "bad";
  if (["in-progress", "dirty", "paused"].includes(value)) return "warn";
  return "info";
}

function changedFileCount(project) {
  return (project.git?.modifiedFiles || 0) + (project.git?.untrackedFiles || 0);
}

function aheadBehindLabel(git) {
  if (!git?.remoteOriginUrl) return "No remote configured";
  if (git.ahead == null || git.behind == null) return "Comparison unavailable";
  if (git.ahead === 0 && git.behind === 0) return "Up to date";
  return `${git.ahead} ahead, ${git.behind} behind`;
}

function detailItem(label, value, className = "") {
  return `
    <div class="metadata-item ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

async function copyText(text, message = "Copied to clipboard") {
  await navigator.clipboard.writeText(text);
  showToast(message);
}

function renderSummary() {
  const summary = state.summary;
  if (!summary) return;
  const cards = [
    ["Total projects", summary.totalProjects],
    ["Active projects", summary.activeProjects],
    ["Dirty trees", summary.dirtyWorkingTrees],
    ["Clean trees", summary.cleanWorkingTrees],
    ["Open blockers", summary.openBlockers],
    ["Latest workflow", summary.latestWorkflowSession?.sessionTitle || "No sessions", "latest"]
  ];
  $("#summary-cards").innerHTML = cards.map(([label, value, className = ""]) => `
    <article class="summary-card ${className}">
      <span class="muted">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");
  $("#sync-time").textContent = `Synced ${new Date(summary.lastSyncedAt).toLocaleTimeString()}`;
}

function renderProjects() {
  const body = $("#projects-table");
  body.innerHTML = state.projects.map((project) => {
    const git = project.git || {};
    const documentation = project.documentation || {};
    const github = project.github || {};
    const gitState = !git.available
      ? badge("Git unavailable", "bad")
      : git.clean
        ? badge("Clean", "good")
        : badge(`Dirty · ${changedFileCount(project)} files`, "warn");
    const health = [
      documentation.readmePresent ? badge("README", "good") : badge("README missing", "bad"),
      documentation.docsDirectoryPresent ? badge("Docs", "good") : badge("Docs missing", "warn")
    ].join("");
    const commit = git.lastCommitHash
      ? `${escapeHtml(git.lastCommitHash.slice(0, 7))}<span class="cell-secondary">${escapeHtml(git.lastCommitMessage || "No commit message")}</span>`
      : '<span class="muted">No commits found</span>';
    const githubState = github.available
      ? `${badge("GitHub available", "good")}<span class="cell-secondary">${escapeHtml(aheadBehindLabel(git))}</span>`
      : `${badge("GitHub unavailable", "warn")}<span class="cell-secondary">${escapeHtml(github.error || "Metadata was not returned")}</span>`;
    return `
      <tr data-project-id="${escapeHtml(project.id)}" class="${state.selectedProjectId === project.id ? "selected" : ""}">
        <td>${escapeHtml(project.name)}<span class="cell-secondary">${escapeHtml(project.type)}</span></td>
        <td>${badge(project.status, statusKind(project.status))}</td>
        <td>${escapeHtml(project.currentSession || "Not set")}</td>
        <td>${escapeHtml(git.branch || "Unknown")}</td>
        <td>${gitState}</td>
        <td><div class="badge-list">${health}</div></td>
        <td>${commit}</td>
        <td>${githubState}</td>
        <td><button class="button small copy-code" data-copy="${escapeHtml(project.vscodeOpenCommand || `code "${project.repoPath || ""}"`)}">Copy</button></td>
        <td>${escapeHtml(project.nextStep || "Not set")}</td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="10"><div class="empty-state">No projects are registered yet.</div></td></tr>';

  body.querySelectorAll("tr").forEach((row) => row.addEventListener("click", (event) => {
    if (event.target.closest("button, a")) return;
    selectProject(row.dataset.projectId);
  }));
  body.querySelectorAll(".copy-code").forEach((button) => button.addEventListener("click", () => {
    copyText(button.dataset.copy);
  }));
}

function commandRow(command) {
  return `<div class="command"><code>${escapeHtml(command)}</code><button class="button small command-copy" data-copy="${escapeHtml(command)}">Copy</button></div>`;
}

function selectProject(projectId) {
  state.selectedProjectId = projectId;
  renderProjects();
  renderProjectDetail();
}

function renderProjectDetail() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  const container = $("#project-detail");
  if (!project) {
    state.selectedProjectId = null;
    container.innerHTML = '<div class="empty-state"><div><strong>No project selected</strong><p>Choose a project row above to inspect its Git, documentation, and GitHub metadata.</p></div></div>';
    return;
  }
  const git = project.git || {};
  const documentation = project.documentation || {};
  const github = project.github || {};
  const projectLogs = state.logs.filter((log) => log.projectId === project.id).slice(0, 3);
  const repoPath = project.repoPath || "";
  const quotedPath = `"${repoPath}"`;
  const commands = [
    `cd ${quotedPath}`,
    project.vscodeOpenCommand || `code ${quotedPath}`,
    `git -C ${quotedPath} status`,
    `git -C ${quotedPath} log --oneline -5`
  ];
  const recent = projectLogs.length
    ? projectLogs.map((log) => `<li>${escapeHtml(log.date)} - ${escapeHtml(log.sessionTitle)} ${badge(log.status, statusKind(log.status))}</li>`).join("")
    : "<li>No workflow sessions yet.</li>";
  const syncResult = state.syncResults.get(project.id);
  const fetchStatus = syncResult
    ? `${syncResult.fetchStatus}: ${syncResult.fetchMessage}`
    : "No manual fetch requested this session.";
  const gitBadge = !git.available
    ? badge("Git unavailable", "bad")
    : git.clean
      ? badge("Working tree clean", "good")
      : badge(`Working tree dirty · ${changedFileCount(project)} changed`, "warn");
  const githubBadge = github.available
    ? badge(github.error ? "GitHub available · cached" : "GitHub metadata available", github.error ? "warn" : "good")
    : badge("GitHub metadata unavailable", "warn");
  const remoteBadge = git.remoteOriginUrl
    ? badge("Remote configured", "good")
    : badge("No remote configured", "warn");
  const readmeBadge = documentation.readmePresent
    ? badge("README present", "good")
    : badge("README missing", "bad");
  const docsBadge = documentation.docsDirectoryPresent
    ? badge("Docs folder present", "good")
    : badge("Docs folder missing", "warn");
  const comparisonKind = !git.remoteOriginUrl || git.ahead == null || git.behind == null
    ? "warn"
    : git.behind > 0
      ? "warn"
      : "good";
  const topics = Array.isArray(github.topics) && github.topics.length
    ? github.topics.map((topic) => badge(`#${topic}`)).join("")
    : '<span class="muted">No topics listed</span>';
  const commitTitle = git.lastCommitHash
    ? `${git.lastCommitHash.slice(0, 10)} · ${git.lastCommitMessage || "No commit message"}`
    : "No commit information available";
  const repositoryLink = project.githubUrl && /^https?:\/\//i.test(project.githubUrl)
    ? `<a href="${escapeHtml(project.githubUrl)}" target="_blank" rel="noreferrer">Open GitHub repository</a>`
    : '<span class="muted">No browser URL configured</span>';

  container.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">SELECTED PROJECT</p>
        <h2>${escapeHtml(project.name)}</h2>
        <p class="detail-path">${escapeHtml(repoPath || "No local path configured")}</p>
      </div>
      <div class="detail-heading-status">
        ${gitBadge}
        ${badge(`Refreshed ${dateTime(state.summary?.lastSyncedAt)}`)}
      </div>
    </div>
    ${!git.available ? `<div class="condition-banner bad"><strong>Local repository unavailable</strong><span>${escapeHtml(git.error || "Git metadata could not be read.")}</span></div>` : ""}
    <div class="detail-overview">
      ${detailItem("Branch", git.branch || "Unknown")}
      ${detailItem("Changed files", git.available ? String(changedFileCount(project)) : "Unavailable")}
      ${detailItem("Ahead / behind", aheadBehindLabel(git))}
      ${detailItem("Project status", project.status || "Not set")}
    </div>
    <div class="detail-grid">
      <article class="detail-card detail-card-wide">
        <div class="card-heading">
          <div><p class="eyebrow">SOURCE CONTROL</p><h3>Git repository</h3></div>
          <div class="badge-list">${gitBadge}${remoteBadge}${badge(aheadBehindLabel(git), comparisonKind)}</div>
        </div>
        <div class="metadata-grid">
          ${detailItem("Branch", git.branch || "Unknown")}
          ${detailItem("Modified files", git.available ? String(git.modifiedFiles || 0) : "Unavailable")}
          ${detailItem("Untracked files", git.available ? String(git.untrackedFiles || 0) : "Unavailable")}
          ${detailItem("Remote origin", git.remoteOriginUrl || "No remote configured", "metadata-span")}
          ${detailItem("Last commit", commitTitle, "metadata-span")}
          ${detailItem("Commit date", shortDate(git.lastCommitDate))}
          ${detailItem("Last fetch", fetchStatus, "metadata-span")}
        </div>
      </article>
      <article class="detail-card">
        <div class="card-heading">
          <div><p class="eyebrow">PROJECT HEALTH</p><h3>Documentation</h3></div>
          ${badge(documentation.status || "unavailable", documentation.status === "healthy" ? "good" : documentation.status === "missing" ? "bad" : "warn")}
        </div>
        <div class="badge-list health-badges">${readmeBadge}${docsBadge}</div>
        <p class="card-copy">${documentation.available
          ? `${documentation.documentationFiles || 0} top-level documentation file${documentation.documentationFiles === 1 ? "" : "s"} found.`
          : "Documentation health is unavailable because the project folder could not be scanned."}</p>
      </article>
      <article class="detail-card github-card">
        <div class="card-heading">
          <div><p class="eyebrow">REMOTE METADATA</p><h3>GitHub</h3></div>
          ${githubBadge}
        </div>
        ${github.available ? `
          <p class="github-description">${escapeHtml(github.description || "No repository description provided.")}</p>
          <div class="metadata-grid compact">
            ${detailItem("Visibility", github.visibility || "Unknown")}
            ${detailItem("Language", github.primaryLanguage || "Not specified")}
            ${detailItem("Stars", String(github.stars ?? 0))}
            ${detailItem("Forks", String(github.forks ?? 0))}
            ${detailItem("Open issues", String(github.openIssues ?? 0))}
            ${detailItem("Default branch", github.defaultBranch || "Unknown")}
            ${detailItem("Last pushed", dateTime(github.lastPushedDate))}
            ${detailItem("Last updated", dateTime(github.lastUpdatedDate))}
          </div>
          <div class="topics"><span class="muted">Topics</span><div class="badge-list">${topics}</div></div>
          ${github.error ? `<div class="inline-warning">${escapeHtml(github.error)} Showing the last successful metadata.</div>` : ""}
        ` : `
          <div class="condition-copy">
            <strong>Metadata could not be loaded</strong>
            <p>${escapeHtml(github.error || "No GitHub repository is configured for this project.")}</p>
            <p class="muted">Public repositories can load without a token. Private repositories require GITHUB_TOKEN.</p>
          </div>
        `}
        <div class="card-link">${repositoryLink}</div>
      </article>
      <article class="detail-card">
        <div class="card-heading"><div><p class="eyebrow">LOCAL ACTIONS</p><h3>Commands</h3></div></div>
        <div class="command-list">${commands.map(commandRow).join("")}</div>
      </article>
    </div>
    <div class="detail-lower-grid">
      <article class="detail-card">
        <p class="eyebrow">CURRENT FOCUS</p>
        <h3>${escapeHtml(project.currentSession || "No active session")}</h3>
        <p>${escapeHtml(project.nextStep || "No next step recorded.")}</p>
        <p class="muted">${escapeHtml(project.notes || "No project notes.")}</p>
        <div class="badge-list">${(Array.isArray(project.techStack) ? project.techStack : []).map((item) => badge(item)).join("") || '<span class="muted">No tech stack recorded</span>'}</div>
      </article>
      <article class="detail-card">
        <p class="eyebrow">RECENT ACTIVITY</p>
        <h3>Workflow sessions</h3>
        <ul class="recent-workflow">${recent}</ul>
      </article>
    </div>
  `;
  document.querySelectorAll(".command-copy").forEach((button) => button.addEventListener("click", () => {
    copyText(button.dataset.copy);
  }));
}

function populateSelects() {
  const options = state.projects.map((project) =>
    `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`
  ).join("");
  $("#log-project").innerHTML = options;
  $("#filter-project").innerHTML = `<option value="">All projects</option>${options}`;
  const statuses = [...new Set(state.logs.map((log) => log.status))].sort();
  $("#filter-status").innerHTML = '<option value="">All statuses</option>' +
    statuses.map((status) => `<option>${escapeHtml(status)}</option>`).join("");
}

function renderWorkflow() {
  const projectFilter = $("#filter-project").value;
  const statusFilter = $("#filter-status").value;
  const tagFilter = $("#filter-tag").value.trim().toLowerCase();
  const logs = [...state.logs]
    .filter((log) => !projectFilter || log.projectId === projectFilter)
    .filter((log) => !statusFilter || log.status === statusFilter)
    .filter((log) => !tagFilter || log.tags.some((tag) => tag.toLowerCase().includes(tagFilter)))
    .sort((a, b) => b.date.localeCompare(a.date));

  $("#workflow-timeline").innerHTML = logs.length ? logs.map((log) => {
    const project = state.projects.find((item) => item.id === log.projectId);
    const cardClass = ["T404", "W404"].includes(log.status) ? "failed" :
      ["PASS", "T100", "W100", "WTC"].includes(log.status) ? "complete" : "";
    const list = (title, values) => `<div><strong>${title}</strong><ul>${values.length ? values.map((value) => `<li>${escapeHtml(value)}</li>`).join("") : "<li>None</li>"}</ul></div>`;
    return `
      <article class="log-card ${cardClass}">
        <div class="log-top">
          <div>
            <div class="log-meta">${badge(log.status, statusKind(log.status))}<span class="muted">${escapeHtml(log.date)} | ${escapeHtml(project?.name || log.projectId)}</span></div>
            <h3>${escapeHtml(log.sessionTitle)}</h3>
          </div>
          <button class="button small edit-log" data-log-id="${escapeHtml(log.id)}">Edit</button>
        </div>
        <p>${escapeHtml(log.summary || "No summary.")}</p>
        <div class="tag-list">${log.gitStatus ? badge(log.gitStatus, statusKind(log.gitStatus)) : ""}${log.tags.map((tag) => badge(`#${tag}`)).join("")}</div>
        <div class="log-lists">${list("Passes", log.passes)}${list("Blockers", log.blockers)}${list("Next steps", log.nextSteps)}</div>
      </article>
    `;
  }).join("") : '<div class="empty-state">No workflow logs match these filters.</div>';

  document.querySelectorAll(".edit-log").forEach((button) => button.addEventListener("click", () => editLog(button.dataset.logId)));
}

function editLog(id) {
  const log = state.logs.find((item) => item.id === id);
  if (!log) return;
  $("#log-id").value = log.id;
  $("#log-project").value = log.projectId;
  $("#log-title").value = log.sessionTitle;
  $("#log-status").value = log.status;
  $("#log-date").value = log.date;
  $("#log-summary").value = log.summary;
  $("#log-passes").value = log.passes.join("\n");
  $("#log-blockers").value = log.blockers.join("\n");
  $("#log-next").value = log.nextSteps.join("\n");
  $("#log-tags").value = log.tags.join(", ");
  $("#log-git").value = log.gitStatus;
  $("#form-title").textContent = "Edit Workflow Log";
  $("#cancel-edit").classList.remove("hidden");
  $("#workflow-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  $("#workflow-form").reset();
  $("#log-id").value = "";
  $("#log-date").value = new Date().toISOString().slice(0, 10);
  $("#form-title").textContent = "Add Workflow Log";
  $("#cancel-edit").classList.add("hidden");
}

async function saveLog(event) {
  event.preventDefault();
  const id = $("#log-id").value;
  const payload = {
    projectId: $("#log-project").value,
    sessionTitle: $("#log-title").value,
    status: $("#log-status").value,
    date: $("#log-date").value,
    summary: $("#log-summary").value,
    passes: lines($("#log-passes").value),
    blockers: lines($("#log-blockers").value),
    nextSteps: lines($("#log-next").value),
    tags: tags($("#log-tags").value),
    gitStatus: $("#log-git").value
  };
  await api(id ? `/api/workflow/${id}` : "/api/workflow", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
  resetForm();
  await loadDashboard(false);
  showToast(id ? "Workflow log updated" : "Workflow log added");
}

async function loadDashboard(syncProjects = true) {
  const [projects, logs] = await Promise.all([
    api("/api/projects"),
    api("/api/workflow")
  ]);
  state.projects = projects;
  state.logs = logs;
  state.summary = await api("/api/status");
  renderSummary();
  renderProjects();
  populateSelects();
  renderWorkflow();
  renderProjectDetail();
}

function setSyncState(loading, message = "", kind = "") {
  const refreshButton = $("#refresh-metadata");
  const fetchButton = $("#fetch-refresh");
  refreshButton.disabled = loading;
  fetchButton.disabled = loading;
  refreshButton.textContent = loading ? "Refreshing..." : "Refresh Metadata";
  fetchButton.textContent = loading ? "Refreshing..." : "Fetch + Refresh";
  const status = $("#sync-status");
  status.textContent = message;
  status.className = `sync-status ${kind || "muted"}`;
}

async function syncNow(fetchRemote = false) {
  setSyncState(
    true,
    fetchRemote
      ? "Fetching remote-tracking refs, then refreshing metadata..."
      : "Refreshing local metadata..."
  );
  try {
    const result = await api(fetchRemote ? "/api/refresh" : "/api/sync", {
      method: "POST",
      body: JSON.stringify({})
    });
    state.projects = result.projects;
    state.summary = result.summary;
    state.syncResults = new Map(
      (result.results || []).map((item) => [item.projectId, item])
    );
    state.logs = await api("/api/workflow");
    renderSummary();
    renderProjects();
    populateSelects();
    renderWorkflow();
    renderProjectDetail();
    const failures = (result.results || []).filter(
      (item) => item.fetchStatus === "failed"
    );
    const successes = (result.results || []).filter(
      (item) => item.fetchStatus === "success"
    );
    const warnings = result.errors || [];
    const message = fetchRemote
      ? warnings.length
        ? `Metadata refreshed with warnings (${warnings.length}): ${warnings[0].message}`
        : `Metadata refreshed (${successes.length} repositories fetched).`
      : "Local Git and GitHub metadata refreshed.";
    setSyncState(false, message, warnings.length || failures.length ? "error" : "success");
    showToast(message);
  } catch (error) {
    setSyncState(false, error.message, "error");
    throw error;
  }
}

async function copyForChatGpt() {
  const button = $("#chatgpt-sync");
  button.disabled = true;
  button.textContent = "Preparing...";
  try {
    const response = await fetch("/api/chatgpt/context");
    if (!response.ok) throw new Error("Could not generate ChatGPT context");
    await copyText(await response.text(), "Project context copied for ChatGPT");
  } finally {
    button.disabled = false;
    button.textContent = "Copy for ChatGPT";
  }
}

$("#refresh-metadata").addEventListener("click", () => syncNow(false).catch((error) => showToast(error.message)));
$("#fetch-refresh").addEventListener("click", () => syncNow(true).catch((error) => showToast(error.message)));
$("#chatgpt-sync").addEventListener("click", () => copyForChatGpt().catch((error) => showToast(error.message)));
$("#workflow-form").addEventListener("submit", (event) => saveLog(event).catch((error) => showToast(error.message)));
$("#cancel-edit").addEventListener("click", resetForm);
["#filter-project", "#filter-status"].forEach((selector) => $(selector).addEventListener("change", renderWorkflow));
$("#filter-tag").addEventListener("input", renderWorkflow);

resetForm();
loadDashboard().catch((error) => showToast(error.message));
