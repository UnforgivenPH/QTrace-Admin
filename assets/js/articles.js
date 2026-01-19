import { db } from './config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const IMGBB_KEY = '679c2ed64c23cfbde43bf6fdb94aaed6'; 
let currentUserId = "admin"; 

// --- 1. UPLOAD IMAGE ---
async function uploadImg(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("ImgBB Upload Failed.");
    const data = await res.json();
    return data.data.url;
}

// --- 2. LOAD PROJECTS DROPDOWN ---
async function loadProjects() {
    const select = document.getElementById('projectId');
    if (!select) return;
    
    const snap = await getDocs(collection(db, 'projects'));
    select.innerHTML = '<option value="">-- General News (No Project) --</option>';
    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().title}</option>`;
    });
}

// --- 3. SUBMIT ARTICLE ---
const articleForm = document.getElementById('articleForm');
if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const projectId = document.getElementById('projectId').value; 
        const btn = document.getElementById('publishBtn');
        btn.disabled = true;
        btn.innerText = "Publishing...";

        try {
            let photoUrl = "";
            const photoFile = document.getElementById('articlePhoto').files[0];
            const photoUrlInput = document.getElementById('articlePhotoUrl').value;
            
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
                article_title: document.getElementById('articleTitle').value,
                
                article_type: document.getElementById('articleType').value,
                article_description: document.getElementById('articleDescription').value,
                article_photo_url: photoUrl,
                article_status: document.getElementById('articleStatus').value,
                article_created_at: Timestamp.now(),
                article_updated_at: Timestamp.now()
            };

            await addDoc(collection(db, 'articles'), article);
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
    const tbody = document.getElementById('articlesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, 'articles'));
        tbody.innerHTML = '';

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No articles found</td></tr>';
            return;
        }

        for (const d of snap.docs) {
            const a = d.data();

            if (filterStatus && a.article_status !== filterStatus) continue;

            const statusBadge = a.article_status === 'Published' ? 'badge bg-success' : 'badge bg-secondary';
            
            // Fallback if old articles don't have a title yet
            const displayTitle = a.article_title ? a.article_title : a.article_type;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${displayTitle}</strong><br>
                    <small class="text-muted">${a.article_description ? a.article_description.substring(0, 40) : ''}...</small>
                </td>
                <td id="project-${d.id}"><span class="text-muted">...</span></td>
                <td><span class="badge bg-light text-dark border">${a.article_type}</span></td>
                <td class="text-center"><span class="${statusBadge}">${a.article_status}</span></td>
                <td class="text-center">
                   <button class="btn btn-sm btn-outline-danger" onclick="deleteArticle('${d.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);

            // Fetch Project Name Logic
            if (a.project_id) {
                getDoc(doc(db, "projects", a.project_id)).then(projSnap => {
                    const el = document.getElementById(`project-${d.id}`);
                    if (el) el.innerText = projSnap.exists() ? projSnap.data().title : "Deleted Project";
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