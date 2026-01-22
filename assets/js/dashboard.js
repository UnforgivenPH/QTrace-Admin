import { db } from "./config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const statRow = document.getElementById("statRow");
const projectTbody = document.querySelector("#projectTable tbody");
const milestoneTbody = document.querySelector("#milestoneTable tbody");
const activityList = document.getElementById("activityList");
const alertList = document.getElementById("alertList");
const todayLabel = document.getElementById("todayLabel");

todayLabel.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const peso = (val = 0) => `₱${Number(val || 0).toLocaleString()}`;

function fmtDate(val) {
  if (!val) return "--";
  try {
    if (val.toDate) return val.toDate().toISOString().slice(0, 10);
    return new Date(val).toISOString().slice(0, 10);
  } catch (e) {
    return "--";
  }
}

async function getCount(colName) {
  try {
    const snap = await getCountFromServer(collection(db, colName));
    return snap.data().count || 0;
  } catch (e) {
    return 0;
  }
}

async function loadStats() {
  try {
    const [projectCount, articleCount, contractorCount, userCount] =
      await Promise.all([
        getCount("projects"),
        getCount("articles"),
        getCount("contractors"),
        getCount("users"),
      ]);

    const stats = [
      {
        label: "Projects",
        value: projectCount,
        change: "",
        icon: "bi-kanban",
        color: "primary",
      },
      {
        label: "Articles",
        value: articleCount,
        change: "",
        icon: "bi-newspaper",
        color: "success",
      },
      {
        label: "Contractors",
        value: contractorCount,
        change: "",
        icon: "bi-people",
        color: "warning",
      },
      {
        label: "Users",
        value: userCount,
        change: "",
        icon: "bi-person-badge",
        color: "info",
      },
    ];

    statRow.innerHTML = stats
      .map(
        (s) => `
        <div class="col-12 col-md-6 col-xl-3">
          <div class="card stat-card h-100">
            <div class="card-body d-flex flex-column gap-2">
              <div class="d-flex align-items-center justify-content-between">
                <span class="badge badge-soft text-uppercase small">${s.label}</span>
                <i class="bi ${s.icon} fs-4 text-${s.color}"></i>
              </div>
              <h3 class="mb-0">${s.value}</h3>
              <span class="text-muted small">${s.change || ""}</span>
            </div>
          </div>
        </div>
      `,
      )
      .join("");
  } catch (err) {
    console.error("Stats load error", err);
    statRow.innerHTML = '<div class="text-danger">Error loading stats</div>';
  }
}

async function loadProjects() {
  try {
    const q = query(
      collection(db, "projects"),
      orderBy("createdAt", "desc"),
      limit(6),
    );
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const status = p.status || "Ongoing";

      // Only show active projects (not Finished)
      if (status !== "Finished") {
        const badgeClass = status === "Delayed" ? "bg-danger" : "bg-primary";
        rows.push(`
          <tr>
            <td class="fw-semibold">${p.title || "Untitled Project"}</td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
            <td>${p.contractor || p.contractorId || "N/A"}</td>
            <td>${p.address?.barangay || "N/A"}</td>
            <td class="text-end">${peso(p.budget)}</td>
          </tr>
        `);
      }
    });
    projectTbody.innerHTML =
      rows.join("") ||
      '<tr><td colspan="5" class="text-center">No active projects</td></tr>';
  } catch (err) {
    console.error("Projects load error", err);
    projectTbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error loading projects</td></tr>`;
  }
}

async function loadMilestones() {
  try {
    const q = query(
      collection(db, "projects"),
      orderBy("createdAt", "desc"),
      limit(15),
    );
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const projectTitle = p.title || "Untitled";
      const milestones = Array.isArray(p.milestones) ? p.milestones : [];
      const endDate = fmtDate(p.dates?.end);
      if (milestones.length === 0) {
        rows.push(`
          <tr>
            <td>${projectTitle}</td>
            <td>—</td>
            <td>${endDate}</td>
            <td><span class="badge bg-light text-dark">Planned</span></td>
          </tr>
        `);
      } else {
        milestones.forEach((m) => {
          const mDate = fmtDate(
            m.dateUploaded || p.dates?.end || p.dates?.started,
          );
          rows.push(`
            <tr>
              <td>${projectTitle}</td>
              <td>${m.type || "Milestone"}</td>
              <td>${mDate}</td>
              <td><span class="badge bg-light text-dark">${m.status || "In Progress"}</span></td>
            </tr>
          `);
        });
      }
    });
    milestoneTbody.innerHTML =
      rows.slice(0, 8).join("") ||
      '<tr><td colspan="4" class="text-center">No milestones yet</td></tr>';
  } catch (err) {
    console.error("Milestones load error", err);
    milestoneTbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error loading milestones</td></tr>`;
  }
}

async function loadActivities() {
  try {
    const q = query(
      collection(db, "articles"),
      orderBy("article_created_at", "desc"),
      limit(6),
    );
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((docSnap) => {
      const a = docSnap.data();
      const when = fmtDate(a.article_created_at);
      items.push({
        text: a.article_description || a.article_type || "Article",
        when,
      });
    });
    if (items.length === 0) {
      activityList.innerHTML = '<div class="text-muted">No activity yet</div>';
      return;
    }
    activityList.innerHTML = items
      .map(
        (a) => `
          <div class="position-relative mb-3 ps-2">
            <span class="timeline-dot"></span>
            <div class="fw-semibold">${a.text}</div>
            <div class="text-muted small">${a.when}</div>
          </div>
        `,
      )
      .join("");
  } catch (err) {
    console.error("Activity load error", err);
    activityList.innerHTML =
      '<div class="text-danger">Error loading activity</div>';
  }
}

async function loadAlerts() {
  try {
    const snap = await getDocs(collection(db, "projects"));
    let delayed = 0;
    let dueSoon = 0;
    const today = new Date();
    const soon = new Date();
    soon.setDate(today.getDate() + 14);

    snap.forEach((docSnap) => {
      const p = docSnap.data();
      if ((p.status || "").toLowerCase() === "delayed") delayed += 1;
      const end = p.dates?.end
        ? new Date(p.dates.end.toDate ? p.dates.end.toDate() : p.dates.end)
        : null;
      if (end && end >= today && end <= soon) dueSoon += 1;
    });

    const alerts = [];
    if (delayed > 0) alerts.push(`${delayed} project(s) marked Delayed.`);
    if (dueSoon > 0)
      alerts.push(`${dueSoon} project(s) ending within 14 days.`);
    if (alerts.length === 0) alerts.push("All clear. No alerts.");

    alertList.innerHTML = alerts
      .map(
        (a) => `
          <div class="d-flex align-items-start gap-2 mb-2">
            <i class="bi bi-exclamation-triangle text-warning"></i>
            <span>${a}</span>
          </div>
        `,
      )
      .join("");
  } catch (err) {
    console.error("Alerts load error", err);
    alertList.innerHTML = '<div class="text-danger">Error loading alerts</div>';
  }
}

loadStats();
loadProjects();
loadMilestones();
loadActivities();
loadAlerts();
