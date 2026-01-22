import { db } from "./config.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  Timestamp,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAddressFromCoords } from "./get_address.js";

// --- CONFIGURATION ---
const IMGBB_KEY = "679c2ed64c23cfbde43bf6fdb94aaed6";
const QC_COORDS = [14.676, 121.0437];
let selectedCoords = null;
let currentMarker = null;
let map = null;
let mapInitialized = false;

const toDateInput = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
};

const setPreview = (imgEl, url) => {
  if (!imgEl) return;
  if (url) {
    imgEl.src = url;
    imgEl.classList.remove("d-none");
  } else {
    imgEl.src = "";
    imgEl.classList.add("d-none");
  }
};

const wireMilestonePreview = (inputOrEntry, maybePreview) => {
  const input = maybePreview
    ? inputOrEntry
    : inputOrEntry?.querySelector?.(".m-image");
  const preview = maybePreview || inputOrEntry?.querySelector?.(".m-preview");
  if (!input || !preview) return;
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    setPreview(preview, file ? URL.createObjectURL(file) : "");
  });
};

function createMilestoneEntry(withMargin = false) {
  const wrapper = document.createElement("div");
  wrapper.className = `milestone-entry row g-2 align-items-start${withMargin ? " mt-2" : ""}`;
  wrapper.innerHTML = `
    <div class="col-md-6">
      <select class="form-select m-type">
        <option value="Pre-Construction">Pre-Construction</option>
        <option value="Actual Work">Actual Work</option>
        <option value="Finished">Finished</option>
      </select>
    </div>
    <div class="col-md-6">
      <input type="file" accept="image/*" class="form-control m-image" required>
      <div class="mt-2 d-flex align-items-center gap-2">
        <img class="img-fluid rounded d-none m-preview" style="max-height: 180px; object-fit: cover;" />
        <button type="button" class="btn btn-sm btn-outline-danger remove-milestone">Remove</button>
      </div>
    </div>
  `;

  const fileInput = wrapper.querySelector(".m-image");
  const previewImg = wrapper.querySelector(".m-preview");
  wireMilestonePreview(fileInput, previewImg);

  const removeBtn = wrapper.querySelector(".remove-milestone");
  removeBtn.addEventListener("click", () => {
    wrapper.remove();
  });

  return wrapper;
}

