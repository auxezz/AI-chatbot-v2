// script.js - Main logic for the Neuro AI Chatbot
document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const chatBox = document.getElementById("chatBox");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const serverStatus = document.getElementById("serverStatus");
  const neuroCorner = document.getElementById("neuro-corner");

  const BASE_URL = "http://127.0.0.1:5000";
  
  // Get username from storage, default to "User" if not set (or redirect)
  const username = localStorage.getItem('neuro_username') || "User";
  
  // Optional: Redirect to login if no username (uncomment if desired)
  // if (!localStorage.getItem('neuro_username')) window.location.href = 'login.html';

  // API Key Modal Elements
  const apiKeyModal = document.getElementById("apiKeyModal");
  const modalApiKeyInput = document.getElementById("modalApiKeyInput");
  const modalSaveBtn = document.getElementById("modalSaveBtn");
  const modalError = document.getElementById("modalError");

  // Check if API key is set
  async function checkApiKey() {
    try {
      const res = await fetch(`${BASE_URL}/config`);
      if (res.ok) {
        const config = await res.json();
        if (!config.has_api_key) {
          showApiKeyModal();
        }
      }
    } catch (err) {
      console.error("Failed to check API key config", err);
    }
  }

  function showApiKeyModal() {
    if (apiKeyModal) {
      apiKeyModal.style.display = "flex";
      modalApiKeyInput.focus();
    }
  }

  function hideApiKeyModal() {
    if (apiKeyModal) apiKeyModal.style.display = "none";
  }

  if (modalSaveBtn) {
    modalSaveBtn.onclick = async () => {
      const key = modalApiKeyInput.value.trim();
      if (!key) {
        modalError.textContent = "Please enter an API key.";
        modalError.style.color = "#ff99aa";
        modalError.style.display = "block";
        return;
      }

      // Show checking status
      modalError.textContent = "Checking API key...";
      modalError.style.color = "#8fffd4";
      modalError.style.display = "block";
      modalSaveBtn.disabled = true;

      try {
        const res = await fetch(`${BASE_URL}/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gemini_api_key: key })
        });
        
        const data = await res.json();
        if (data.status === "success" && data.model_available) {
           hideApiKeyModal();
           appendMessage("info", "API Key saved successfully! You can now chat.");
           modalError.style.display = "none";
        } else {
           modalError.textContent = "Failed to save key or key invalid.";
           modalError.style.color = "#ff99aa";
           modalError.style.display = "block";
        }
      } catch (err) {
        modalError.textContent = "Error connecting to server.";
        modalError.style.color = "#ff99aa";
        modalError.style.display = "block";
      } finally {
        modalSaveBtn.disabled = false;
      }
    };
  }

  // chat window for messages
  function appendMessage(type, text) {
    const div = document.createElement("div");
    div.className = `msg ${type}`; 
    // Use the stored username for user messages
    const label = type === "user" ? `${username}: ` : type === "ai" ? "Neuro: " : "";
    div.textContent = label + text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto scroll
    return div;
  }

  // Sends the users message
  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage("user", text);
    userInput.value = "";

    // placeholder 
    const aiMsg = document.createElement("div");
    aiMsg.className = "msg ai";
    aiMsg.textContent = "Neuro: thinking";
    chatBox.appendChild(aiMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      // Send username along with message if backend supports it, 
      // or just send message. For now, we just send message.
      // To make AI know the name, we could prepend it to the message content
      // or update the backend to accept a 'user' field.
      // Let's prepend it to the content stored in memory so context is preserved.
      
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: text,
          username: username // Sending username in case backend is updated to use it
        })
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      const reply = data.response || data.reply || "[no response]";

      // Use NeuroSpin animation 
      if (window.NeuroSpin?.animateText) {
        await window.NeuroSpin.animateText(aiMsg, "Neuro: ", reply);
      } else {
        // If NeuroSpin is missing
        aiMsg.textContent = "Neuro: " + reply;
      }
    } catch (err) {
      console.error(err);
      aiMsg.textContent = "Neuro: [Connection Error]";
    }
  }

  // Checks if the python server is running
  async function checkServerStatus() {
    try {
      const res = await fetch(`${BASE_URL}/ping`);
      serverStatus.textContent = res.ok ? "online" : "offline";
      serverStatus.style.color = res.ok ? "#8fffd4" : "#ff99aa";
    } catch {
      serverStatus.textContent = "offline";
      serverStatus.style.color = "#ff99aa";
    }
  }

  // Loads chat history from memory file
  async function loadHistory() {
    try {
      const res = await fetch(`${BASE_URL}/memory`);
      if (res.ok) {
        const history = await res.json();
        chatBox.innerHTML = ""; // Clear current view
        history.forEach(msg => appendMessage(msg.role === "user" ? "user" : "ai", msg.content));
      }
    } catch (err) { console.error("Failed to load history", err); }
  }

  // Send message on button click or Enter key
  if (sendButton) sendButton.onclick = (e) => { e.preventDefault(); sendMessage(); };
  if (userInput) userInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } };

  // Clear History button 
  if (sendButton) {
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear History";
    clearBtn.id = "clearButton";
    sendButton.parentNode.insertBefore(clearBtn, sendButton.nextSibling);
    
    clearBtn.onclick = async (e) => {
      e.preventDefault();
      try {
        await fetch(`${BASE_URL}/clear_memory`, { method: "POST" });
        chatBox.innerHTML = "";
        loadHistory();
      } catch { appendMessage("info", "Failed to clear history."); }
    };
  }

  // NeuroSpin 
  if (window.NeuroSpin?.init) window.NeuroSpin.init('neuro-corner');

  // Secret skip for API key modal (3 clicks on Neuro)
  let neuroClickCount = 0;
  let neuroClickTimer = null;

  if (neuroCorner) {
    neuroCorner.addEventListener('click', () => {
      neuroClickCount++;
      
      if (neuroClickTimer) clearTimeout(neuroClickTimer);
      
      neuroClickTimer = setTimeout(() => {
        neuroClickCount = 0;
      }, 1000); // Reset count if not clicked 3 times within 1 second

      if (neuroClickCount >= 3) {
        hideApiKeyModal();
        appendMessage("info", "Developer Mode: API Key check skipped. Bot may not function.");
        neuroClickCount = 0;
      }
    });
  }

  // Start up shit 
  checkServerStatus();
  loadHistory();
  checkApiKey();
  setInterval(checkServerStatus, 5000); // Check server status every 5 seconds
});
