import { db } from "./config.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  getDoc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const IMGBB_KEY = "679c2ed64c23cfbde43bf6fdb94aaed6";
let currentUserId = "admin";

// --- 1. UPLOAD IMAGE ---
async function uploadImg(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("ImgBB Upload Failed.");
  const data = await res.json();
  return data.data.url;
}

// Utility: show preview image or hide if none
function setPreview(imgEl, url) {
  if (!imgEl) return;
  if (url) {
    imgEl.src = url;
    imgEl.classList.remove("d-none");
  } else {
    imgEl.src = "";
    imgEl.classList.add("d-none");
  }
}

// --- 2. LOAD PROJECTS DROPDOWN ---
async function loadProjects(selectIds = ["projectId", "editProjectId"]) {
  const selects = selectIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!selects.length) return;

  const snap = await getDocs(collection(db, "projects"));
  const options = ['<option value="">-- General News (No Project) --</option>'];
  snap.forEach((d) => {
    options.push(`<option value="${d.id}">${d.data().title}</option>`);
  });

  const optionsHtml = options.join("");
  selects.forEach((select) => {
    select.innerHTML = optionsHtml;
  });
}

// --- 3. SUBMIT ARTICLE ---
const articleForm = document.getElementById("articleForm");
if (articleForm) {
  const createPreview = document.getElementById("createPhotoPreview");
  const createFileInput = document.getElementById("articlePhoto");
  const createUrlInput = document.getElementById("articlePhotoUrl");

  if (createFileInput) {
    createFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      setPreview(createPreview, file ? URL.createObjectURL(file) : "");
    });
  }

  if (createUrlInput) {
    createUrlInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      setPreview(createPreview, val);
    });
  }

  articleForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const projectId = document.getElementById("projectId").value;
    const btn = document.getElementById("publishBtn");
    btn.disabled = true;
    btn.innerText = "Publishing...";

    try {
      let photoUrl = "";
      const photoFile = document.getElementById("articlePhoto").files[0];
      const photoUrlInput = document.getElementById("articlePhotoUrl").value;

      if (photoFile) {
        photoUrl = await uploadImg(photoFile);
      } else if (photoUrlInput) {
        photoUrl = photoUrlInput;
      }

      const article = {
        // Allows empty string for General News
        project_id: projectId || "",
        user_id: currentUserId,

        // ✅ New Title Field
        article_title: document.getElementById("articleTitle").value,

        article_type: document.getElementById("articleType").value,
        article_description:
          document.getElementById("articleDescription").value,
        article_photo_url: photoUrl,
        article_status: document.getElementById("articleStatus").value,
        article_created_at: Timestamp.now(),
        article_updated_at: Timestamp.now(),
      };

      await addDoc(collection(db, "articles"), article);
      alert("Article Published Successfully!");
      location.reload();
    } catch (err) {
      console.error("ERROR:", err);
      alert("Error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Publish Article";
    }
  });
}