function resetProjectForm() {
  const form = document.getElementById("projectForm");
  if (!form) return;

  form.reset();
  selectedCoords = null;

  if (currentMarker && map) {
    map.removeLayer(currentMarker);
    currentMarker = null;
  }

  if (map) {
    map.setView(QC_COORDS, 12);
  }

  ["street", "barangay", "zipCode"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const cityEl = document.getElementById("city");
  if (cityEl) cityEl.value = "Quezon City";

  const container = document.getElementById("milestoneContainer");
  if (container) {
    container.innerHTML = "";
    container.appendChild(createMilestoneEntry());
  }
}

// --- 1. MAP SETUP (lazy) ---
function initMapIfNeeded() {
  if (mapInitialized) {
    setTimeout(() => map.invalidateSize(), 150);
    return;
  }

  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  map = L.map("map").setView(QC_COORDS, 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  map.on("click", async (e) => {
    const { lat, lng } = e.latlng;
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);

    selectedCoords = { lat: lat, lng: lng };

    try {
      const addr = await getAddressFromCoords(lat, lng);
      if (addr) {
        document.getElementById("street").value = addr.street || "";
        document.getElementById("barangay").value = addr.barangay || "";
        document.getElementById("zipCode").value = addr.zipCode || "";
      }
    } catch (err) {
      console.warn("Geocoding error:", err);
    }
  });

  mapInitialized = true;
  setTimeout(() => map.invalidateSize(), 150);
}

const addProjectModalEl = document.getElementById("addProjectModal");
if (addProjectModalEl) {
  addProjectModalEl.addEventListener("shown.bs.modal", () => {
    resetProjectForm();
    loadContractors();
    initMapIfNeeded();
    setTimeout(() => map && map.invalidateSize(), 200);
  });

  addProjectModalEl.addEventListener("hidden.bs.modal", () => {
    resetProjectForm();
  });
}

// --- 2. IMAGE UPLOAD HELPER (ImgBB) ---
async function uploadImg(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.data.url;
}

// --- 3. SUBMIT PROJECT & AUTO-POST NEWS ---
const projectForm = document.getElementById("projectForm");
if (projectForm) {
  projectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedCoords) return alert("Please pin a location on the map!");

    const btn = document.getElementById("saveBtn");
    btn.disabled = true;
    btn.innerText = "Publishing...";

    try {
      const milestoneElements = document.querySelectorAll(".milestone-entry");
      const milestoneData = [];

      for (let el of milestoneElements) {
        const fileInput = el.querySelector(".m-image");
        const file = fileInput.files[0];
        if (file) {
          const url = await uploadImg(file);
          milestoneData.push({
            type: el.querySelector(".m-type").value,
            imageUrl: url,
            dateUploaded: new Date().toISOString(),
          });
        }
      }

      const titleVal = document.getElementById("title").value;
      const descriptionVal = document.getElementById("description").value;

      const project = {
        title: titleVal,
        category: document.getElementById("category").value,
        contractor: document.getElementById("contractorId").value,
        budget: Number(document.getElementById("budget").value),
        status: document.getElementById("status").value,
        description: descriptionVal,
        location: selectedCoords,
        address: {
          street: document.getElementById("street").value,
          barangay: document.getElementById("barangay").value,
          zipCode: document.getElementById("zipCode").value,
          city: "Quezon City",
        },
        dates: {
          started: Timestamp.fromDate(
            new Date(document.getElementById("startDate").value),
          ),
          end: Timestamp.fromDate(
            new Date(document.getElementById("endDate").value),
          ),
        },
        milestones: milestoneData,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, "projects"), project);

      const article = {
        project_id: docRef.id,
        user_id: "admin",
        article_type: "Project Launch",
        article_description: `PROJECT LAUNCH: ${titleVal}.\n\nScope: ${descriptionVal}`,
        article_photo_url:
          milestoneData.length > 0 ? milestoneData[0].imageUrl : "",
        article_status: "Published",
        article_created_at: Timestamp.now(),
        article_updated_at: Timestamp.now(),
      };

      await addDoc(collection(db, "articles"), article);

      alert("Project Saved & News Posted!");
      location.reload();
    } catch (err) {
      console.error("Submission Error:", err);
      alert("Error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Publish Project";
    }
  });
}

// --- 4. LOAD CONTRACTORS INTO DROPDOWN ---
async function loadContractors(
  selectIds = ["contractorId", "editContractorId"],
) {
  const selects = selectIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!selects.length) return;

  try {
    const snap = await getDocs(collection(db, "contractors"));
    const options = ['<option value="">Select Contractor</option>'];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      options.push(`<option value="${data.name}">${data.name}</option>`);
    });

    const html = options.join("");
    selects.forEach((select) => {
      const current = select.value;
      select.innerHTML = html;
      if (current) select.value = current;
    });
  } catch (err) {
    console.error("Error loading contractors:", err);
  }
}

