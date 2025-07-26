
// Firebase-based Admin panel logic for The Syndicate



function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, function(match) {
        return ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[match];
    });
}


const SYNDICATE_ROLES = [
    "Founder",
    "Chairman / Chairperson",
    "President",
    "Chief Executive Officer (CEO)",
    "Vice President (VP)",
    "Director General",
    "Chief of Staff",
    "Chief Intelligence Officer (CIO)",
    "Managing Director",
    "Deputy Director",
    "Chief Financial Officer (CFO)",
    "Internal Affairs Head",
    "Chief Operations Officer (COO)",
    "Chief Strategy Officer (CSO)",
    "Smuggling Coordinator / Underground Networks Head"
];

function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}
async function hashPassword(pw) {
    if (window.sha256) {
        return await window.sha256(pw);
    } else if (window.crypto && window.crypto.subtle) {
        return await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw)).then(buf =>
            Array.from(new Uint8Array(buf)).map(x => ('00'+x.toString(16)).slice(-2)).join('')
        );
    }
    return pw;
}

// --- Firebase Data Helpers ---
async function getMemberList() {
    const snapshot = await db.ref('members').once('value');
    const val = snapshot.val();
    if (!val) return [];
    // Keep username as key for editing
    return Object.values(val);
}
async function getMemberByUsername(username) {
    const snapshot = await db.ref('members/' + username).once('value');
    return snapshot.val();
}
async function setMember(member) {
    await db.ref('members/' + member.username).set(member);
}
async function removeMember(username) {
    await db.ref('members/' + username).remove();
}
async function getAnnouncements() {
    const snapshot = await db.ref('announcements').once('value');
    const val = snapshot.val();
    if (!val) return [];
    return Object.values(val);
}
async function setAnnouncement(announcement) {
    await db.ref('announcements/' + announcement.id).set(announcement);
}
async function removeAnnouncement(id) {
    await db.ref('announcements/' + id).remove();
}

// --- Member Management ---
async function renderAdminMemberList() {
    const memberListElem = document.getElementById("admin-member-list");
    if (!memberListElem) return;
    const members = await getMemberList();
    memberListElem.innerHTML = members.map((m, idx) => `
        <tr>
            <td>${escapeHtml(m.username)}</td>
            <td>${escapeHtml(m.role || "")}</td>
            <td>${escapeHtml(m.lastLogin || "")}</td>
            <td>
                <button class="btn-edit-member" data-username="${m.username}">Edit</button>
                <button class="btn-delete-member" data-username="${m.username}">Delete</button>
            </td>
        </tr>
    `).join("");
    // Edit/Delete events
    memberListElem.querySelectorAll(".btn-edit-member").forEach(btn => {
        btn.onclick = () => showEditMemberModal(btn.getAttribute("data-username"));
    });
    memberListElem.querySelectorAll(".btn-delete-member").forEach(btn => {
        btn.onclick = () => deleteMember(btn.getAttribute("data-username"));
    });
}

function showEditMemberModal(username) {
    getMemberByUsername(username).then(m => {
        if (!m) return;
        document.getElementById("edit-member-username").value = m.username;
        document.getElementById("edit-member-role").value = m.role || "";
        document.getElementById("edit-member-password").value = "";
        document.getElementById("edit-member-idx").value = m.username;
        document.getElementById("edit-member-modal").style.display = "block";
    });
}

function hideEditMemberModal() {
    document.getElementById("edit-member-modal").style.display = "none";
}

async function saveEditedMember(e) {
    e.preventDefault();
    const username = document.getElementById("edit-member-idx").value;
    const newUsername = document.getElementById("edit-member-username").value.trim();
    const role = document.getElementById("edit-member-role").value;
    const password = document.getElementById("edit-member-password").value;
    let member = await getMemberByUsername(username);
    if (!member) return;
    // If username changed, remove old key and add new
    let usernameChanged = newUsername && newUsername !== username;
    if (usernameChanged) {
        await removeMember(username);
        member.username = newUsername;
    }
    member.role = role;
    if (password) {
        member.passwordHash = await hashPassword(password);
    }
    await setMember(member);
    hideEditMemberModal();
    renderAdminMemberList();
}