// --- 4. RENDER TABLE ---
async function renderArticles(filterStatus = null) {
  const tbody = document.getElementById("articlesTableBody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

  try {
    const snap = await getDocs(collection(db, "articles"));
    tbody.innerHTML = "";

    if (snap.empty) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted py-4">No articles found</td></tr>';
      return;
    }

    for (const d of snap.docs) {
      const a = d.data();

      if (filterStatus && a.article_status !== filterStatus) continue;

      const statusBadge =
        a.article_status === "Published"
          ? "badge bg-success"
          : "badge bg-secondary";

      // Fallback if old articles don't have a title yet
      const displayTitle = a.article_title ? a.article_title : a.article_type;

      const row = document.createElement("tr");
      row.innerHTML = `
                <td>
                    <strong>${displayTitle}</strong><br>
                    <small class="text-muted">${a.article_description ? a.article_description.substring(0, 40) : ""}...</small>
                </td>
                <td id="project-${d.id}"><span class="text-muted">...</span></td>
                <td><span class="badge bg-light text-dark border">${a.article_type}</span></td>
                <td class="text-center"><span class="${statusBadge}">${a.article_status}</span></td>
                <td class="text-center">
                   <div class="btn-group btn-group-sm" role="group">
                       <button class="btn btn-outline-secondary" onclick="openEditArticle('${d.id}')">Edit</button>
                       <button class="btn btn-outline-danger" onclick="deleteArticle('${d.id}')">Delete</button>
                   </div>
                </td>
            `;
      tbody.appendChild(row);

      // Fetch Project Name Logic
      if (a.project_id) {
        getDoc(doc(db, "projects", a.project_id)).then((projSnap) => {
          const el = document.getElementById(`project-${d.id}`);
          if (el)
            el.innerText = projSnap.exists()
              ? projSnap.data().title
              : "Deleted Project";
        });
      } else {
        const el = document.getElementById(`project-${d.id}`);
        if (el) el.innerHTML = '<em class="text-muted">General</em>';
      }
    }
  } catch (err) {
    console.error("RENDER ERROR:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading articles</td></tr>`;
  }
}

// --- 5. EDIT ARTICLE ---
window.openEditArticle = async (id) => {
  const modalEl = document.getElementById("editArticleModal");
  if (!modalEl) return;

  try {
    // Refresh project options to keep dropdown current
    await loadProjects(["editProjectId", "projectId"]);

    const ref = doc(db, "articles", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Article not found");
      return;
    }

    const data = snap.data();

    document.getElementById("editArticleId").value = id;

    const editProjectSelect = document.getElementById("editProjectId");
    const projVal = data.project_id || "";
    if (editProjectSelect) {
      editProjectSelect.value = projVal;
      // If project was deleted but stored id exists, show it as a fallback option
      if (projVal && editProjectSelect.value !== projVal) {
        const opt = document.createElement("option");
        opt.value = projVal;
        opt.textContent = "(Missing project)";
        editProjectSelect.appendChild(opt);
        editProjectSelect.value = projVal;
      }
    }

    document.getElementById("editArticleType").value =
      data.article_type || "News";
    document.getElementById("editArticleTitle").value =
      data.article_title || "";
    document.getElementById("editArticleDescription").value =
      data.article_description || "";
    document.getElementById("editArticleStatus").value =
      data.article_status || "Draft";
    document.getElementById("editCurrentPhotoUrl").value =
      data.article_photo_url || "";
    document.getElementById("currentPhotoHelp").innerText =
      data.article_photo_url || "No photo set";

    // Set preview to current photo
    setPreview(
      document.getElementById("editPhotoPreview"),
      data.article_photo_url || "",
    );

    // Clear replacement inputs for a fresh edit each time
    const fileInput = document.getElementById("editArticlePhoto");
    const urlInput = document.getElementById("editArticlePhotoUrl");
    if (fileInput) fileInput.value = "";
    if (urlInput) urlInput.value = "";

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (err) {
    console.error("LOAD EDIT ERROR:", err);
    alert("Error loading article details");
  }
};

const editForm = document.getElementById("editArticleForm");
if (editForm) {
  const editPreview = document.getElementById("editPhotoPreview");
  const editFileInput = document.getElementById("editArticlePhoto");
  const editUrlInput = document.getElementById("editArticlePhotoUrl");

  if (editFileInput) {
    editFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      setPreview(editPreview, file ? URL.createObjectURL(file) : "");
    });
  }

  if (editUrlInput) {
    editUrlInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      setPreview(
        editPreview,
        val || document.getElementById("editCurrentPhotoUrl").value || "",
      );
    });
  }

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("editSaveBtn");
    btn.disabled = true;
    btn.innerText = "Saving...";

    const articleId = document.getElementById("editArticleId").value;
    const ref = doc(db, "articles", articleId);

    const existingPhotoUrl =
      document.getElementById("editCurrentPhotoUrl").value || "";
    let photoUrl = existingPhotoUrl;

    try {
      const photoFile = document.getElementById("editArticlePhoto").files[0];
      const photoUrlInput = document
        .getElementById("editArticlePhotoUrl")
        .value.trim();

      if (photoFile) {
        photoUrl = await uploadImg(photoFile);
      } else if (photoUrlInput) {
        photoUrl = photoUrlInput;
      }

      await updateDoc(ref, {
        project_id: document.getElementById("editProjectId").value || "",
        article_title: document.getElementById("editArticleTitle").value,
        article_type: document.getElementById("editArticleType").value,
        article_description: document.getElementById("editArticleDescription")
          .value,
        article_status: document.getElementById("editArticleStatus").value,
        article_photo_url: photoUrl,
        article_updated_at: Timestamp.now(),
      });

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("editArticleModal"),
      );
      if (modal) modal.hide();

      alert("Article updated successfully!");
      renderArticles();
    } catch (err) {
      console.error("UPDATE ERROR:", err);
      alert("Error updating article: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Save Changes";
    }
  });
}

// Global Delete Function
window.deleteArticle = async (id) => {
  if (confirm("Delete this article?")) {
    await deleteDoc(doc(db, "articles", id));
    renderArticles();
  }
};

window.filterArticlesByStatus = (status) => renderArticles(status);

// Initialize
loadProjects();
renderArticles();
