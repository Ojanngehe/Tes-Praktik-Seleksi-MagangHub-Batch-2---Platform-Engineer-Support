// Dashboard Status Container (Soal 1)
// Mengambil data container dari Docker API via proxy nginx (same-origin,
// sehingga bisa pakai path relatif: /containers/json).

const API_BASE = "";

const $ = (id) => document.getElementById(id);

const ENV_LABEL = "com.project.env";

const UNKNOWN_ENV = "unknown";

const BROKEN_STATES = ["restarting", "exited", "dead"];

const statusBadgeClass = (status) => {
  if (status.startsWith("up")) return "st-running";
  if (status.startsWith("restarting")) return "st-restarting";
  if (status === "created") return "st-created";
  return "st-exited";
};

const envBadgeClass = (env) => `env-${env}`;

function setStatus(msg, busy) {
  const el = $("status");

  el.innerHTML = busy ? `<span class="spinner"></span> ${msg}` : msg;
}

function showError(msg) {
  const el = $("error");

  el.style.display = "block";
  el.textContent = msg;
}

function groupByEnv(containers) {
  const groups = {};

  for (const c of containers) {
    const env = c.Labels?.[ENV_LABEL] || UNKNOWN_ENV;

    if (!groups[env]) {
      groups[env] = [];
    }

    groups[env].push(c);
  }

  return groups;
}

function escapeHtml(text) {
  const div = document.createElement("div");

  div.textContent = text == null ? "" : String(text);

  return div.innerHTML;
}

function renderCard(c) {
  const name = c.Names?.[0] || c.Id;

  const cleanName = name.replace(/^\//, "");

  const image = c.DisplayImage || c.Image || "n/a";

  const env = c.Labels?.[ENV_LABEL] || UNKNOWN_ENV;

  const status = (c.Status || c.State || "").toLowerCase();

  const shortId = (c.Id || "").slice(0, 12);

  const created = c.Created
    ? new Date(c.Created * 1000).toLocaleString("id-ID")
    : "n/a";

  const broken = BROKEN_STATES.some((s) => status.includes(s));

  return `
    <div class="card ${broken ? "broken" : ""}">
      <div class="card-head">
        <span class="name">${escapeHtml(cleanName)}</span>
        <span class="status-badge ${statusBadgeClass(status)}">${escapeHtml(c.Status || c.State || "?")}</span>
      </div>

      <div class="row">
        <span class="label">Image</span>
        <span class="value">${escapeHtml(image)}</span>
      </div>

      <div class="row">
        <span class="label">Environment</span>
        <span class="value">${escapeHtml(env)}</span>
      </div>

      <div class="row">
        <span class="label">Container ID</span>
        <span class="value">${escapeHtml(shortId)}</span>
      </div>

      <div class="row">
        <span class="label">Created</span>
        <span class="value">${escapeHtml(created)}</span>
      </div>
    </div>
  `;
}

function render(containers) {
  const groups = groupByEnv(containers);

  const host = $("groups");

  host.innerHTML = "";

  const envOrder = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  for (const env of envOrder) {
    const list = groups[env];

    const section = document.createElement("section");

    section.className = "env-group";

    section.innerHTML = `
      <h2>
        <span class="env-badge ${envBadgeClass(env)}">${escapeHtml(env)}</span>
        <span class="count">${list.length}</span>
      </h2>

      <div class="card-grid">
        ${list.map(renderCard).join("")}
      </div>
    `;

    host.appendChild(section);
  }

  if (envOrder.length === 0) {
    host.innerHTML = '<div class="empty">Tidak ada container ditemukan.</div>';
  }
}

async function inspectContainer(containerId) {
  const res = await fetch(`${API_BASE}/containers/${containerId}/json`);

  if (!res.ok) {
    throw new Error(`Gagal inspect container: HTTP ${res.status}`);
  }

  return res.json();
}

async function resolveContainerImages(containers) {
  return Promise.all(
    containers.map(async (c) => {
      if (c.Image && !c.Image.startsWith("sha256:")) {
        return {
          ...c,
          DisplayImage: c.Image,
        };
      }

      try {
        const detail = await inspectContainer(c.Id);

        return {
          ...c,
          DisplayImage: detail.Config?.Image || c.Image || "n/a",
        };
      } catch (err) {
        return {
          ...c,
          DisplayImage: c.Image || "n/a",
        };
      }
    }),
  );
}

function extractTag(image) {
  if (!image) return "unknown";

  const withoutDigest = image.split("@")[0];

  const lastSlash = withoutDigest.lastIndexOf("/");

  const lastColon = withoutDigest.lastIndexOf(":");

  if (lastColon > lastSlash) {
    return withoutDigest.slice(lastColon + 1);
  }

  return "latest";
}

async function checkDeploymentVersion(containers) {
  try {
    const desiredRes = await fetch("/desired-state.json");

    if (!desiredRes.ok) {
      throw new Error(`desired-state.json: HTTP ${desiredRes.status}`);
    }

    const desired = await desiredRes.json();

    $("version-service").textContent = desired.service;

    $("version-expected").textContent = desired.expected_tag;

    const target = containers.find((c) => {
      const composeService = c.Labels?.["com.docker.compose.service"];

      return (
        composeService === desired.service ||
        (c.Names || []).some((name) => name.includes(desired.service))
      );
    });

    const statusEl = $("version-status");

    if (!target || target.State !== "running") {
      $("version-actual").textContent = "-";

      statusEl.textContent = "SERVICE NOT RUNNING";

      statusEl.className = "version-not-running";

      return;
    }

    let configuredImage = target.DisplayImage || target.Image;

    if (!configuredImage || configuredImage.startsWith("sha256:")) {
      const detail = await inspectContainer(target.Id);

      configuredImage = detail.Config?.Image || configuredImage;
    }

    const actualTag = extractTag(configuredImage);

    $("version-actual").textContent = actualTag;

    if (actualTag === desired.expected_tag) {
      statusEl.textContent = "MATCH";
      statusEl.className = "version-match";
    } else {
      statusEl.textContent = "MISMATCH";
      statusEl.className = "version-mismatch";
    }
  } catch (err) {
    $("version-status").textContent = "ERROR";

    $("version-status").className = "version-mismatch";

    console.error("Version check failed:", err);
  }
}

async function fetchContainers() {
  setStatus("Memuat data...", true);

  $("error").style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/containers/json?all=1`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const rawContainers = await res.json();

    const containers = await resolveContainerImages(rawContainers);

    render(containers);

    await checkDeploymentVersion(containers);

    const total = containers.length;

    const broken = containers.filter((c) =>
      BROKEN_STATES.some((s) => (c.Status || "").toLowerCase().includes(s)),
    ).length;

    setStatus(`${total} container · ${broken} bermasalah`, false);
  } catch (err) {
    showError(`Gagal mengambil data dari Docker API: ${err.message}`);

    setStatus("Gagal", false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("refresh").addEventListener("click", fetchContainers);

  fetchContainers();

  setInterval(fetchContainers, 5000);
});
