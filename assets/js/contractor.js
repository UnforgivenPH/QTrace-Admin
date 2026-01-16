import { db } from './config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const contractorsCol = collection(db, 'contractors');
const tableBody = document.getElementById('contractorTableBody');

// --- 1. IMGBB UPLOAD LOGIC (No Billing) ---
async function uploadToImgBB(file) {
    if (!file) return "https://via.placeholder.com/50"; // Default if no logo
    
    const apiKey = '679c2ed64c23cfbde43bf6fdb94aaed6'; // GET YOUR KEY FROM api.imgbb.com
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        return data.data.url;
    } catch (err) {
        console.error("ImgBB Error:", err);
        return "https://via.placeholder.com/50";
    }
}

// --- 2. DELETE FUNCTION ---
window.deleteContractor = async (id) => {
    if (confirm("Delete this contractor?")) {
        await deleteDoc(doc(db, "contractors", id));
        renderContractors();
    }
};

// --- 3. RENDER TABLE ---
async function renderContractors() {
    tableBody.innerHTML = '';
    const snap = await getDocs(contractorsCol);
    
    snap.forEach((document) => {
        const item = document.data();
        const id = document.id;
        
        tableBody.innerHTML += `
            <tr>
                <td><img src="${item.logo.path}" width="50" height="50" class="rounded shadow-sm" style="object-fit:cover;"></td>
                <td><strong>${item.name}</strong><br><small class="text-muted">${item.email}</small></td>
                <td>${item.contactPerson}<br><small>${item.phone}</small></td>
                <td>${item.expertise.map(exp => `<span class="badge bg-light text-dark border">${exp}</span>`).join(' ')}</td>
                <td class="text-center">
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteContractor('${id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

// --- 4. FORM SUBMISSION ---
document.getElementById('contractorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerText = "Processing Logo...";

    const logoFile = document.getElementById('logoInput').files[0];
    const logoUrl = await uploadToImgBB(logoFile);

    const contractorData = {
        name: document.getElementById('compName').value,
        contactPerson: document.getElementById('contactPerson').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        experience: document.getElementById('experience').value,
        address: document.getElementById('address').value,
        expertise: document.getElementById('expertise').value.split(',').map(s => s.trim()),
        logo: { path: logoUrl },
        documents: [] // You can add PDF logic here later
    };

    try {
        await addDoc(contractorsCol, contractorData);
        document.getElementById('contractorForm').reset();
        renderContractors();
    } catch (error) {
        alert("Error saving: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Register Contractor";
    }
});

// Initial Load
renderContractors();