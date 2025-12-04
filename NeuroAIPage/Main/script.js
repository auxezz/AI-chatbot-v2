// script.js - Main logic for the Neuro AI Chatbot
document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const chatBox = document.getElementById("chatBox");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const serverStatus = document.getElementById("serverStatus");
  const neuroCorner = document.getElementById("neuro-corner");
  const modelToggle = document.getElementById("modelToggle");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveApiKeyBtn = document.getElementById("saveApiKey");

  const BASE_URL = "http://127.0.0.1:5000";



  // chat window for messages ts lowkey ugly ngl
  function appendMessage(type, text) {
    const div = document.createElement("div");
    div.className = `msg ${type}`; 
    div.textContent = (type === "user" ? "You: " : type === "ai" ? "Neuro: " : "") + text;
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
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
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

  // Loads configuration from config 
  async function loadConfig() {
    if (!modelToggle) return;
    try {
      const res = await fetch(`${BASE_URL}/config`);
      if (res.ok) {
        const config = await res.json();
        modelToggle.checked = config.use_gemini;
        toggleApiKeyDisplay(config.use_gemini);
      }
    } catch (err) { console.error("Failed to load config", err); }
  }

  // Toggles visibility of API key 
  function toggleApiKeyDisplay(show) {
    if (apiKeyInput && saveApiKeyBtn) {
      apiKeyInput.style.display = show ? "block" : "none";
      saveApiKeyBtn.style.display = show ? "inline-block" : "none";
    }
  }

  

  // Send message on button click or Enter key
  if (sendButton) sendButton.onclick = (e) => { e.preventDefault(); sendMessage(); };
  if (userInput) userInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } };

  // Model toggle switch
  if (modelToggle) {
    modelToggle.onchange = async () => {
      const useGemini = modelToggle.checked;
      toggleApiKeyDisplay(useGemini);
      try {
        await fetch(`${BASE_URL}/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ use_gemini: useGemini })
        });
        appendMessage("info", `Switched to ${useGemini ? 'Gemini API' : 'Local Model'}`);
      } catch {
        appendMessage("info", "Failed to switch model");
        modelToggle.checked = !useGemini; // Revert on error
      }
    };
  }

  // Saves API Key button
  if (saveApiKeyBtn) {
    saveApiKeyBtn.onclick = async () => {
      const key = apiKeyInput.value.trim();
      if (!key) return appendMessage("info", "Enter an API key.");
      
      try {
        await fetch(`${BASE_URL}/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gemini_api_key: key })
        });
        appendMessage("info", "API key saved!");
        apiKeyInput.value = "";
      } catch { appendMessage("info", "Error saving API key"); }
    };
  }

  // Clear History shit button 
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

  // Start up shit 
  checkServerStatus();
  loadConfig();
  loadHistory();
  setInterval(checkServerStatus, 5000); // Check server status every 5 seconds
});
