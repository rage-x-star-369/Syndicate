// Firebase-based Member panel logic for The Syndicate

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, function(match) {
        return ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[match];
    });
}

// Firebase helpers
async function getMemberList() {
    const snapshot = await db.ref('members').once('value');
    const val = snapshot.val();
    if (!val) return [];
    return Object.values(val);
}
async function getMemberByUsername(username) {
    const snapshot = await db.ref('members/' + username).once('value');
    return snapshot.val();
}
async function setMember(member) {
    await db.ref('members/' + member.username).set(member);
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
function getMemberSession() {
    return sessionStorage.getItem("member_username");
}
function setMemberSession(username) {
    sessionStorage.setItem("member_username", username);
}
function clearMemberSession() {
    sessionStorage.removeItem("member_username");
}

// --- Member Roles ---
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

// Render Member List with Roles
async function renderMemberListWithRoles() {
    const memberListElem = document.getElementById("member-list");
    if (!memberListElem) return;
    const members = await getMemberList();
    // Sort by role priority if role exists in SYNDICATE_ROLES, then by username
    const rolePriority = {};
    SYNDICATE_ROLES.forEach((r, i) => { rolePriority[r] = i; });
    members.sort((a, b) => {
        let ai = rolePriority[a.role] !== undefined ? rolePriority[a.role] : 999;
        let bi = rolePriority[b.role] !== undefined ? rolePriority[b.role] : 999;
        if (ai !== bi) return ai - bi;
        return (a.username || "").localeCompare(b.username || "");
    });

    memberListElem.innerHTML = members.map(m => `
        <li>
            <span class="chat-avatar">${escapeHtml(m.username ? m.username.charAt(0).toUpperCase() : "?")}</span>
            <span>
                <b>${escapeHtml(m.username)}</b>
                ${m.role ? `<span class="role-badge">${escapeHtml(m.role)}</span>` : ""}
            </span>
        </li>
    `).join("");
}

// --- Announcements Logic ---
async function showAnnouncements(username) {
    document.getElementById("member-login-section").style.display = "none";
    document.getElementById("announcements-section").style.display = "block";
    document.getElementById("member-welcome-msg").textContent = `Welcome, ${username}!`;
    await renderAnnouncements(username);
    setupFilters();
    setupPM(username);
    await renderMemberListWithRoles();
}
function showLogin() {
    document.getElementById("member-login-section").style.display = "block";
    document.getElementById("announcements-section").style.display = "none";
}
async function setupFilters() {
    const catSel = document.getElementById("announcement-filter-category");
    const tagInput = document.getElementById("announcement-filter-tag");
    let announcements = await getAnnouncements();
    let cats = Array.from(new Set(announcements.map(a=>a.category).filter(Boolean)));
    catSel.innerHTML = `<option value="">All Categories</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
    catSel.onchange = ()=>renderAnnouncements(getMemberSession());
    tagInput.oninput = ()=>renderAnnouncements(getMemberSession());
}
async function renderAnnouncements(username) {
    const list = document.getElementById('announcements-list');
    const noAnn = document.getElementById('no-announcements');
    let announcements = await getAnnouncements();
    const catSel = document.getElementById("announcement-filter-category");
    const tagInput = document.getElementById("announcement-filter-tag");
    let cat = catSel && catSel.value;
    let tag = tagInput && tagInput.value.toLowerCase();
    if (cat) announcements = announcements.filter(a=>a.category===cat);
    if (tag) announcements = announcements.filter(a=>(a.tags||[]).some(t=>t.toLowerCase().includes(tag)));
    list.innerHTML = "";
    if (!announcements.length) {
        list.style.display = "none";
        noAnn.style.display = "block";
        return;
    }
    noAnn.style.display = "none";
    list.style.display = "block";
    announcements.slice().reverse().forEach(a => {
        // Mark as read
        if (username && (!a.views || !a.views.includes(username))) {
            if (!a.views) a.views = [];
            a.views.push(username);
            db.ref('announcements/' + a.id + '/views').set(a.views);
        }
        const li = document.createElement('li');
        li.className = 'announcement-card animated';
        li.innerHTML = `
            <div class="announcement-title">
                <i class="fa-solid fa-bullhorn"></i> ${escapeHtml(a.title)}
                <span class="badge">${escapeHtml(a.category || "General")}</span>
                ${a.tags && a.tags.length ? a.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('') : ''}
            </div>
            <div class="announcement-message">${escapeHtml(a.message)}</div>
            ${a.attachment ? `<img src="${a.attachment}" class="announcement-img" alt="Attachment">` : ''}
            ${a.poll ? renderPoll(a, username) : ''}
            <div class="announcement-date"><i class="fa-regular fa-clock"></i> ${escapeHtml(a.date)} | 
                <i class="fa-solid fa-eye"></i> ${a.views ? a.views.length : 0} views
            </div>
            <div class="card-actions">
                <button class="comment-btn btn-primary" data-id="${a.id}"><i class="fa-solid fa-comment"></i> Comment</button>
            </div>
            <div class="comments"><strong>Comments:</strong>${a.comments && a.comments.length ? a.comments.map(c=>`<div class="comment"><b>${escapeHtml(c.author)}</b>: ${escapeHtml(c.text)} <span style="font-size:0.85em;color:#888;">${escapeHtml(c.date)}</span></div>`).join('') : "<span style='color:#ccc;'>No comments</span>"}</div>
        `;
        list.appendChild(li);
        // Poll voting
        if (a.poll) {
            li.querySelectorAll('.poll-vote').forEach(btn => {
                btn.onclick = () => {
                    votePoll(a.id, btn.getAttribute('data-idx'), username);
                }
            });
        }
        // Comment events
        li.querySelector('.comment-btn').onclick = async () => {
            let comment = prompt("Enter your comment:");
            if (!comment) return;
            // Add comment to this announcement in Firebase
            const annRef = db.ref('announcements/' + a.id + '/comments');
            let commentsSnapshot = await annRef.once('value');
            let comments = commentsSnapshot.val() || [];
            comments.push({author: username, text: comment, date: new Date().toLocaleString()});
            await annRef.set(comments);

            // Update member lastComment
            const memRef = db.ref('members/' + username);
            let memberSnapshot = await memRef.once('value');
            let m = memberSnapshot.val();
            if (m) {
                m.lastComment = new Date().toLocaleString();
                await memRef.set(m);
            }
            renderAnnouncements(username);
        }
    });
}
function renderPoll(a, username) {
    let totalVotes = a.poll && a.poll.votes ? Object.keys(a.poll.votes).length : 0;
    let hasVoted = a.poll && a.poll.votes && username in a.poll.votes;
    return a.poll ? `
        <div class="poll">
            <b>${escapeHtml(a.poll.question)}</b>
            <ul>
            ${a.poll.options.map((opt,i)=>{
                let count = a.poll.votes ? Object.values(a.poll.votes).filter(v=>v===i).length : 0;
                let percent = totalVotes ? Math.round(100*count/totalVotes) : 0;
                return `<li>${escapeHtml(opt)} 
                    ${hasVoted ? `<span class="poll-bar" style="width:${percent}%;">${count} (${percent}%)</span>` : `<button class="poll-vote btn-primary" data-idx="${i}"${hasVoted ? " disabled" : ""}>Vote</button>`}
                </li>`;
            }).join('')}
            </ul>
        </div>
    ` : '';
}
async function votePoll(annId, idx, username) {
    const annRef = db.ref('announcements/' + annId + '/poll/votes');
    let snapshot = await annRef.once('value');
    let votes = snapshot.val() || {};
    if (username in votes) return;
    votes[username] = parseInt(idx);
    await annRef.set(votes);
    renderAnnouncements(username);
}

// --- DOMContentLoaded: Login, Logout, PM button, Init ---
document.addEventListener("DOMContentLoaded", function() {
  
    const username = getMemberSession();
    if (username) {
        getMemberList().then(members => {
            if (members.some(m => m.username === username)) {
                showAnnouncements(username);
            } else {
                showLogin();
            }
        });
    } else {
        showLogin();
    }
    const tasksBtn = document.getElementById("tasks-btn");
    if (tasksBtn) {
        tasksBtn.addEventListener("click", function(e) {
            e.preventDefault();
            window.location.href = "tasks.html";
        });
    }
    const loginForm = document.getElementById('member-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('member-username').value.trim();
            const password = document.getElementById('member-password').value;
            const errorP = document.getElementById('member-login-error');
            if (!username || !password) {
                errorP.textContent = "Please enter your username and password.";
                return;
            }
            const member = await getMemberByUsername(username);
            if (!member) {
                errorP.textContent = "Username not registered. Contact admin.";
                return;
            }
            const hash = await hashPassword(password);
            if (member.passwordHash !== hash) {
                errorP.textContent = "Incorrect password.";
                return;
            }
            errorP.textContent = "";
            setMemberSession(username);
            member.lastLogin = new Date().toLocaleString();
            await setMember(member);
            showAnnouncements(username);
          
        });
    }
    const logoutBtn = document.getElementById('member-logout-btn');
    if (logoutBtn) {
      showLoader();
        logoutBtn.addEventListener('click', function() {
            clearMemberSession();
            showLogin();
          hideLoader();
        });
    }

    // --- Redirect to messages.html when clicking mail/PM icon (id="pm-btn") ---
    const pmBtn = document.getElementById("pm-btn");
    if (pmBtn) {
        pmBtn.addEventListener("click", function(e) {
            e.preventDefault();
            window.location.href = "messages.html";
        });
    }
});

// --- Private Messaging (legacy modal, not used if using WhatsApp style page) ---
function setupPM(username) {
    const pmBtn = document.getElementById("pm-btn");
    if (pmBtn) {
        pmBtn.onclick = function(){
            window.location.href = "messages.html";
        };
    }
    const closePmModal = document.getElementById("close-pm-modal");
    if (closePmModal) {
        closePmModal.onclick = function(){
            document.getElementById("pm-panel").style.display = "none";
        };
    }
    const pmForm = document.getElementById("pm-form");
    if (pmForm) {
        pmForm.onsubmit = function(e){
            e.preventDefault();
            const to = document.getElementById("pm-to").value;
            const text = document.getElementById("pm-text").value;
            if (!to || !text) return;
            // You can implement Firebase-based messages here if you wish
            document.getElementById("pm-text").value = "";
            showPMPanel(username);
        }
    }
}
function showPMPanel(username) {
    const pmPanel = document.getElementById("pm-panel");
    if (pmPanel) pmPanel.style.display = "block";
    // Fetch member list and messages from Firebase if you want real-time PMs
    // This is a placeholder
}

// --- Storage Syncing: Not needed, Firebase provides real-time updates if you use .on('value', ...) ---
