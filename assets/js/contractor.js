import { db } from './config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const contractorsCol = collection(db, 'contractors');
const tableBody = document.getElementById('contractorTableBody');

// --- 1. IMGBB UPLOAD LOGIC ---
async function uploadToImgBB(file) {
    if (!file) return ""; // Return empty string if no file
    
    const apiKey = '679c2ed64c23cfbde43bf6fdb94aaed6';
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
        return "";
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
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    const snap = await getDocs(contractorsCol);
    tableBody.innerHTML = '';
    
    snap.forEach((document) => {
        const item = document.data();
        const id = document.id;
        
        // Handle Logo (Check if it's an object or string for backward compatibility)
        const logoUrl = item.logo && item.logo.path ? item.logo.path : (typeof item.logo === 'string' ? item.logo : '');

        tableBody.innerHTML += `
            <tr>
                <td>${logoUrl ? `<img src="${logoUrl}" width="50" height="50" class="rounded shadow-sm" style="object-fit:cover;">` : 'No Logo'}</td>
                <td><strong>${item.name}</strong><br><small class="text-muted">${item.email}</small></td>
                <td>${item.contactPerson}<br><small>${item.phone}</small></td>
                <td>${Array.isArray(item.expertise) ? item.expertise.map(exp => `<span class="badge bg-light text-dark border">${exp}</span>`).join(' ') : item.expertise}</td>
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
    btn.innerText = "Processing...";

    try {
        const logoFile = document.getElementById('logoInput').files[0];
        const logoUrl = await uploadToImgBB(logoFile);

        const compName = document.getElementById('compName').value;
        const phoneVal = document.getElementById('phone').value;

        const contractorData = {
            name: compName,
            contactPerson: document.getElementById('contactPerson').value,
            email: document.getElementById('email').value,
            phone: phoneVal,
            experience: document.getElementById('experience').value, // Saved as String (matches DB)
            address: document.getElementById('address').value,
            
            // Convert comma string to Array (matches DB)
            expertise: document.getElementById('expertise').value.split(',').map(s => s.trim()).filter(i => i),
            
            // ✅ FIX: Save Logo as Object (matches Android Model)
            logo: { 
                path: logoUrl,
                name: compName,
                phone: phoneVal
            },
            
            documents: [] 
        };

        await addDoc(contractorsCol, contractorData);
        document.getElementById('contractorForm').reset();
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

// Initial Load
renderContractors();