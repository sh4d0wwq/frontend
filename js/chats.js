const chatList = document.getElementById('chats');
const chatWindow = document.getElementById('chat-window');
const chatName = document.getElementById('chat-name');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-btn');
const createChatButton = document.getElementById('create-chat-btn');
let currentChatId = null;
let messageOffset = 0;
const messageLimit = 20;
let allMessagesLoaded = false;
let isLoadingMessages = false;

let websocket = null;

window.addEventListener('DOMContentLoaded', async () => {
  const userId = localStorage.getItem("user_id");

  if (!userId) {
    window.location.href = '/index.html';
    return;
  }

  try {
    const res = await fetch(`http://localhost:8001/users/${userId}`, {
      credentials: 'include',
    });

    if (res.ok) {
      const user = await res.json();
      document.getElementById('user-username').textContent = user.username;
      document.getElementById('user-avatar').src = getAvatarUrl(user)
    }
  } catch (e) {
    console.error('Ошибка при загрузке пользователя:', e);
  }
});

function getAvatarUrl(userOrChat) {
  if (userOrChat.avatar_url) return `http://localhost:8001/users/avatar/${userOrChat.avatar_url}`;
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${userOrChat.username || userOrChat.contact_name}`;
}

function renderMessage(content, senderId, attachmentUrl = null, senderUsername = '', senderAvatarUrl = '') {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");

  const currentUserId = parseInt(localStorage.getItem("user_id"));
  if (senderId === currentUserId) {
    messageElement.classList.add("user");
  } else {
    messageElement.classList.add("other");
  }

  const senderInfo = document.createElement('div');
  senderInfo.classList.add('sender-info');

  const avatar = document.createElement('img');
  avatar.classList.add('sender-avatar');
  avatar.src = senderAvatarUrl
    ? `http://localhost:8001/users/avatar/${senderAvatarUrl}`
    : `https://api.dicebear.com/7.x/thumbs/svg?seed=${senderUsername || 'unknown'}`;

  const name = document.createElement('span');
  name.classList.add('sender-name');
  name.textContent = senderUsername || 'Неизвестный';

  senderInfo.appendChild(avatar);
  senderInfo.appendChild(name);
  messageElement.appendChild(senderInfo);

  const text = document.createElement('div');
  text.classList.add('message-text');
  text.textContent = content;
  messageElement.appendChild(text);

  if (attachmentUrl) {
    const attachmentLink = document.createElement('a');
    attachmentLink.href = `http://localhost:8002/chats/download/${attachmentUrl}`;
    attachmentLink.target = '_blank';
    attachmentLink.textContent = '📎 ' + attachmentUrl;
    attachmentLink.style.display = 'block';
    messageElement.appendChild(attachmentLink);
  }

  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderChatList(chats) {
  chatList.innerHTML = '';
  chats.forEach(chat => {
    const listItem = document.createElement('li');
    listItem.classList.add('chat-item');

    let avatar = null;
    if (chat.is_group) {
      avatar = document.createElement('div');
      avatar.classList.add('chat-avatar');
      avatar.textContent = '👥';
    }
    else {
      avatar = document.createElement('img');
      avatar.classList.add('chat-avatar')
      avatar.src = getAvatarUrl(chat)
    }

    const info = document.createElement('div');
    info.classList.add('chat-info');

    const title = document.createElement('div');
    title.classList.add('chat-title');
    title.textContent = chat.is_group ? chat.chat_name : chat.contact_name;

    const lastMsg = document.createElement('div');
    lastMsg.classList.add('chat-last-message');
    lastMsg.textContent = chat.last_message_obj?.content || '*Начните общение!*';

    info.appendChild(title);
    info.appendChild(lastMsg);

    listItem.appendChild(avatar);
    listItem.appendChild(info);

    listItem.onclick = () => openChat(chat.chat_id, chat.is_group ? chat.chat_name : chat.contact_name);
    chatList.appendChild(listItem);
  });
}

async function loadMessages() {
  if (allMessagesLoaded || isLoadingMessages || !currentChatId) return;
  isLoadingMessages = true;

  try {
    const response = await fetch(`http://localhost:8002/chats/msg/${currentChatId}?limit=${messageLimit}&offset=${messageOffset}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      const messages = data.messages;
      if (messages.length === 0) {
        allMessagesLoaded = true;
      } else {
        renderMessages(messages, { prepend: true });
        messageOffset += messages.length;
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки сообщений:', error);
  }

  isLoadingMessages = false;
}

async function openChat(chatId, name) {
  chatName.textContent = name;
  messagesContainer.innerHTML = '';
  currentChatId = chatId;
  messageOffset = 0;
  allMessagesLoaded = false;

  document.getElementById("chat-actions").classList.remove("hidden")
  await loadMessages();

  startWebSocket(chatId);
}

function startLongPolling() {
  setInterval(async () => {
    try {
      const response = await fetch('http://localhost:8002/chats/updates', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const chats = await response.json();
        renderChatList(chats);
      }
    } catch (error) {
    }
  }, 2000);
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message && !selectedFile) return; 

  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

  let attachmentUrl = null;

  if (selectedFile) {
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('http://localhost:8002/chats/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!uploadResponse.ok) {
        alert('Ошибка загрузки файла');
        return;
      }

      const uploadData = await uploadResponse.json();
      attachmentUrl = uploadData.url;
    } catch (err) {
      alert('Ошибка загрузки файла');
      return;
    }
  }

  const data = {
    content: message,
    attachment_url: attachmentUrl,
  };

  websocket.send(JSON.stringify(data));

  clearAttachment();
  messageInput.value = '';
  selectedFile = null;
  attachmentInput.value = '';
}



function startWebSocket(chatId) {
  if (websocket) {
    websocket.close();
  }

  websocket = new WebSocket(`ws://localhost:8002/ws/chat/${chatId}`);

  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      renderMessage(data.content, data.sender_id, data.attachment_url, data.sender_name, data.avatar_url);
    }
  };

  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  websocket.onclose = () => {
    console.log('WebSocket closed');
  };
}

function renderMessages(messages, { prepend = false } = {}) {
  const scrollPosition = messagesContainer.scrollHeight - messagesContainer.scrollTop;

  messages.forEach(msg => {
    const senderId = msg.sender_id;
    const senderUsername = msg.nickname || 'Пользователь';
    const senderAvatar = msg.avatar_url || '';

    const el = document.createElement("div");
    el.classList.add("message");
    el.classList.add(senderId === parseInt(localStorage.getItem("user_id")) ? "user" : "other");

    const senderInfo = document.createElement('div');
    senderInfo.classList.add('sender-info');

    const avatar = document.createElement('img');
    avatar.classList.add('sender-avatar');
    avatar.src = senderAvatar
      ? `http://localhost:8001/users/avatar/${senderAvatar}`
      : `https://api.dicebear.com/7.x/thumbs/svg?seed=${senderUsername}`;

    const name = document.createElement('span');
    name.classList.add('sender-name');
    name.textContent = senderUsername;

    senderInfo.appendChild(avatar);
    senderInfo.appendChild(name);
    el.appendChild(senderInfo);

    const text = document.createElement("div");
    text.classList.add('message-text');
    text.textContent = msg.content;
    el.appendChild(text);

    if (msg.attachment_url) {
      const a = document.createElement('a');
      a.href = `http://localhost:8002/chats/download/${msg.attachment_url}`;
      a.textContent = "📎 " + msg.attachment_url;
      a.target = "_blank";
      a.style.display = 'block';
      el.appendChild(a);
    }

    if (prepend) {
      messagesContainer.prepend(el);
    } else {
      messagesContainer.appendChild(el);
    }
  });

  if (prepend) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight - scrollPosition;
  } else {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}


messagesContainer.addEventListener('scroll', () => {
  if (messagesContainer.scrollTop === 0) {
    loadMessages();
  }
});

startLongPolling();

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function createChat() {
  const contactId = prompt('Enter contact ID to start a chat:'); 

  if (!contactId) return; 
  try {
    const response = await fetch(`http://localhost:8002/chats/p/${contactId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      await openChat(data.chat_id, user.username);
    } else {
      alert('Failed to create chat');
    }
  } catch (error) {
    console.error('Error creating chat:', error);
  }
}

document.getElementById('user-profile-container').addEventListener('click', () => {
  window.location.href = '/pages/profile.html';
});

const userSearchInput = document.getElementById('user-search-input');
const userSearchModal = document.getElementById('user-search-modal');
const userSearchResults = document.getElementById('user-search-results');
const closeModalBtn = document.getElementById('close-modal');

userSearchInput.addEventListener('input', async () => {
  const query = userSearchInput.value.trim();
  if (!query) {
    userSearchModal.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`http://localhost:8001/users/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.ok) {
      const users = await res.json();
      renderUserSearchResults(users);
      userSearchModal.classList.remove('hidden');
    } else {
      console.error('Ошибка при поиске пользователей');
    }
  } catch (err) {
    console.error('Ошибка поиска:', err);
  }
});

