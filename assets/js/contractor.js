import { db } from "./config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const contractorsCol = collection(db, "contractors");
const tableBody = document.getElementById("contractorTableBody");

// --- 1. IMGBB UPLOAD LOGIC ---
async function uploadToImgBB(file) {
  if (!file) return ""; // Return empty string if no file

  const apiKey = "679c2ed64c23cfbde43bf6fdb94aaed6";
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await response.json();
    return data.data.url;
  } catch (err) {
    console.error("ImgBB Error:", err);
    return "";
  }
}

// --- 1b. LOGO PREVIEW HELPERS ---
const setLogoPreview = (imgEl, url) => {
  if (!imgEl) return;
  if (url) {
    imgEl.src = url;
    imgEl.classList.remove("d-none");
  } else {
    imgEl.src = "";
    imgEl.classList.add("d-none");
  }
};

const wireLogoPreview = (inputEl, previewEl) => {
  if (!inputEl || !previewEl) return;
  inputEl.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setLogoPreview(previewEl, evt.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(previewEl, "");
    }
  });
};

function resetContractorForm() {
  const form = document.getElementById("contractorForm");
  if (!form) return;
  form.reset();
  const logoPreview = document.getElementById("logoPreview");
  if (logoPreview) setLogoPreview(logoPreview, "");
}

// Wire add modal events
const addContractorModalEl = document.getElementById("addContractorModal");
if (addContractorModalEl) {
  addContractorModalEl.addEventListener("shown.bs.modal", () => {
    resetContractorForm();
  });
  addContractorModalEl.addEventListener("hidden.bs.modal", () => {
    resetContractorForm();
  });
}

// Wire logo preview on add form
const logoInput = document.getElementById("logoInput");
const logoPreview = document.getElementById("logoPreview");
if (logoInput && logoPreview) {
  wireLogoPreview(logoInput, logoPreview);
}

// --- 2. DELETE FUNCTION ---
window.deleteContractor = async (id) => {
  if (confirm("Delete this contractor?")) {
    await deleteDoc(doc(db, "contractors", id));
    renderContractors();
  }
};