async function deleteMember(username) {
    if (!confirm("Are you sure you want to delete this member?")) return;
    await removeMember(username);
    renderAdminMemberList();
}

async function addMember(e) {
    e.preventDefault();
    const username = document.getElementById("add-member-username").value.trim();
    const password = document.getElementById("add-member-password").value;
    const role = document.getElementById("add-member-role").value;
    if (!username || !password || !role) {
        alert("Username, password, and role are required.");
        return;
    }
    let existing = await getMemberByUsername(username);
    if (existing) {
        alert("Username already exists.");
        return;
    }
    const passwordHash = await hashPassword(password);
    let member = {
        username,
        passwordHash,
        role,
        lastLogin: "",
        lastComment: ""
    };
    await setMember(member);
    document.getElementById("add-member-form").reset();
    renderAdminMemberList();
}

// --- Announcements Management ---
async function renderAdminAnnouncementList() {
    const annListElem = document.getElementById("admin-announcement-list");
    if (!annListElem) return;
    const announcements = await getAnnouncements();
    annListElem.innerHTML = announcements.map((a, idx) => `
        <tr>
            <td>${escapeHtml(a.title)}</td>
            <td>${escapeHtml(a.category || "")}</td>
            <td>${escapeHtml((a.tags||[]).join(", "))}</td>
            <td>${escapeHtml(a.date)}</td>
            <td>
                <button class="btn-delete-announcement" data-id="${a.id}">Delete</button>
            </td>
        </tr>
    `).join("");
    annListElem.querySelectorAll(".btn-delete-announcement").forEach(btn => {
        btn.onclick = () => deleteAnnouncement(btn.getAttribute("data-id"));
    });
}

async function deleteAnnouncement(id) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    await removeAnnouncement(id);
    renderAdminAnnouncementList();
}

async function addAnnouncement(e) {
    e.preventDefault();
    const title = document.getElementById("add-ann-title").value.trim();
    const message = document.getElementById("add-ann-message").value.trim();
    const category = document.getElementById("add-ann-category").value.trim();
    const tags = document.getElementById("add-ann-tags").value.split(",").map(t=>t.trim()).filter(Boolean);
    const attachment = document.getElementById("add-ann-attachment").value.trim();
    if (!title || !message) {
        alert("Title and message are required.");
        return;
    }
    let ann = {
        id: generateId(),
        title,
        message,
        category,
        tags,
        date: new Date().toLocaleString(),
        attachment,
        views: [],
        comments: []
    };
    await setAnnouncement(ann);
    document.getElementById("add-announcement-form").reset();
    renderAdminAnnouncementList();
}

// --- Modal Close ---
function setupModalClose() {
    document.querySelectorAll(".modal-close").forEach(btn => {
        btn.onclick = function(){
            this.closest(".modal").style.display = "none";
        }
    });
}

// --- DOMContentLoaded: Event Wiring ---

document.addEventListener("DOMContentLoaded", function() {
    // Member management
  var adminTasksBtn = document.getElementById("admin-tasks-btn");
  if (adminTasksBtn) {
    adminTasksBtn.addEventListener("click", function() {
      window.location.href = "admin-tasks.html";
    });
  }
    renderAdminMemberList();
    document.getElementById("add-member-form").onsubmit = addMember;
    document.getElementById("edit-member-form").onsubmit = saveEditedMember;
    document.getElementById("edit-member-cancel").onclick = hideEditMemberModal;

    // Announcement management
    renderAdminAnnouncementList();
    document.getElementById("add-announcement-form").onsubmit = addAnnouncement;

    setupModalClose();

    // Logout button just redirects to index page
    document.getElementById("admin-logout-btn").onclick = function(){
        window.location.href = "index.html";
    };

    // Real-time listeners (for live update)
    db.ref('members').on('value', () => renderAdminMemberList());
    db.ref('announcements').on('value', () => renderAdminAnnouncementList());
  
});
