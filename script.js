// DOM elements
const chatBody = document.querySelector("#messages-container");
const messageInput = document.querySelector("#message-input");
const sendMessageButton = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadButton = document.querySelector("#file-upload");
const newChatButton = document.querySelector("#new-chat");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebar = document.querySelector(".sidebar");
const welcomeScreen = document.querySelector("#welcome-screen");
const messagesContainer = document.querySelector("#messages-container");
const chatForm = document.querySelector("#chat-form");

// API setup
const API_KEY = "AIzaSyDOIH-OcvVEWnYsLSVroliw4cJNuC1H5p8";
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

const userData = {
  message: null,
  file: {
    data: null,
    mime_type: null,
  },
};

let chatHistory = [];
let currentChatId = null;
let chatSessions = new Map();

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  showWelcomeScreen();
  setupEventListeners();
  loadChatHistory();
});

// Event Listeners
function setupEventListeners() {
  // Chat form submission
  chatForm.addEventListener('submit', handleOutgoingMessage);
  
  // Enter key handling
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
      e.preventDefault();
      if (messageInput.value.trim()) {
        handleOutgoingMessage(e);
      }
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', handleTextareaResize);

  // File upload
  fileUploadButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileUpload);

  // New chat
  newChatButton.addEventListener('click', startNewChat);

  // Sidebar toggle (mobile)
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }

  // Example prompts
  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      messageInput.value = prompt;
      hideWelcomeScreen();
      handleOutgoingMessage(new Event('submit'));
    });
  });

  // Click outside to close sidebar on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// Utility functions
function showWelcomeScreen() {
  welcomeScreen.style.display = 'flex';
  messagesContainer.style.display = 'none';
}

function hideWelcomeScreen() {
  welcomeScreen.style.display = 'none';
  messagesContainer.style.display = 'block';
}

function toggleSidebar() {
  sidebar.classList.toggle('open');
}

function handleTextareaResize() {
  messageInput.style.height = 'auto';
  messageInput.style.height = messageInput.scrollHeight + 'px';
}

function handleFileUpload() {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64String = e.target.result.split(",")[1];
    userData.file = {
      data: base64String,
      mime_type: file.type,
    };
    // You can add UI feedback here for file upload
  };
  reader.readAsDataURL(file);
}

function startNewChat() {
  currentChatId = generateChatId();
  chatHistory = [];
  messagesContainer.innerHTML = '';
  showWelcomeScreen();
  messageInput.value = '';
  userData.file = { data: null, mime_type: null };
}

function generateChatId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function loadChatHistory() {
  // Load from localStorage or server
  const savedChats = localStorage.getItem('sgpt_chats');
  if (savedChats) {
    try {
      const chats = JSON.parse(savedChats);
      displayChatHistory(chats);
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  }
}

function saveChatSession() {
  if (!currentChatId || chatHistory.length === 0) return;
  
  const chatSession = {
    id: currentChatId,
    title: generateChatTitle(),
    messages: chatHistory,
    timestamp: Date.now()
  };
  
  chatSessions.set(currentChatId, chatSession);
  
  // Save to localStorage
  const chatsArray = Array.from(chatSessions.values());
  localStorage.setItem('sgpt_chats', JSON.stringify(chatsArray));
  
  updateHistoryDisplay();
}

function generateChatTitle() {
  const firstUserMessage = chatHistory.find(msg => msg.role === 'user');
  if (firstUserMessage && firstUserMessage.parts[0]?.text) {
    return firstUserMessage.parts[0].text.substring(0, 50) + (firstUserMessage.parts[0].text.length > 50 ? '...' : '');
  }
  return 'New Chat';
}

function displayChatHistory(chats) {
  const historyContainer = document.querySelector('#history-items');
  historyContainer.innerHTML = '';
  
  chats.sort((a, b) => b.timestamp - a.timestamp).forEach(chat => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.textContent = chat.title;
    historyItem.addEventListener('click', () => loadChat(chat.id));
    historyContainer.appendChild(historyItem);
    
    chatSessions.set(chat.id, chat);
  });
}