// --- 5. RENDER PROJECT REGISTRY ---
async function renderProjects() {
  const tableBody = document.getElementById("projectTableBody");
  if (!tableBody) return;

  tableBody.innerHTML =
    '<tr><td colspan="6" class="text-center">Loading registry...</td></tr>';

  try {
    // Fetch projects (removed orderBy to ensure it works even without createdAt)
    const snap = await getDocs(collection(db, "projects"));
    tableBody.innerHTML = "";

    if (snap.empty) {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="text-center">No projects found.</td></tr>';
      return;
    }

    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const pId = docSnap.id;

      const title = p.title || "Untitled Project";
      let contractor = p.contractor || p.contractorId || "N/A";
      const barangay =
        p.address && p.address.barangay && p.address.barangay !== ""
          ? p.address.barangay
          : "N/A";

      const budget = p.budget || 0;
      const status = p.status || "Ongoing";

      let badgeClass = "bg-primary";
      if (status === "Finished") badgeClass = "bg-success";

      const row = `
                <tr>
                    <td><strong>${title}</strong></td>
                    <td>${contractor}</td>
                    <td>${barangay}</td>
                    <td>₱${budget.toLocaleString()}</td>
                    <td><span class="badge ${badgeClass}">${status}</span></td>
                    <td class="text-center">
                      <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-secondary" onclick="openEditProject('${pId}')">Edit</button>
                        <button class="btn btn-outline-danger" onclick="deleteProject('${pId}')">Delete</button>
                      </div>
                    </td>
                </tr>
            `;
      tableBody.innerHTML += row;
    });
  } catch (err) {
    console.error("Registry Error:", err);
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${err.message}</td></tr>`;
  }
}

// --- 6. OPEN EDIT MODAL ---
window.openEditProject = async (id) => {
  const modalEl = document.getElementById("editProjectModal");
  if (!modalEl) return;

  try {
    // First load contractors to populate dropdown
    await loadContractors(["editContractorId"]);

    // Then load project data
    const snap = await getDoc(doc(db, "projects", id));
    if (!snap.exists()) {
      alert("Project not found");
      return;
    }

    const data = snap.data();

    document.getElementById("editProjectId").value = id;
    document.getElementById("editTitle").value = data.title || "";
    document.getElementById("editCategory").value =
      data.category || "Infrastructure";

    // Set contractor value after dropdown is populated
    const contractorVal = data.contractor || data.contractorId || "";
    const contractorSelect = document.getElementById("editContractorId");
    if (contractorSelect && contractorVal) {
      let found = false;
      for (let opt of contractorSelect.options) {
        if (opt.value === contractorVal) {
          contractorSelect.value = contractorVal;
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`Contractor "${contractorVal}" not found in dropdown`);
      }
    }

    document.getElementById("editBudget").value = data.budget || "";
    document.getElementById("editStatus").value = data.status || "Ongoing";
    document.getElementById("editDescription").value = data.description || "";

    const addr = data.address || {};
    document.getElementById("editStreet").value = addr.street || "";
    document.getElementById("editBarangay").value = addr.barangay || "";
    document.getElementById("editZip").value = addr.zipCode || "";
    document.getElementById("editCity").value = addr.city || "Quezon City";

    const dates = data.dates || {};
    document.getElementById("editStartDate").value = toDateInput(dates.started);
    document.getElementById("editEndDate").value = toDateInput(dates.end);

    const loc = data.location || {};
    document.getElementById("editLat").value = loc.lat ?? "";
    document.getElementById("editLng").value = loc.lng ?? "";

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (err) {
    console.error("LOAD PROJECT ERROR:", err);
    alert("Error loading project");
  }
};

// --- 7. DELETE PROJECT ---
window.deleteProject = async (id) => {
  if (confirm("Are you sure you want to delete this project?")) {
    try {
      await deleteDoc(doc(db, "projects", id));
      renderProjects();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  }
};

// --- 8. EDIT SUBMISSION ---
const editForm = document.getElementById("editProjectForm");
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("editSaveBtn");
    btn.disabled = true;
    btn.innerText = "Saving...";

    const projectId = document.getElementById("editProjectId").value;
    const ref = doc(db, "projects", projectId);

    try {
      const payload = {
        title: document.getElementById("editTitle").value,
        category: document.getElementById("editCategory").value,
        contractor: document.getElementById("editContractorId").value,
        budget: Number(document.getElementById("editBudget").value) || 0,
        status: document.getElementById("editStatus").value,
        description: document.getElementById("editDescription").value,
        address: {
          street: document.getElementById("editStreet").value,
          barangay: document.getElementById("editBarangay").value,
          zipCode: document.getElementById("editZip").value,
          city: document.getElementById("editCity").value || "Quezon City",
        },
        dates: {
          started: Timestamp.fromDate(
            new Date(document.getElementById("editStartDate").value),
          ),
          end: Timestamp.fromDate(
            new Date(document.getElementById("editEndDate").value),
          ),
        },
      };

      const latVal = document.getElementById("editLat").value;
      const lngVal = document.getElementById("editLng").value;
      if (latVal !== "" && lngVal !== "") {
        payload.location = { lat: Number(latVal), lng: Number(lngVal) };
      }

      await updateDoc(ref, payload);

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("editProjectModal"),
      );
      if (modal) modal.hide();

      alert("Project updated");
      renderProjects();
    } catch (err) {
      console.error("UPDATE PROJECT ERROR:", err);
      alert("Error updating project: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Save Changes";
    }
  });
}

// --- 9. HANDLE "ADD MILESTONE" BUTTON ---
const addMilestoneBtn = document.getElementById("addMilestoneBtn");
if (addMilestoneBtn) {
  addMilestoneBtn.addEventListener("click", () => {
    const container = document.getElementById("milestoneContainer");
    if (!container) return;
    container.appendChild(createMilestoneEntry(true));
  });
}

// --- INITIALIZE PAGE ---
window.onload = () => {
  loadContractors();
  renderProjects();
  resetProjectForm();
};
