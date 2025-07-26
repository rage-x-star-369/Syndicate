// WhatsApp-style Private Messaging (one-to-one, two column)

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[m]);
}
function getMemberSession() {
  return sessionStorage.getItem("member_username");
}
function clearMemberSession() {
  sessionStorage.removeItem("member_username");
}

// Get all members except self
async function getMemberList() {
  const snap = await db.ref('members').once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val);
}

// Conversation key (sorted usernames)
function getConversationKey(userA, userB) {
  return [userA, userB].sort().join("___");
}

// --- UI State ---
let myUsername = null;
let allMembers = [];
let chatUsers = [];  // Users with whom there are messages
let currentRecipient = null;
let messageListener = null;

// --- DOM Elements ---
const chatListElem = () => document.getElementById("chat-list");
const chatHeaderElem = () => document.getElementById("chat-user");
const messagesElem = () => document.getElementById("messages");

// --- Loader ---
function showLoader(show) {
  document.getElementById('loader-overlay').style.display = show ? "flex" : "none";
}

// --- Render Chat List ---
function renderChatList() {
  const search = (document.getElementById("search-user").value || "").toLowerCase();
  const filtered = allMembers.filter(
    m => m.username !== myUsername && (!search || m.username.toLowerCase().includes(search))
  );
  // Show users with whom we have chat history at top
  const sorted = [
    ...filtered.filter(m => chatUsers.includes(m.username)),
    ...filtered.filter(m => !chatUsers.includes(m.username))
  ];

  chatListElem().innerHTML = sorted.length
    ? sorted.map(m =>
        `<li class="${currentRecipient===m.username ? "active" : ""}" data-username="${escapeHtml(m.username)}">
          <div class="chat-avatar">${escapeHtml(m.username.charAt(0).toUpperCase())}</div>
          <div class="chat-info">
            <div class="chat-name">${escapeHtml(m.username)}</div>
          </div>
        </li>`
      ).join("")
    : `<li style="text-align:center;color:#7bffe9;">No users</li>`;

  Array.from(chatListElem().querySelectorAll("li")).forEach(li => {
    li.onclick = () => openChat(li.getAttribute("data-username"));
  });
}

// --- Open Chat ---
function openChat(username) {
  if(messageListener) {
    messageListener.off();
    messageListener = null;
  }
  currentRecipient = username;
  chatHeaderElem().textContent = username ? username : "";
  messagesElem().innerHTML = `<div style="color:#7bffe9;padding:1em;text-align:center;">Loading...</div>`;
  renderChatList();

  // Listen for messages
  const convKey = getConversationKey(myUsername, currentRecipient);
  messageListener = db.ref('messages/' + convKey);
  messageListener.on('value', snap => {
    const val = snap.val();
    let msgs = [];
    if(val) {
      for(const k in val) msgs.push(val[k]);
      msgs.sort((a,b) => new Date(a.time) - new Date(b.time));
    }
    messagesElem().innerHTML = msgs.length
      ? msgs.map(m => renderMessageBubble(m)).join("")
      : `<div style="color:#7bffe9;padding:1em;text-align:center;">No messages yet.</div>`;
    messagesElem().scrollTop = messagesElem().scrollHeight;
  });
}

// --- Render Message Bubble ---
function renderMessageBubble(m) {
  const isMe = m.from === myUsername;
  return `
    <div class="message-row ${isMe ? 'me' : 'them'}">
      <div class="message-bubble">${escapeHtml(m.text)}
        <div class="message-meta">${isMe ? "You" : escapeHtml(m.from)} &mdash; <span>${escapeHtml(m.time)}</span></div>
      </div>
    </div>
  `;
}

// --- Refresh chatUsers list ---
async function updateChatUsers() {
  // Get all conversations under /messages
  const snap = await db.ref('messages').once('value');
  const val = snap.val() || {};
  chatUsers = [];
  Object.keys(val).forEach(k => {
    const users = k.split("___");
    if(users.includes(myUsername)) {
      const other = users[0] === myUsername ? users[1] : users[0];
      if(!chatUsers.includes(other)) chatUsers.push(other);
    }
  });
}

// --- MAIN ---
document.addEventListener("DOMContentLoaded", async function() {
  showLoader(true);
  myUsername = getMemberSession();
  if(!myUsername) {
    window.location.href = "index.html";
    return;
  }

  // Logout
  document.getElementById("logout-btn").onclick = function() {
    clearMemberSession();
    window.location.href = "index.html";
  };

  allMembers = await getMemberList();
  await updateChatUsers();
  renderChatList();
  showLoader(false);

  // Search users
  document.getElementById("search-user").oninput = renderChatList;

  // Open first chat by default (if any)
  if(chatUsers.length) openChat(chatUsers[0]);

  // Send message
  document.getElementById("message-form").onsubmit = async function(e) {
    e.preventDefault();
    const text = document.getElementById("message-input").value.trim();
    if(!text || !currentRecipient) return;
    const now = new Date();
    const msg = {
      from: myUsername,
      to: currentRecipient,
      text,
      time: now.toLocaleString()
    };
    const convKey = getConversationKey(myUsername, currentRecipient);
    const newMsgRef = db.ref('messages/' + convKey).push();
    await newMsgRef.set(msg);
    document.getElementById("message-input").value = "";
    await updateChatUsers();
    renderChatList();
  };
});
