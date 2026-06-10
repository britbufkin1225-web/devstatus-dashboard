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
const shortDate = (value) => value ? new Date(value).toLocaleDateString() : "n/a";
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
    const gitState = !project.git.available
      ? badge("Unavailable", "bad")
      : project.git.clean
        ? badge("WTC", "good")
        : badge(`Dirty ${project.git.modifiedFiles + project.git.untrackedFiles}`, "warn");
    const commit = project.git.lastCommitHash
      ? `${escapeHtml(project.git.lastCommitHash.slice(0, 7))}<span class="cell-secondary">${escapeHtml(project.git.lastCommitMessage || "")}</span>`
      : '<span class="muted">n/a</span>';
    return `
      <tr data-project-id="${escapeHtml(project.id)}" class="${state.selectedProjectId === project.id ? "selected" : ""}">
        <td>${escapeHtml(project.name)}<span class="cell-secondary">${escapeHtml(project.type)}</span></td>
        <td>${badge(project.status, statusKind(project.status))}</td>
        <td>${escapeHtml(project.currentSession || "Not set")}</td>
        <td>${escapeHtml(project.git.branch || "n/a")}</td>
        <td>${gitState}</td>
        <td>${commit}</td>
        <td>${project.githubUrl ? `<a href="${escapeHtml(project.githubUrl)}" target="_blank" rel="noreferrer">Open repo</a>` : '<span class="muted">Not set</span>'}</td>
        <td><button class="button small copy-code" data-copy="${escapeHtml(project.vscodeOpenCommand)}">Copy</button></td>
        <td>${escapeHtml(project.nextStep || "Not set")}</td>
      </tr>
    `;
  }).join("");

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
  if (!project) return;
  const projectLogs = state.logs.filter((log) => log.projectId === project.id).slice(0, 3);
  const quotedPath = `"${project.repoPath}"`;
  const commands = [
    `cd ${quotedPath}`,
    project.vscodeOpenCommand || `code ${quotedPath}`,
    `git -C ${quotedPath} status`,
    `git -C ${quotedPath} log --oneline -5`
  ];
  const github = project.github.available
    ? `${project.github.visibility} | ${project.github.primaryLanguage || "No language"} | ${project.github.stars} stars | ${project.github.openIssues} issues`
    : project.github.error || "GitHub metadata unavailable";
  const recent = projectLogs.length
    ? projectLogs.map((log) => `<li>${escapeHtml(log.date)} - ${escapeHtml(log.sessionTitle)} ${badge(log.status, statusKind(log.status))}</li>`).join("")
    : "<li>No workflow sessions yet.</li>";
  const syncResult = state.syncResults.get(project.id);
  const fetchStatus = syncResult
    ? `${syncResult.fetchStatus}: ${syncResult.fetchMessage}`
    : "No manual fetch requested this session.";

  $("#project-detail").innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">PROJECT DETAIL</p><h2>${escapeHtml(project.name)}</h2></div>
      ${badge(project.git.available ? (project.git.clean ? "Working tree clean" : "Working tree dirty") : "Repository unavailable", project.git.available ? (project.git.clean ? "good" : "warn") : "bad")}
    </div>
    <div class="detail-grid">
      <article class="detail-card">
        <h3>Project</h3>
        <dl>
          <dt>Path</dt><dd>${escapeHtml(project.repoPath || "Not set")}</dd>
          <dt>Stack</dt><dd>${escapeHtml(project.techStack.join(", ") || "Not set")}</dd>
          <dt>Session</dt><dd>${escapeHtml(project.currentSession || "Not set")}</dd>
          <dt>Next</dt><dd>${escapeHtml(project.nextStep || "Not set")}</dd>
          <dt>Docs</dt><dd>${escapeHtml(project.documentation.status)} - README ${project.documentation.readmePresent ? "present" : "missing"}, docs folder ${project.documentation.docsDirectoryPresent ? "present" : "missing"}</dd>
          <dt>Notes</dt><dd>${escapeHtml(project.notes || "None")}</dd>
        </dl>
      </article>
      <article class="detail-card">
        <h3>Git + GitHub</h3>
        <dl>
          <dt>Branch</dt><dd>${escapeHtml(project.git.branch || "n/a")}</dd>
          <dt>Changes</dt><dd>${project.git.modifiedFiles} modified, ${project.git.untrackedFiles} untracked</dd>
          <dt>Ahead/behind</dt><dd>${project.git.ahead ?? "n/a"} / ${project.git.behind ?? "n/a"}</dd>
          <dt>Last fetch</dt><dd>${escapeHtml(fetchStatus)}</dd>
          <dt>Last commit</dt><dd>${escapeHtml(project.git.lastCommitMessage || "n/a")} (${shortDate(project.git.lastCommitDate)})</dd>
          <dt>GitHub</dt><dd>${escapeHtml(github)}</dd>
        </dl>
      </article>
      <article class="detail-card">
        <h3>Commands</h3>
        <div class="command-list">${commands.map(commandRow).join("")}</div>
      </article>
    </div>
    <article class="detail-card" style="margin-top: 16px">
      <h3>Recent workflow</h3>
      <ul>${recent}</ul>
    </article>
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
  if (state.selectedProjectId) renderProjectDetail();
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
    if (state.selectedProjectId) renderProjectDetail();
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