closeModalBtn.addEventListener('click', () => {
  userSearchModal.classList.add('hidden');
});

let selectedUserIdsForGroup = new Set();

function renderUserSearchResults(users) {
  userSearchResults.innerHTML = '';
  selectedUserIdsForGroup.clear();

  users.forEach(user => {
    const li = document.createElement('li');
    li.classList.add('user-search-item');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('user-checkbox');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedUserIdsForGroup.add(user.id);
      } else {
        selectedUserIdsForGroup.delete(user.id);
      }
    });

    const avatar = document.createElement('img');
    avatar.classList.add('user-avatar');
    avatar.src = user.avatar_url
      ? `http://localhost:8001/users/avatar/${user.avatar_url}`
      : `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.nickname}`;
    avatar.alt = 'Avatar';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = user.nickname;
    nameSpan.classList.add('user-name');

    const openChatBtn = document.createElement('button');
    openChatBtn.textContent = 'Открыть чат';
    openChatBtn.classList.add('open-chat-btn');
    openChatBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`http://localhost:8002/chats/p/${user.id}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          await openChat(data.chat_id, user.username);
          userSearchModal.classList.add('hidden');
        } else {
          alert('Не удалось открыть чат');
        }
      } catch (err) {
        console.error('Ошибка при открытии чата:', err);
      }
    });

    li.appendChild(checkbox);
    li.appendChild(avatar);
    li.appendChild(nameSpan);
    li.appendChild(openChatBtn);
    userSearchResults.appendChild(li);
  });

  const groupChatControls = document.createElement('div');
  groupChatControls.classList.add('group-chat-controls');

  const groupNameInput = document.createElement('input');
  groupNameInput.type = 'text';
  groupNameInput.placeholder = 'Введите название группы';
  groupNameInput.classList.add('group-chat-name-input');

  const createGroupBtn = document.createElement('button');
  createGroupBtn.textContent = 'Создать групповой чат';
  createGroupBtn.classList.add('create-group-btn');
  createGroupBtn.onclick = async () => {
    const selectedIds = Array.from(selectedUserIdsForGroup);
    const groupName = groupNameInput.value.trim();

    if (selectedIds.length < 2) {
      alert('Выберите минимум двух пользователей для группового чата.');
      return;
    }

    if (!groupName) {
      alert('Введите название группы.');
      return;
    }

    try {
      const res = await fetch('http://localhost:8002/chats/group', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_name: groupName,
          user_ids: selectedIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await openChat(data.chat_id, groupName);
        userSearchModal.classList.add('hidden');
      } else {
        alert('Не удалось создать групповой чат');
      }
    } catch (err) {
      console.error('Ошибка при создании группового чата:', err);
    }
  };

  groupChatControls.appendChild(groupNameInput);
  groupChatControls.appendChild(createGroupBtn);
  userSearchResults.appendChild(groupChatControls);
}


const attachButton = document.getElementById('attach-button');
const attachmentInput = document.getElementById('attachment-input');
let selectedFile = null;

attachButton.addEventListener('click', () => {
  attachmentInput.click();
});

attachmentInput.addEventListener('change', () => {
  if (attachmentInput.files.length > 0) {
    selectedFile = attachmentInput.files[0];
  }
});

const selectedFileInfo = document.getElementById('selected-file-info');
const selectedFileName = document.getElementById('selected-file-name');
const cancelAttachmentButton = document.getElementById('cancel-attachment-button');


attachmentInput.addEventListener('change', () => {
  if (attachmentInput.files.length > 0) {
    selectedFile = attachmentInput.files[0];
    selectedFileName.textContent = `📎 ${selectedFile.name}`;
    selectedFileInfo.classList.remove('hidden');
  } else {
    clearAttachment();
  }
});

function clearAttachment() {
  selectedFile = null;
  attachmentInput.value = '';
  selectedFileInfo.classList.add('hidden');
}

cancelAttachmentButton.addEventListener('click', () => {
  clearAttachment();
});

const addUserBtn = document.querySelector('.add-user-btn');
const addUserModal = document.getElementById('add-user-modal');
const addUserSearchInput = document.getElementById('add-user-search-input');
const addUserSearchResults = document.getElementById('add-user-search-results');

addUserBtn.addEventListener('click', () => {
  addUserModal.classList.remove('hidden');
  addUserSearchInput.value = '';
  addUserSearchResults.innerHTML = '';
});

document.getElementById("add-user-close-btn").addEventListener('click', () => {
  addUserModal.classList.add("hidden")
})

addUserSearchInput.addEventListener('input', async () => {
  const query = addUserSearchInput.value.trim();

  try {
    const res = await fetch(`http://localhost:8001/users/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      credentials: 'include',
    });

    const users = await res.json();
    addUserSearchResults.innerHTML = '';
    users.forEach(user => {
      const li = document.createElement('li');
      li.classList.add('user-search-item');
      
      const avatar = document.createElement('img');
      avatar.classList.add('user-avatar');
      avatar.src = user.avatar_url
        ? `http://localhost:8001/users/avatar/${user.avatar_url}`
        : `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.nickname}`;
      avatar.alt = 'Avatar';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = user.nickname;
      nameSpan.classList.add('user-name');

      li.addEventListener('click', async () => {
        await fetch(`http://localhost:8002/chats/add-user`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ chat_id: currentChatId, user_id: user.id })
        });
        addUserModal.classList.add('hidden');
      });
      li.appendChild(avatar);
      li.appendChild(nameSpan);
      addUserSearchResults.appendChild(li);
    });
  } catch (err) {
    console.error('Ошибка поиска:', err);
  }
});