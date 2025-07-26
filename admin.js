// Admin panel logic for The Syndicate

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, function(match) {
        return ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[match];
    });
}
function getMemberList() {
    return JSON.parse(localStorage.getItem("members") || "[]");
}
function setMemberList(list) {
    localStorage.setItem("members", JSON.stringify(list));
}
function getAnnouncements() {
    return JSON.parse(localStorage.getItem("announcements") || "[]");
}
function setAnnouncements(list) {
    localStorage.setItem("announcements", JSON.stringify(list));
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

// --- Admin Login System ---
const ADMIN_CREDENTIALS = {
    username: "admin",
    // SHA-256 of '123'
    passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
};

function showAdminLogin() {
    document.getElementById("admin-login-modal").style.display = "flex";
    document.querySelector(".admin-section").style.display = "none";
}
function hideAdminLogin() {
    document.getElementById("admin-login-modal").style.display = "none";
    document.querySelector(".admin-section").style.display = "";
}
function isAdminAuthenticated() {
    return sessionStorage.getItem("admin_authenticated") === "yes";
}
function setAdminAuthenticated(val) {
    sessionStorage.setItem("admin_authenticated", val ? "yes" : "");
}
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("admin-login-form").onsubmit = async function(e){
        e.preventDefault();
        const uname = document.getElementById("admin-login-username").value.trim();
        const pw = document.getElementById("admin-login-password").value;
        const err = document.getElementById("admin-login-error");
        const hash = await hashPassword(pw);
        if (uname === ADMIN_CREDENTIALS.username && hash === ADMIN_CREDENTIALS.passwordHash) {
            setAdminAuthenticated(true);
            hideAdminLogin();
            renderAdminMemberList();
            renderAdminAnnouncementList();
        } else {
            err.textContent = "Incorrect admin username or password.";
        }
    };
    document.getElementById("admin-logout-btn").onclick = function(){
        setAdminAuthenticated(false);
        showAdminLogin();
    };
    if (!isAdminAuthenticated()) {
        showAdminLogin();
    } else {
        hideAdminLogin();
    }

    // Member management
    renderAdminMemberList();
    document.getElementById("add-member-form").onsubmit = addMember;
    document.getElementById("edit-member-form").onsubmit = saveEditedMember;
    document.getElementById("edit-member-cancel").onclick = hideEditMemberModal;

    // Announcement management
    renderAdminAnnouncementList();
    document.getElementById("add-announcement-form").onsubmit = addAnnouncement;

    setupModalClose();
});

// ---- Member Management ----
function renderAdminMemberList() {
    const memberListElem = document.getElementById("admin-member-list");
    if (!memberListElem) return;
    const members = getMemberList();
    memberListElem.innerHTML = members.map((m, idx) => `
        <tr>
            <td>${escapeHtml(m.username)}</td>
            <td>${escapeHtml(m.role || "")}</td>
            <td>${escapeHtml(m.lastLogin || "")}</td>
            <td>
                <button class="btn-edit-member" data-idx="${idx}">Edit</button>
                <button class="btn-delete-member" data-idx="${idx}">Delete</button>
            </td>
        </tr>
    `).join("");
    // Edit/Delete events
    memberListElem.querySelectorAll(".btn-edit-member").forEach(btn => {
        btn.onclick = () => showEditMemberModal(parseInt(btn.getAttribute("data-idx")));
    });
    memberListElem.querySelectorAll(".btn-delete-member").forEach(btn => {
        btn.onclick = () => deleteMember(parseInt(btn.getAttribute("data-idx")));
    });
}

function showEditMemberModal(idx) {
    const members = getMemberList();
    const m = members[idx];
    if (!m) return;
    document.getElementById("edit-member-username").value = m.username;
    document.getElementById("edit-member-role").value = m.role || "";
    document.getElementById("edit-member-password").value = "";
    document.getElementById("edit-member-idx").value = idx;
    document.getElementById("edit-member-modal").style.display = "block";
}

function hideEditMemberModal() {
    document.getElementById("edit-member-modal").style.display = "none";
}

async function saveEditedMember(e) {
    e.preventDefault();
    const idx = parseInt(document.getElementById("edit-member-idx").value);
    const username = document.getElementById("edit-member-username").value.trim();
    const role = document.getElementById("edit-member-role").value;
    const password = document.getElementById("edit-member-password").value;
    let members = getMemberList();
    if (!members[idx]) return;
    members[idx].username = username;
    members[idx].role = role;
    if (password) {
        members[idx].passwordHash = await hashPassword(password);
    }
    setMemberList(members);
    hideEditMemberModal();
    renderAdminMemberList();
}

function deleteMember(idx) {
    if (!confirm("Are you sure you want to delete this member?")) return;
    let members = getMemberList();
    members.splice(idx, 1);
    setMemberList(members);
    renderAdminMemberList();
}

// ---- Add Member ----
async function addMember(e) {
    e.preventDefault();
    const username = document.getElementById("add-member-username").value.trim();
    const password = document.getElementById("add-member-password").value;
    const role = document.getElementById("add-member-role").value;
    if (!username || !password || !role) {
        alert("Username, password, and role are required.");
        return;
    }
    let members = getMemberList();
    if (members.some(m => m.username === username)) {
        alert("Username already exists.");
        return;
    }
    const passwordHash = await hashPassword(password);
    members.push({
        username,
        passwordHash,
        role,
        lastLogin: "",
        lastComment: ""
    });
    setMemberList(members);
    document.getElementById("add-member-form").reset();
    renderAdminMemberList();
}

// ---- Announcements Management ----
function renderAdminAnnouncementList() {
    const annListElem = document.getElementById("admin-announcement-list");
    if (!annListElem) return;
    const announcements = getAnnouncements();
    annListElem.innerHTML = announcements.map((a, idx) => `
        <tr>
            <td>${escapeHtml(a.title)}</td>
            <td>${escapeHtml(a.category || "")}</td>
            <td>${escapeHtml((a.tags||[]).join(", "))}</td>
            <td>${escapeHtml(a.date)}</td>
            <td>
                <button class="btn-delete-announcement" data-idx="${idx}">Delete</button>
            </td>
        </tr>
    `).join("");
    annListElem.querySelectorAll(".btn-delete-announcement").forEach(btn => {
        btn.onclick = () => deleteAnnouncement(parseInt(btn.getAttribute("data-idx")));
    });
}
function deleteAnnouncement(idx) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    let anns = getAnnouncements();
    anns.splice(idx, 1);
    setAnnouncements(anns);
    renderAdminAnnouncementList();
}

// ---- Add Announcement ----
function addAnnouncement(e) {
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
    let anns = getAnnouncements();
    anns.push({
        id: '_' + Math.random().toString(36).substr(2, 9),
        title,
        message,
        category,
        tags,
        date: new Date().toLocaleString(),
        attachment,
        views: [],
        comments: []
    });
    setAnnouncements(anns);
    document.getElementById("add-announcement-form").reset();
    renderAdminAnnouncementList();
}

// ---- Modal Close ----
function setupModalClose() {
    document.querySelectorAll(".modal-close").forEach(btn => {
        btn.onclick = function(){
            this.closest(".modal").style.display = "none";
        }
    });
}

// ---- Sync across tabs ----
window.addEventListener('storage', function(e) {
    if (e.key === 'members') renderAdminMemberList();
    if (e.key === 'announcements') renderAdminAnnouncementList();
});
