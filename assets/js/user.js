import { db } from "./config.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersCol = collection(db, "users");
const tableBody = document.getElementById("userTableBody");
const refreshBtn = document.getElementById("refreshBtn");
const addUserModalEl = document.getElementById("addUserModal");

const toDateInput = (val) => {
  if (!val) return "";
  // val may be string or Timestamp
  if (val.toDate) return val.toDate().toISOString().slice(0, 10);
  return new Date(val).toISOString().slice(0, 10);
};

function resetUserForm() {
  const form = document.getElementById("userForm");
  if (!form) return;
  form.reset();
  const qcDisplay = document.getElementById("qcIdDisplay");
  if (qcDisplay) {
    qcDisplay.value = "";
    qcDisplay.placeholder = "Auto-generated on save";
  }
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerText = "Add User";
  }
}

if (addUserModalEl) {
  addUserModalEl.addEventListener("shown.bs.modal", () => {
    resetUserForm();
  });
  addUserModalEl.addEventListener("hidden.bs.modal", () => {
    resetUserForm();
  });
}

// --- 1. ID GENERATION LOGIC ---
async function generateUniqueQCId() {
  let isUnique = false;
  let newId = "";
  while (!isUnique) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    newId = `QC-${randomNum}`;
    const q = query(usersCol, where("qcId", "==", newId));
    const snap = await getDocs(q);
    if (snap.empty) isUnique = true;
  }
  return newId;
}

// --- 2. DELETE FUNCTION ---
// We attach this to the window object so the HTML button can "see" it
window.deleteUser = async (docId) => {
  if (confirm("Are you sure you want to delete this user?")) {
    try {
      await deleteDoc(doc(db, "users", docId));
      displayUsers(); // Refresh list
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  }
};

// --- 2b. OPEN EDIT MODAL ---
window.openEditUser = async (docId) => {
  const modalEl = document.getElementById("editUserModal");
  if (!modalEl) return;

  try {
    const snap = await getDoc(doc(db, "users", docId));
    if (!snap.exists()) {
      alert("User not found");
      return;
    }

    const data = snap.data();
    document.getElementById("editUserId").value = docId;
    document.getElementById("editQcIdHidden").value = data.qcId || "";
    document.getElementById("editQcIdDisplay").value = data.qcId || "";

    document.getElementById("editFirst").value = data.fullName?.first || "";
    document.getElementById("editMiddle").value = data.fullName?.middle || "";
    document.getElementById("editLast").value = data.fullName?.last || "";

    document.getElementById("editEmail").value = data.email || "";
    document.getElementById("editContact").value = data.details?.contact || "";
    document.getElementById("editSex").value = data.details?.sex || "Male";
    document.getElementById("editBirthDate").value = toDateInput(
      data.details?.birthDate,
    );
    document.getElementById("editRole").value = data.role || "user";
    document.getElementById("editAddress").value = data.details?.address || "";

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (error) {
    console.error("LOAD USER ERROR:", error);
    alert("Error loading user");
  }
};

// --- 3. RENDER TABLE ---
async function displayUsers() {
  tableBody.innerHTML =
    '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  const querySnapshot = await getDocs(usersCol);
  tableBody.innerHTML = "";

  if (querySnapshot.empty) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="text-center">No users found</td></tr>';
    return;
  }

  querySnapshot.forEach((document) => {
    const user = document.data();
    const id = document.id;

    tableBody.innerHTML += `
      <tr>
        <td><strong>${user.qcId}</strong></td>
        <td>${user.fullName.last}, ${user.fullName.first}</td>
        <td>${user.email}</td>
        <td><span class="badge ${user.role === "admin" ? "bg-danger" : "bg-primary"}">${user.role}</span></td>
        <td>${user.details.contact}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-secondary" onclick="openEditUser('${id}')">Edit</button>
            <button class="btn btn-outline-danger" onclick="deleteUser('${id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  });
}

// --- 4. FORM SUBMISSION ---
document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  btn.innerText = "Saving...";

  const uniqueId = await generateUniqueQCId();
  const qcDisplay = document.getElementById("qcIdDisplay");
  if (qcDisplay) qcDisplay.value = uniqueId;
  const userData = {
    fullName: {
      first: document.getElementById("first").value,
      middle: document.getElementById("middle").value,
      last: document.getElementById("last").value,
    },
    qcId: uniqueId,
    role: document.getElementById("role").value,
    email: document.getElementById("email").value,
    details: {
      sex: document.getElementById("sex").value,
      birthDate: document.getElementById("birthDate").value,
      contact: document.getElementById("contact").value,
      address: document.getElementById("address").value,
    },
  };

  await addDoc(usersCol, userData);
  if (addUserModalEl) {
    const modal = bootstrap.Modal.getInstance(addUserModalEl);
    if (modal) modal.hide();
  }
  resetUserForm();
  btn.disabled = false;
  btn.innerText = "Add User";
  displayUsers();
});

// --- 5. EDIT SUBMISSION ---
const editForm = document.getElementById("editUserForm");
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("editSaveBtn");
    btn.disabled = true;
    btn.innerText = "Saving...";

    const userId = document.getElementById("editUserId").value;
    const ref = doc(db, "users", userId);

    try {
      await updateDoc(ref, {
        qcId: document.getElementById("editQcIdHidden").value,
        fullName: {
          first: document.getElementById("editFirst").value,
          middle: document.getElementById("editMiddle").value,
          last: document.getElementById("editLast").value,
        },
        role: document.getElementById("editRole").value,
        email: document.getElementById("editEmail").value,
        details: {
          sex: document.getElementById("editSex").value,
          birthDate: document.getElementById("editBirthDate").value,
          contact: document.getElementById("editContact").value,
          address: document.getElementById("editAddress").value,
        },
      });

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("editUserModal"),
      );
      if (modal) modal.hide();

      alert("User updated");
      displayUsers();
    } catch (error) {
      console.error("UPDATE USER ERROR:", error);
      alert("Error updating user: " + error.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Save Changes";
    }
  });
}

// --- 6. REFRESH BUTTON ---
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => displayUsers());
}

// Initial Load
displayUsers();
