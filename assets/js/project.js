import { db } from './config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, Timestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAddressFromCoords } from './get_address.js';

// --- CONFIGURATION ---
const IMGBB_KEY = '679c2ed64c23cfbde43bf6fdb94aaed6'; 
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
    
    selectedCoords = { lat: lat, lng: lng }; 

    // Auto-fill address using your helper script
    const addr = await getAddressFromCoords(lat, lng);
    if (addr) {
        document.getElementById('street').value = addr.street || '';
        document.getElementById('barangay').value = addr.barangay || '';
        document.getElementById('zipCode').value = addr.zipCode || '';
    }
});

// --- 2. IMAGE UPLOAD HELPER (ImgBB) ---
async function uploadImg(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { 
        method: 'POST', 
        body: formData 
    });
    if (!res.ok) throw new Error("Image upload failed");
    const data = await res.json();
    return data.data.url;
}

// --- 3. SUBMIT PROJECT & AUTO-POST NEWS ---
document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedCoords) return alert("Please pin a location on the map!");

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerText = "Publishing...";

    try {
        // A. Process Milestones (Upload Images)
        const milestoneElements = document.querySelectorAll('.milestone-entry');
        const milestoneData = [];
        
        for (let el of milestoneElements) {
            const fileInput = el.querySelector('.m-image');
            const file = fileInput.files[0];
            if (file) {
                const url = await uploadImg(file);
                milestoneData.push({
                    type: el.querySelector('.m-type').value,
                    imageUrl: url,
                    dateUploaded: new Date().toISOString()
                });
            }
        }

        const titleVal = document.getElementById('title').value;
        const descriptionVal = document.getElementById('description').value;

        // B. Prepare Project Object
        const project = {
            title: titleVal,
            category: document.getElementById('category').value,
            contractor: document.getElementById('contractorId').value, 
            budget: Number(document.getElementById('budget').value),
            status: document.getElementById('status').value, // Explicit status from form
            description: descriptionVal,
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
            milestones: milestoneData,
            createdAt: Timestamp.now()
        };

        // C. Save Project to Firestore
        const docRef = await addDoc(collection(db, 'projects'), project);

        // D. Auto-create News Article in 'articles' collection
        const article = {
            project_id: docRef.id,
            user_id: "admin", 
            article_type: "Project Launch", 
            article_description: `PROJECT LAUNCH: ${titleVal}.\n\nScope: ${descriptionVal}`, 
            article_photo_url: milestoneData.length > 0 ? milestoneData[0].imageUrl : "",
            article_status: "Published",
            article_created_at: Timestamp.now(),
            article_updated_at: Timestamp.now()
        };

        await addDoc(collection(db, 'articles'), article);
        
        alert("Project Saved & News Posted!");
        location.reload(); // Refresh to update registry

    } catch (err) {
        console.error("Submission Error:", err);
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Publish Project";
    }
});

// --- 4. LOAD CONTRACTORS INTO DROPDOWN ---
async function loadContractors() {
    const select = document.getElementById('contractorId');
    try {
        const snap = await getDocs(collection(db, 'contractors'));
        select.innerHTML = '<option value="">Select Contractor</option>';
        snap.forEach(docSnap => {
            const data = docSnap.data();
            // Use Name as the value so it shows correctly in the Registry table
            select.innerHTML += `<option value="${data.name}">${data.name}</option>`;
        });
    } catch (err) {
        console.error("Error loading contractors:", err);
    }
}

// --- 5. RENDER PROJECT REGISTRY ---
async function renderProjects() {
    const tableBody = document.getElementById('projectTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading registry...</td></tr>';

    try {
        // Fetch projects (removed orderBy to ensure it works even without createdAt)
        const snap = await getDocs(collection(db, 'projects'));
        tableBody.innerHTML = '';

        if (snap.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No projects found.</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const p = docSnap.data();
            const pId = docSnap.id;

            // 🛠️ KEY FIXES BASED ON YOUR DB SCREENSHOT:
            const title = p.title || "Untitled Project";
            
            // Map 'contractorId' instead of 'contractor'
            const contractor = p.contractorId || "N/A"; 
            
            // Map 'barangay' - if empty string, show 'N/A'
            const barangay = (p.address && p.address.barangay !== "") ? p.address.barangay : "N/A";
            
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
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProject('${pId}')">Delete</button>
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

// --- 6. DELETE PROJECT ---
window.deleteProject = async (id) => {
    if (confirm("Are you sure you want to delete this project?")) {
        try {
            await deleteDoc(doc(db, 'projects', id));
            renderProjects();
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    }
};

// --- 7. HANDLE "ADD MILESTONE" BUTTON ---
document.getElementById('addMilestoneBtn').addEventListener('click', () => {
    const container = document.getElementById('milestoneContainer');
    const newEntry = document.createElement('div');
    newEntry.className = 'milestone-entry row g-2 mt-2';
    newEntry.innerHTML = `
        <div class="col-md-6">
            <select class="form-select m-type">
                <option value="Pre-Construction">Pre-Construction</option>
                <option value="Actual Work">Actual Work</option>
                <option value="Finished">Finished</option>
            </select>
        </div>
        <div class="col-md-6">
            <input type="file" class="form-control m-image" accept="image/*" required>
        </div>
    `;
    container.appendChild(newEntry);
});

// --- INITIALIZE PAGE ---
window.onload = () => {
    loadContractors();
    renderProjects();
};