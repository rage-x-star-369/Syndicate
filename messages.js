// WhatsApp-like private message page for The Syndicate

function getMemberList() {
    return JSON.parse(localStorage.getItem("members") || "[]");
}
function getMessages() {
    return JSON.parse(localStorage.getItem("messages") || "[]");
}
function setMessages(list) {
    localStorage.setItem("messages", JSON.stringify(list));
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
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, function(match) {
        return ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[match];
    });
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

let myUsername = null;
let activeChat = null; // username

// --- UI Load ---
document.addEventListener("DOMContentLoaded", function() {
    myUsername = getMemberSession();
    if (!myUsername || !getMemberList().some(m => m.username === myUsername)) {
        window.location = "index.html";
        return;
    }
    loadChatList();
    setupListeners();
    showChat(null); // No chat selected

    // Make sure pm-btn on this page (if exists) goes to messages.html (prevent reload)
    const pmBtn = document.getElementById("pm-btn");
    if (pmBtn) {
        pmBtn.addEventListener("click", function(e) {
            e.preventDefault();
            // Already here, do nothing or reload if needed
        });
    }
});

// --- Chat List Load ---
function loadChatList() {
    const members = getMemberList().filter(m=>m.username!==myUsername);
    const chatList = document.getElementById("chat-list");
    const messages = getMessages();

    // Build chat previews: sort by latest message, then by username
    let chats = members.map(m => {
        let userMsgs = messages.filter(msg =>
            (msg.from === myUsername && msg.to === m.username) ||
            (msg.to === myUsername && msg.from === m.username)
        );
        let lastMsg = userMsgs.length ? userMsgs[userMsgs.length-1] : null;
        return {
            username: m.username,
            avatar: m.username.charAt(0).toUpperCase(),
            lastMsg: lastMsg ? lastMsg.text : "",
            lastTime: lastMsg ? lastMsg.date : "",
            lastSender: lastMsg ? lastMsg.from : "",
            unread: userMsgs.filter(msg => msg.to === myUsername && !msg.read).length,
            role: m.role
        }
    }).sort((a,b)=>{
        // Sort by last message time descending, then by username
        if (a.lastTime && b.lastTime)
            return new Date(b.lastTime)-new Date(a.lastTime);
        else if (a.lastTime) return -1;
        else if (b.lastTime) return 1;
        return a.username.localeCompare(b.username);
    });

    chatList.innerHTML = chats.map(chat=>`
        <li class="${chat.username===activeChat ? "active" : ""}" data-user="${chat.username}">
            <span class="chat-avatar">${escapeHtml(chat.avatar)}</span>
            <span class="chat-info">
                <span class="chat-name">${escapeHtml(chat.username)}
                    ${chat.role ? `<span class="role-badge">${escapeHtml(chat.role)}</span>` : ""}
                </span><br>
                <span class="chat-last">${escapeHtml(chat.lastMsg)}</span>
            </span>
            ${chat.unread ? `<span class="chat-unread" style="color:#2de3ff;font-weight:bold;font-size:1.2em;">•</span>` : ""}
        </li>
    `).join('');
    // Listeners
    chatList.querySelectorAll("li").forEach(li=>{
        li.onclick = function(){
            showChat(li.getAttribute("data-user"));
        }
    });
}

// --- Show Chat ---
function showChat(username) {
    activeChat = username;
    const chatHeader = document.getElementById("chat-header");
    const chatUser = document.getElementById("chat-user");
    const messagesBox = document.getElementById("messages");
    if (!username) {
        chatHeader.style.visibility = "hidden";
        chatUser.innerHTML = "";
        messagesBox.innerHTML = `<div style="color:#b2bec3;text-align:center;margin-top:2em;">Select a chat to start messaging</div>`;
        document.getElementById("message-input").disabled = true;
        document.getElementById("send-btn").disabled = true;
        loadChatList();
        return;
    }
    chatHeader.style.visibility = "visible";
    // Show role badge in chat header
    let theirMember = getMemberList().find(m=>m.username===username);
    let theirRole = theirMember && theirMember.role ? `<span class="role-badge">${escapeHtml(theirMember.role)}</span>` : "";
    chatUser.innerHTML = `<span class="chat-avatar">${escapeHtml(username.charAt(0).toUpperCase())}</span>
        <span>${escapeHtml(username)}${theirRole}</span>`;
    document.getElementById("message-input").disabled = false;
    document.getElementById("send-btn").disabled = false;
    renderMessages(username);
    loadChatList();
}

// --- Render Messages ---
function renderMessages(username) {
    const messagesBox = document.getElementById("messages");
    const messages = getMessages();
    let userMsgs = messages.filter(msg =>
        (msg.from === myUsername && msg.to === username) ||
        (msg.to === myUsername && msg.from === username)
    );
    // Mark as read
    let updated = false;
    for (let msg of userMsgs) {
        if (msg.to === myUsername && !msg.read) {
            msg.read = true;
            updated = true;
        }
    }
    if (updated) setMessages(messages);

    if (!userMsgs.length) {
        messagesBox.innerHTML = `<div style="color:#b2bec3;text-align:center;margin-top:2em;">No messages yet. Say hello!</div>`;
        return;
    }
    messagesBox.innerHTML = userMsgs.map(msg=>{
        let isMe = msg.from === myUsername;
        return `
            <div class="message-row ${isMe?"me":"them"}">
                <div class="message-bubble">
                    ${escapeHtml(msg.text)}
                    <div class="message-meta">${escapeHtml(msg.date)}</div>
                </div>
            </div>
        `;
    }).join('');
    // Scroll to bottom
    messagesBox.scrollTop = messagesBox.scrollHeight + 90;
}

// --- Listeners ---
function setupListeners() {
    // Send message
    const messageForm = document.getElementById("message-form");
    messageForm.onsubmit = function(e){
        e.preventDefault();
        const inp = document.getElementById("message-input");
        const text = inp.value.trim();
        if (!text || !activeChat) return;
        let messages = getMessages();
        messages.push({
            from: myUsername,
            to: activeChat,
            text: text,
            date: new Date().toLocaleString(),
            read: false
        });
        setMessages(messages);
        inp.value = "";
        renderMessages(activeChat);
        loadChatList();
    }
    // Logout
    document.getElementById("logout-btn").onclick = function() {
        clearMemberSession();
        window.location = "index.html";
    }
    // Search
    document.getElementById("search-user").oninput = function() {
        let q = this.value.trim().toLowerCase();
        document.querySelectorAll("#chat-list li").forEach(li=>{
            let name = li.getAttribute("data-user").toLowerCase();
            if (name.includes(q)) li.style.display = "";
            else li.style.display = "none";
        });
    }
    // Enter sends message
    document.getElementById("message-input").addEventListener("keyup", function(e){
        if(e.key==="Enter" && !e.shiftKey){
            e.preventDefault();
            document.getElementById("send-btn").click();
        }
    });
}

// --- Sync across tabs ---
window.addEventListener('storage', function(e) {
    if (e.key === 'messages') {
        if (activeChat) renderMessages(activeChat);
        loadChatList();
    }
});