// --- 3b. OPEN EDIT MODAL ---
window.openEditContractor = async (id) => {
  const modalEl = document.getElementById("editContractorModal");
  if (!modalEl) return;

  try {
    const snap = await getDoc(doc(db, "contractors", id));
    if (!snap.exists()) {
      alert("Contractor not found");
      return;
    }

    const data = snap.data();

    document.getElementById("editContractorId").value = id;
    document.getElementById("editCompName").value = data.name || "";
    document.getElementById("editContactPerson").value =
      data.contactPerson || "";
    document.getElementById("editEmail").value = data.email || "";
    document.getElementById("editPhone").value = data.phone || "";
    document.getElementById("editExperience").value = data.experience || "";
    document.getElementById("editAddress").value = data.address || "";
    document.getElementById("editExpertise").value = Array.isArray(
      data.expertise,
    )
      ? data.expertise.join(", ")
      : data.expertise || "";

    const logoPath =
      data.logo && data.logo.path
        ? data.logo.path
        : typeof data.logo === "string"
          ? data.logo
          : "";
    document.getElementById("editCurrentLogo").value = logoPath;
    document.getElementById("currentLogoHelp").innerText =
      logoPath || "No logo set";

    // Show current logo preview if exists
    const editLogoPreview = document.getElementById("editLogoPreview");
    if (logoPath && editLogoPreview) {
      setLogoPreview(editLogoPreview, logoPath);
    }

    const logoInput = document.getElementById("editLogoInput");
    if (logoInput) logoInput.value = "";

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (err) {
    console.error("LOAD CONTRACTOR ERROR:", err);
    alert("Error loading contractor");
  }
};

// Wire logo preview on edit form
const editLogoInput = document.getElementById("editLogoInput");
const editLogoPreview = document.getElementById("editLogoPreview");
if (editLogoInput && editLogoPreview) {
  wireLogoPreview(editLogoInput, editLogoPreview);
}

// --- 3. RENDER TABLE ---
async function renderContractors() {
  tableBody.innerHTML =
    '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
  const snap = await getDocs(contractorsCol);
  tableBody.innerHTML = "";

  snap.forEach((document) => {
    const item = document.data();
    const id = document.id;

    // Handle Logo (Check if it's an object or string for backward compatibility)
    const logoUrl =
      item.logo && item.logo.path
        ? item.logo.path
        : typeof item.logo === "string"
          ? item.logo
          : "";

    tableBody.innerHTML += `
            <tr>
                <td>${logoUrl ? `<img src="${logoUrl}" width="50" height="50" class="rounded shadow-sm" style="object-fit:cover;">` : "No Logo"}</td>
                <td><strong>${item.name}</strong><br><small class="text-muted">${item.email}</small></td>
                <td>${item.contactPerson}<br><small>${item.phone}</small></td>
                <td>${Array.isArray(item.expertise) ? item.expertise.map((exp) => `<span class="badge bg-light text-dark border">${exp}</span>`).join(" ") : item.expertise}</td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-secondary" onclick="openEditContractor('${id}')">Edit</button>
                        <button class="btn btn-outline-danger" onclick="deleteContractor('${id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
  });
}

// --- 4. FORM SUBMISSION ---
document
  .getElementById("contractorForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
      const logoFile = document.getElementById("logoInput").files[0];
      const logoUrl = await uploadToImgBB(logoFile);

      const compName = document.getElementById("compName").value;
      const phoneVal = document.getElementById("phone").value;

      const contractorData = {
        name: compName,
        contactPerson: document.getElementById("contactPerson").value,
        email: document.getElementById("email").value,
        phone: phoneVal,
        experience: document.getElementById("experience").value, // Saved as String (matches DB)
        address: document.getElementById("address").value,

        // Convert comma string to Array (matches DB)
        expertise: document
          .getElementById("expertise")
          .value.split(",")
          .map((s) => s.trim())
          .filter((i) => i),

        // ✅ FIX: Save Logo as Object (matches Android Model)
        logo: {
          path: logoUrl,
          name: compName,
          phone: phoneVal,
        },

        documents: [],
      };

      await addDoc(contractorsCol, contractorData);
      document.getElementById("contractorForm").reset();
      alert("Contractor Saved!");
      renderContractors();
    } catch (error) {
      console.error(error);
      alert("Error saving: " + error.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Register Contractor";
    }
  });

// --- 5. EDIT SUBMISSION ---
const editForm = document.getElementById("editContractorForm");
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("editSaveBtn");
    btn.disabled = true;
    btn.innerText = "Saving...";

    const contractorId = document.getElementById("editContractorId").value;
    const ref = doc(db, "contractors", contractorId);

    try {
      const logoFile = document.getElementById("editLogoInput").files[0];
      const existingLogo =
        document.getElementById("editCurrentLogo").value || "";
      const logoUrl = logoFile ? await uploadToImgBB(logoFile) : existingLogo;

      await updateDoc(ref, {
        name: document.getElementById("editCompName").value,
        contactPerson: document.getElementById("editContactPerson").value,
        email: document.getElementById("editEmail").value,
        phone: document.getElementById("editPhone").value,
        experience: document.getElementById("editExperience").value,
        address: document.getElementById("editAddress").value,
        expertise: document
          .getElementById("editExpertise")
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        logo: {
          path: logoUrl,
          name: document.getElementById("editCompName").value,
          phone: document.getElementById("editPhone").value,
        },
      });

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("editContractorModal"),
      );
      if (modal) modal.hide();

      alert("Contractor updated");
      renderContractors();
    } catch (err) {
      console.error("UPDATE CONTRACTOR ERROR:", err);
      alert("Error updating contractor: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Save Changes";
    }
  });
}

// Initial Load
renderContractors();
