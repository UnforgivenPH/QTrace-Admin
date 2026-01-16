import { db } from './config.js';
import { 
    collection, query, where, getDocs, addDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersCol = collection(db, 'users');
const tableBody = document.getElementById('userTableBody');

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

// --- 3. RENDER TABLE ---
async function displayUsers() {
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    const querySnapshot = await getDocs(usersCol);
    tableBody.innerHTML = '';

    querySnapshot.forEach((document) => {
        const user = document.data();
        const id = document.id; // This is the unique Firestore ID
        
        tableBody.innerHTML += `
            <tr>
                <td><strong>${user.qcId}</strong></td>
                <td>${user.fullName.last}, ${user.fullName.first}</td>
                <td>${user.email}</td>
                <td><span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${user.role}</span></td>
                <td>${user.details.contact}</td>
                <td class="text-center">
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteUser('${id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

// --- 4. FORM SUBMISSION ---
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;

    const uniqueId = await generateUniqueQCId();
    const userData = {
        fullName: {
            first: document.getElementById('first').value,
            middle: document.getElementById('middle').value,
            last: document.getElementById('last').value
        },
        qcId: uniqueId,
        role: document.getElementById('role').value,
        email: document.getElementById('email').value,
        details: {
            sex: document.getElementById('sex').value,
            birthDate: document.getElementById('birthDate').value,
            contact: document.getElementById('contact').value,
            address: document.getElementById('address').value
        }
    };

    await addDoc(usersCol, userData);
    document.getElementById('userForm').reset();
    btn.disabled = false;
    displayUsers();
});

// Initial Load
displayUsers();