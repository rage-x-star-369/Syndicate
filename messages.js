// Private Messages with Firebase Realtime Database

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, function(match) {
        return ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[match];
    });
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

// --- Messaging Logic ---

// Conversation key: always store messages under /messages/{userA}___{userB} (sorted alphabetically)
function getConversationKey(userA, userB) {
    return [userA, userB].sort().join("___");
}

async function getMemberList() {
    const snapshot = await db.ref('members').once('value');
    const val = snapshot.val();
    if (!val) return [];
    return Object.values(val);
}

// --- UI Setup ---
document.addEventListener("DOMContentLoaded", async function() {
    const myUsername = getMemberSession();
    if (!myUsername) {
        window.location.href = "index.html";
        return;
    }

    // Setup logout and back
    document.getElementById("pm-logout-btn").onclick = function() {
        clearMemberSession();
        window.location.href = "index.html";
    };
    document.getElementById("pm-back-btn").onclick = function() {
        window.location.href = "index.html";
    };

    // Populate user list for conversations
    const allMembers = await getMemberList();
    const others = allMembers.filter(m => m.username !== myUsername);
    const userSelect = document.getElementById("pm-user-select");
    userSelect.innerHTML = others.length ? others.map(m =>
        `<option value="${escapeHtml(m.username)}">${escapeHtml(m.username)}${m.role ? " ("+escapeHtml(m.role)+")" : ""}</option>`
    ).join("") : `<option disabled>No one to message</option>`;
    if (!others.length) document.getElementById("pm-new-msg-text").disabled = true;

    // Set up the chat window for the first user (if any)
    let currentRecipient = userSelect.value || "";
    if(currentRecipient) loadMessages(myUsername, currentRecipient);

    userSelect.onchange = function() {
        currentRecipient = userSelect.value;
        loadMessages(myUsername, currentRecipient);
    };

    // Send message handler
    document.getElementById("pm-new-msg-form").onsubmit = async function(e) {
        e.preventDefault();
        const text = document.getElementById("pm-new-msg-text").value.trim();
        if (!text || !currentRecipient) return;
        const time = new Date().toLocaleString();
        const msg = {
            from: myUsername,
            to: currentRecipient,
            text,
            time
        };
        // Save to Firebase
        const convKey = getConversationKey(myUsername, currentRecipient);
        const newMsgRef = db.ref('messages/' + convKey).push();
        await newMsgRef.set(msg);
        document.getElementById("pm-new-msg-text").value = "";
        // Scroll to bottom will happen in listener
    };

    // --- Real-time message loading ---
    function loadMessages(userA, userB) {
        const chatWin = document.getElementById("pm-chat-window");
        chatWin.innerHTML = "<div style='color:#7bffe9;padding:1.1em;text-align:center;'>Loading messages...</div>";
        const convKey = getConversationKey(userA, userB);
        db.ref('messages/' + convKey).off(); // Remove previous listener if any
        db.ref('messages/' + convKey).on('value', snap => {
            const msgs = [];
            const val = snap.val();
            if(val) {
                for(const key in val) {
                    msgs.push(val[key]);
                }
                msgs.sort((a,b) => new Date(a.time) - new Date(b.time));
            }
            chatWin.innerHTML = msgs.length ? msgs.map(m =>
                `<div class="pm-message-row ${m.from===userA ? "self" : "other"}">
                    <div class="pm-msg-bubble">${escapeHtml(m.text)}
                        <div class="pm-msg-meta">
                            ${m.from===userA ? "You" : escapeHtml(m.from)} &mdash; <span>${escapeHtml(m.time)}</span>
                        </div>
                    </div>
                </div>`
            ).join("") : `<div style='color:#7bffe9;padding:1.1em;text-align:center;'>No messages yet.</div>`;
            chatWin.scrollTop = chatWin.scrollHeight;
        });
    }
});