function updateHistoryDisplay() {
  const chatsArray = Array.from(chatSessions.values());
  displayChatHistory(chatsArray);
}

function loadChat(chatId) {
  const chat = chatSessions.get(chatId);
  if (!chat) return;
  
  currentChatId = chatId;
  chatHistory = [...chat.messages];
  
  hideWelcomeScreen();
  messagesContainer.innerHTML = '';
  
  // Display all messages in the chat
  chat.messages.forEach(message => {
    if (message.role === 'user') {
      displayUserMessage(message.parts[0].text, message.parts[1]?.inline_data);
    } else {
      displayBotMessage(message.parts[0].text);
    }
  });
  
  // Close sidebar on mobile after loading chat
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
  }
}

// Message display functions
function displayUserMessage(text, fileData = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  
  let attachmentHtml = '';
  if (fileData && fileData.data) {
    attachmentHtml = `<img src="data:${fileData.mime_type};base64,${fileData.data}" class="attachment" style="max-width: 200px; border-radius: 8px; margin-top: 8px;" />`;
  }
  
  messageDiv.innerHTML = `
    <div class="message-content">
      <div class="message-text">${text}</div>
      ${attachmentHtml}
    </div>
    <div class="message-avatar">U</div>
  `;
  
  messagesContainer.appendChild(messageDiv);
  scrollToBottom();
}

function displayBotMessage(text, isThinking = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message bot-message';
  
  if (isThinking) {
    messageDiv.classList.add('thinking');
    messageDiv.innerHTML = `
      <div class="message-avatar">S</div>
      <div class="message-content">
        <div class="message-text">
          <div class="thinking-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
        </div>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="message-avatar">S</div>
      <div class="message-content">
        <div class="message-text">${text}</div>
      </div>
    `;
  }
  
  messagesContainer.appendChild(messageDiv);
  scrollToBottom();
  
  return messageDiv;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Generate bot response using API
async function generateBotResponse(thinkingMessageDiv) {
  const messageTextElement = thinkingMessageDiv.querySelector('.message-text');

  // Add user message to chat history
  chatHistory.push({
    role: "user",
    parts: [
      { text: userData.message },
      ...(userData.file.data ? [{ inline_data: userData.file }] : []),
    ],
  });

  // API request options
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: chatHistory,
    }),
  };

  try {
    // Fetch bot response from API
    const response = await fetch(API_URL, requestOptions);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    // Extract and display the bot response
    const apiResponseText = data.candidates[0].content.parts[0].text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .trim();
    
    messageTextElement.innerHTML = apiResponseText;

    // Add bot response to chat history
    chatHistory.push({
      role: "model",
      parts: [{ text: apiResponseText }],
    });
    
    // Save the chat session
    saveChatSession();
    
  } catch (error) {
    console.error('API Error:', error);
    messageTextElement.innerHTML = `Sorry, I encountered an error: ${error.message}`;
    messageTextElement.style.color = "#ef4444";
  } finally {
    thinkingMessageDiv.classList.remove("thinking");
    scrollToBottom();
  }
}

// Handle outgoing user messages
function handleOutgoingMessage(e) {
  e.preventDefault();
  
  const message = messageInput.value.trim();
  if (!message) return;

  // Start new chat if this is the first message
  if (!currentChatId) {
    currentChatId = generateChatId();
    hideWelcomeScreen();
  }

  userData.message = message;
  
  // Clear input and reset file data
  messageInput.value = '';
  messageInput.style.height = 'auto';
  
  // Display user message
  displayUserMessage(message, userData.file.data ? userData.file : null);
  
  // Show bot thinking indicator
  const thinkingMessage = displayBotMessage('', true);
  
  // Generate bot response
  setTimeout(() => {
    generateBotResponse(thinkingMessage);
  }, 600);
  
  // Reset file data after sending
  userData.file = { data: null, mime_type: null };
  fileInput.value = '';
}


