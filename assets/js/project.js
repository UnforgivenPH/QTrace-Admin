import { db } from './config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAddressFromCoords } from './get_address.js';

const IMGBB_KEY = '679c2ed64c23cfbde43bf6fdb94aaed6'; 
const QC_COORDS = [14.6760, 121.0437];
let selectedCoords = null;
let currentMarker = null;

// --- MAP SETUP ---
const map = L.map('map').setView(QC_COORDS, 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);
    
    // ✅ SAVE AS SIMPLE OBJECT (Matches image_157726.png)
    selectedCoords = { lat: lat, lng: lng }; 

    const addr = await getAddressFromCoords(lat, lng);
    if (addr) {
        document.getElementById('street').value = addr.street || '';
        document.getElementById('barangay').value = addr.barangay || '';
        document.getElementById('zipCode').value = addr.zipCode || '';
    }
});

// --- IMAGE UPLOAD ---
async function uploadImg(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.data.url;
}

// --- SUBMIT PROJECT ---
document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedCoords) return alert("Please pin a location on the map!");

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerText = "Publishing...";

    try {
        // 1. Process Milestones
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

        const titleVal = document.getElementById('title').value;
        const descriptionVal = document.getElementById('description').value;

        // 2. Prepare Project Data
        const project = {
            title: titleVal,
            category: document.getElementById('category').value,
            contractorId: document.getElementById('contractorId').value,
            budget: Number(document.getElementById('budget').value),
            status: "Ongoing",
            description: descriptionVal,
            
            // ✅ Matches DB 'location' structure
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

        // 3. SAVE PROJECT
        const docRef = await addDoc(collection(db, 'projects'), project);
        console.log("Project Saved:", docRef.id);

        // 4. AUTO-CREATE ARTICLE (Matches image_1576cd.png)
        const article = {
            project_id: docRef.id,
            user_id: "admin", 
            
            // Matches 'article_type' field
            article_type: "Project Launch", 
            
            // Matches 'article_description' field
            article_description: `PROJECT LAUNCH: ${titleVal}.\n\nScope: ${descriptionVal}`, 
            
            article_photo_url: milestoneData.length > 0 ? milestoneData[0].imageUrl : "",
            article_status: "Published",
            article_created_at: Timestamp.now(),
            article_updated_at: Timestamp.now()
        };

        await addDoc(collection(db, 'articles'), article);
        
        alert("Project Saved & News Posted!");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Publish Project";
    }
});

// ... (Keep existing loadContractors code below)
async function loadContractors() {
    const select = document.getElementById('contractorId');
    const snap = await getDocs(collection(db, 'contractors'));
    select.innerHTML = '<option value="">Select Contractor</option>';
    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });
}
loadContractors();
renderProjects();