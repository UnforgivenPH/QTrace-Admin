import { db } from './config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAddressFromCoords } from './get_address.js';

const IMGBB_KEY = '679c2ed64c23cfbde43bf6fdb94aaed6'; // MUST BE VALID
const QC_COORDS = [14.6760, 121.0437];
let selectedCoords = null;
let currentMarker = null;

// --- 1. MAP SETUP ---
const map = L.map('map').setView(QC_COORDS, 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);
    selectedCoords = { lat, lng };

    const addr = await getAddressFromCoords(lat, lng);
    if (addr) {
        document.getElementById('street').value = addr.street || '';
        document.getElementById('barangay').value = addr.barangay || '';
        document.getElementById('zipCode').value = addr.zipCode || '';
    }
});

// --- 2. DYNAMIC MILESTONE FIELDS (Name Removed) ---
document.getElementById('addMilestoneBtn').addEventListener('click', () => {
    const div = document.createElement('div');
    div.className = 'milestone-entry row g-2 mt-2';
    div.innerHTML = `
        <div class="col-md-6">
            <select class="form-select m-type">
                <option value="Pre-Construction">Pre-Construction</option>
                <option value="Actual Work">Actual Work</option>
                <option value="Finished">Finished</option>
            </select>
        </div>
        <div class="col-md-6"><input type="file" class="form-control m-image" accept="image/*" required></div>
    `;
    document.getElementById('milestoneContainer').appendChild(div);
});

// --- 3. UPLOAD AND SAVE LOGIC ---
async function uploadImg(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
    
    if (!res.ok) throw new Error("ImgBB Upload Failed. Check your API Key.");
    
    const data = await res.json();
    return data.data.url;
}

document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedCoords) return alert("Please pin a location on the map!");

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const milestoneElements = document.querySelectorAll('.milestone-entry');
        const milestoneData = [];

        for (let el of milestoneElements) {
            const file = el.querySelector('.m-image').files[0];
            if (file) {
                const url = await uploadImg(file);
                milestoneData.push({
                    type: el.querySelector('.m-type').value,
                    imageUrl: url,
                    dateUploaded: new Date().toISOString()
                });
            }
        }

        const project = {
            title: document.getElementById('title').value,
            category: document.getElementById('category').value,
            contractorId: document.getElementById('contractorId').value,
            budget: Number(document.getElementById('budget').value),
            status: "Ongoing",
            location: selectedCoords,
            address: {
                street: document.getElementById('street').value,
                barangay: document.getElementById('barangay').value,
                zipCode: document.getElementById('zipCode').value,
                city: "Quezon City"
            },
            dates: {
                started: Timestamp.fromDate(new Date(document.getElementById('startDate').value)),
                end: Timestamp.fromDate(new Date(document.getElementById('endDate').value))
            },
            milestones: milestoneData
        };

        await addDoc(collection(db, 'projects'), project);
        alert("Project Saved Successfully!");
        location.reload();
    } catch (err) {
        console.error("FULL ERROR DETAILS:", err);
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Publish Project";
    }
});

// --- 4. LOAD CONTRACTORS & RENDER LIST (Same as before) ---
async function loadContractors() {
    const select = document.getElementById('contractorId');
    const snap = await getDocs(collection(db, 'contractors'));
    select.innerHTML = '<option value="">Select Contractor</option>';
    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });
}

window.deleteProject = async (id) => {
    if (confirm("Delete this project?")) {
        await deleteDoc(doc(db, "projects", id));
        renderProjects();
    }
};

async function renderProjects() {
    const tbody = document.getElementById('projectTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    const snap = await getDocs(collection(db, 'projects'));
    tbody.innerHTML = '';

    for (const d of snap.docs) {
        const p = d.data();
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${p.title}</strong><br><small>${p.category}</small></td>
            <td id="con-${d.id}">Checking...</td>
            <td><small>${p.address.barangay}</small></td>
            <td>₱${p.budget.toLocaleString()}</td>
            <td><span class="badge bg-primary">${p.status}</span></td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProject('${d.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);

        // Fetch contractor name separately to speed up UI
        getDoc(doc(db, "contractors", p.contractorId)).then(conSnap => {
            document.getElementById(`con-${d.id}`).innerText = conSnap.exists() ? conSnap.data().name : "N/A";
        });
    }
}

loadContractors();
renderProjects();