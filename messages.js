// WhatsApp-style Messenger with Groups & Attachments

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
async function getMemberList() {
  const snap = await db.ref('members').once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val);
}
function getChatKey(myUsername, chatType, chatId) {
  // chatType: 'user' or 'group'
  return chatType === 'user' ? [myUsername, chatId].sort().join("___") : chatId;
}

// --- UI STATE ---
let myUsername = null;
let allMembers = [];
let chatsList = []; // [{type, id, name, lastMsg, unreadCount, ...}]
let currentChat = null; // {type, id, name, members}
let groupList = []; // [{id,name,members}]
let chatListeners = {};

function showLoader(show) {
  document.getElementById('loader-overlay').style.display = show ? "flex" : "none";
}

function renderChatList() {
  const listElem = document.getElementById("chat-list");
  const search = (document.getElementById("search-user").value || "").toLowerCase();
  let html = "";
  chatsList
    .filter(c => !search || c.name.toLowerCase().includes(search))
    .sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0))
    .forEach(chat => {
      html += `
        <li data-type="${chat.type}" data-id="${chat.id}" class="${currentChat && chat.id === currentChat.id && chat.type === currentChat.type ? "active" : ""}">
          <div class="chat-avatar">${escapeHtml(chat.name.charAt(0).toUpperCase())}</div>
          <div class="chat-info">
            <div class="chat-name">${escapeHtml(chat.name)}${chat.type === "group" ? ' <i class="fa-solid fa-users"></i>' : ""}</div>
            <div class="chat-last">${chat.lastMsg ? escapeHtml(chat.lastMsg) : ""}</div>
          </div>
          ${chat.unreadCount ? `<span class="chat-unread role-badge">${chat.unreadCount}</span>` : ""}
        </li>
      `;
    });
  listElem.innerHTML = html || `<li style="text-align:center;color:#7bffe9;">No chats</li>`;
  // Click handler
  Array.from(listElem.querySelectorAll("li")).forEach(li => {
    li.onclick = () => {
      openChat(li.getAttribute("data-type"), li.getAttribute("data-id"));
    };
  });
}

function renderGroupModal() {
  // Show modal and populate member checkboxes
  document.getElementById("group-modal").style.display = "flex";
  let html = '<label style="color:#7bffe9;">Members:</label><br>';
  allMembers.forEach(m => {
    if (m.username !== myUsername)
      html += `<label><input type="checkbox" class="group-member" value="${escapeHtml(m.username)}"> ${escapeHtml(m.username)}</label><br>`;
  });
  document.getElementById("group-members-list").innerHTML = html;
}

function closeGroupModal() {
  document.getElementById("group-modal").style.display = "none";
}

async function openChat(type, id) {
  // Remove previous listener
  if(currentChat && chatListeners[currentChat.type+"_"+currentChat.id]) {
    chatListeners[currentChat.type+"_"+currentChat.id]();
    delete chatListeners[currentChat.type+"_"+currentChat.id];
  }
  // Set current chat
  let name = "";
  let members = [];
  if(type === "user") {
    const user = allMembers.find(m => m.username === id);
    name = user ? user.username : id;
    members = [myUsername, id];
  } else {
    const group = groupList.find(g => g.id === id);
    name = group ? group.name : id;
    members = group ? group.members : [];
  }
  currentChat = { type, id, name, members };
  document.getElementById("chat-user").innerHTML =
    escapeHtml(name) + (type === "group" ? ' <i class="fa-solid fa-users"></i>' : "");
  // Load messages
  const messagesElem = document.getElementById("messages");
  messagesElem.innerHTML = `<div style="color:#7bffe9;padding:1em;text-align:center;">Loading...</div>`;
  // Listen for messages
  const chatKey = getChatKey(myUsername, type, id);
  const ref = db.ref('messages/' + chatKey);
  const listener = snap => {
    const val = snap.val();
    let msgs = [];
    if(val) {
      for(const k in val) msgs.push({ ...val[k], _key: k });
      msgs.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
    }
    messagesElem.innerHTML = msgs.length ? msgs.map(m => renderMessageBubble(m)).join("") :
      `<div style="color:#7bffe9;padding:1em;text-align:center;">No messages yet.</div>`;
    messagesElem.scrollTop = messagesElem.scrollHeight;
    // Mark as read
    db.ref('chats/'+myUsername+'/'+type+'_'+id+'/unreadCount').set(0);
  };
  ref.on('value', listener);
  chatListeners[type+"_"+id] = () => ref.off('value', listener);
}

function renderMessageBubble(m) {
  let isMe = m.from === myUsername;
  let attHtml = "";
  if(m.attachment) {
    if(m.attachment.type && m.attachment.type.startsWith("image/")) {
      attHtml = `<div style="margin-top:0.5em;"><img src="${escapeHtml(m.attachment.url)}" alt="attachment" style="max-width:180px;border-radius:8px;"/></div>`;
    } else {
      attHtml = `<div style="margin-top:0.5em;"><a href="${escapeHtml(m.attachment.url)}" target="_blank" style="color:#2de3ff;"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(m.attachment.name)}</a></div>`;
    }
  }
  return `
    <div class="message-row ${isMe ? 'me' : 'them'}">
      <div class="message-bubble">${m.text ? escapeHtml(m.text) : ""}
        ${attHtml}
        <div class="message-meta">${isMe ? "You" : escapeHtml(m.from)} &mdash; <span>${escapeHtml(m.time)}</span></div>
      </div>
    </div>
  `;
}

async function refreshChatList() {
  // Load direct chats (chats with messages)
  let userChatsSnap = await db.ref('chats/'+myUsername).once('value');
  let userChats = userChatsSnap.val() || {};
  let list = [];
  // Direct user chats
  Object.keys(userChats).forEach(chatKey => {
    if(chatKey.startsWith("user_")) {
      const otherUser = chatKey.slice(5);
      const user = allMembers.find(m => m.username === otherUser);
      list.push({
        type: "user",
        id: otherUser,
        name: user ? user.username : otherUser,
        lastMsg: userChats[chatKey].lastMsg || "",
        lastTime: userChats[chatKey].lastTime || 0,
        unreadCount: userChats[chatKey].unreadCount || 0
      });
    }
  });
  // Group chats
  groupList.forEach(g => {
    let gchat = userChats['group_'+g.id] || {};
    list.push({
      type: "group",
      id: g.id,
      name: g.name,
      lastMsg: gchat.lastMsg || "",
      lastTime: gchat.lastTime || 0,
      unreadCount: gchat.unreadCount || 0
    });
  });
  chatsList = list;
  renderChatList();
}

async function refreshGroups() {
  // Groups where user is a member
  let groupSnap = await db.ref('groups').once('value');
  let val = groupSnap.val() || {};
  groupList = Object.values(val).filter(g => g.members && g.members.includes(myUsername));
}

// --- Start ---
document.addEventListener("DOMContentLoaded", async function() {
  showLoader(true);
  myUsername = getMemberSession();
  if(!myUsername) {
    window.location.href = "index.html";
    return;
  }
  allMembers = await getMemberList();
  await refreshGroups();
  await refreshChatList();
  showLoader(false);

  //--- Chat list search
  document.getElementById("search-user").oninput = renderChatList;

  //--- New group
  document.getElementById("new-group-btn").onclick = function() {
    renderGroupModal();
  };
  document.getElementById("close-group-modal").onclick = closeGroupModal;
  document.getElementById("group-form").onsubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById("group-name").value.trim();
    const members = Array.from(document.querySelectorAll(".group-member:checked")).map(cb=>cb.value);
    if(!name || !members.length) return;
    members.push(myUsername); // Ensure creator is in group
    const id = "_g" + Math.random().toString(36).substr(2,9);
    await db.ref('groups/'+id).set({ id, name, members: Array.from(new Set(members)) });
    closeGroupModal();
    await refreshGroups();
    await refreshChatList();
  };

  //--- Logout
  document.getElementById("logout-btn").onclick = function() {
    clearMemberSession();
    window.location.href = "index.html";
  };

  //--- Attachments
  document.getElementById("attach-btn").onclick = function() {
    document.getElementById("chat-attachment").click();
  };

  let selectedAttachment = null;
  document.getElementById("chat-attachment").onchange = function(e) {
    selectedAttachment = e.target.files[0] || null;
    if(selectedAttachment) {
      document.getElementById("attach-btn").style.color = "#1daaff";
    } else {
      document.getElementById("attach-btn").style.color = "";
    }
  };

  //--- Message send
  document.getElementById("message-form").onsubmit = async function(e) {
    e.preventDefault();
    if(!currentChat) return;
    showLoader(true);
    let text = document.getElementById("message-input").value.trim();
    let att = selectedAttachment;
    let attObj = null;
    if(att) {
      // Upload to Firebase Storage
      let ref = storage.ref("attachments/"+Date.now()+"_"+att.name);
      let snapshot = await ref.put(att);
      let url = await snapshot.ref.getDownloadURL();
      attObj = { name: att.name, url, type: att.type };
    }
    let now = new Date();
    let msg = {
      from: myUsername,
      text,
      time: now.toLocaleString(),
      timeMs: now.getTime(),
      attachment: attObj
    };
    // To (for groups: group id, for users: other user)
    let chatKey = getChatKey(myUsername, currentChat.type, currentChat.id);
    // For direct chat, always set .to
    if(currentChat.type === "user") msg.to = currentChat.id;
    // Push message
    await db.ref('messages/'+chatKey).push(msg);
    // Update chat metadata for me and (for users) recipient or (for groups) all members
    let lastMsg = text || (attObj ? "Attachment" : "");
    let lastTime = now.getTime();
    // For direct chats
    if(currentChat.type === "user") {
      await db.ref('chats/'+myUsername+'/user_'+currentChat.id).update({ lastMsg, lastTime });
      await db.ref('chats/'+currentChat.id+'/user_'+myUsername).update({ lastMsg, lastTime, unreadCount: firebase.database.ServerValue.increment(1) });
    } else {
      // For group, update for all group members except sender
      for(const member of currentChat.members) {
        if(member === myUsername) {
          await db.ref('chats/'+member+'/group_'+currentChat.id).update({ lastMsg, lastTime });
        } else {
          await db.ref('chats/'+member+'/group_'+currentChat.id).update({ lastMsg, lastTime, unreadCount: firebase.database.ServerValue.increment(1) });
        }
      }
    }
    document.getElementById("message-input").value = "";
    document.getElementById("chat-attachment").value = "";
    selectedAttachment = null;
    document.getElementById("attach-btn").style.color = "";
    showLoader(false);
  };

  //--- Default open first chat
  setTimeout(() => {
    if(chatsList.length) openChat(chatsList[0].type, chatsList[0].id);
  }, 300);
});
