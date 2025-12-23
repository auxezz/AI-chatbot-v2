from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPICallError

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Serve the parent directory (NeuroAIPage) as the static folder so
# sibling folders like Background/ and NeuroSpin/ are reachable
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

MEMORY_FILE = os.path.join(SCRIPT_DIR, "memory.json")
PROMPT_FILE = os.path.join(SCRIPT_DIR, "../Configs/prompt.json")
CONFIG_FILE = os.path.join(SCRIPT_DIR, "../Configs/config.json")

app = Flask(__name__, static_folder=ROOT_DIR, static_url_path='')
CORS(app)  


def load_json_file(path, default_value):
    if not os.path.exists(path):
        print(f"Warning: {path} not found. Using default value.")
        return default_value
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except json.JSONDecodeError:
        print(f"Warning: {path} is empty or corrupted. Using default value.")
        return default_value
    except Exception as e:
        print(f"Warning: failed to load {path}: {e}. Using default value.")
        return default_value

def save_memory(path, memory_obj):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(memory_obj, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error: failed to save memory to {path}: {e}")


prompt_config = load_json_file(PROMPT_FILE, {"system_prompt": "", "memory_length": 8})

system_prompt = prompt_config.get("system_prompt", "")
memory_length = prompt_config.get("memory_length", 8)

print(f"System prompt: {system_prompt}")
print(f"Memory length: {memory_length} messages")

memory = load_json_file(MEMORY_FILE, [])
if not isinstance(memory, list):
    print("Warning: memory.json is not a list. Resetting to empty.")
    memory = []

config = load_json_file(CONFIG_FILE, {"gemini_api_key": ""})
gemini_api_key = config.get("gemini_api_key", "")

gemini_model = None
GEMINI_MODEL_NAME = 'gemini-2.5-flash' 

def initialize_gemini():
    global gemini_model
    if gemini_api_key and gemini_api_key != "Your-Gemini-API-Key-Here":
        print(f"Configuring Google Gemini API for {GEMINI_MODEL_NAME}...")
        try:
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel(GEMINI_MODEL_NAME)
            
            # Validate the key by making a minimal request
            try:
                print("Validating API key...")
                model.generate_content("test")
                print("Gemini API key verified successfully!")
                gemini_model = model
                return True
            except Exception as e:
                error_str = str(e)
                print(f"API Key validation check: {error_str}")
                
                # Check for specific invalid key errors
                if "API_KEY_INVALID" in error_str or "API key not valid" in error_str:
                    print("Invalid API Key detected. User will be prompted.")
                    gemini_model = None
                    return False
                else:
                    print("Validation failed but not due to invalid key (likely network). Keeping model.")
                    gemini_model = model
                    return True
                
        except Exception as e:
            print(f"Error configuring Gemini API: {e}")
            gemini_model = None
            return False
    else:
        print("Warning: No API key provided for Gemini.")
        gemini_model = None
        return False

initialize_gemini()

@app.route("/")
def index():
    # Serve the new index page
    return app.send_static_file('Main/index.html')

@app.route("/login")
def login_page():
    return app.send_static_file('Main/login.html')

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "online", "model_mode": "Gemini"})

@app.route("/memory", methods=["GET"])
def get_memory():
    return jsonify(memory)

@app.route("/chat", methods=["POST"])
def chat():
    global memory, gemini_model
    
    data = request.get_json()
    user_message = data.get("message", "")
    
    if not user_message:
        return jsonify({"response": "I didn't receive a message."})

    memory.append({"role": "user", "content": user_message})

    recent_messages = memory[-memory_length:]
    
    response_text = ""
    
    if gemini_model:
        print(f"Generating response with Gemini API ({GEMINI_MODEL_NAME}, using last {len(recent_messages)} messages)...")
        
        conversation_parts = [system_prompt]
        for m in recent_messages:
            role_prefix = "User" if m["role"] == "user" else "Neuro"
            conversation_parts.append(f"{role_prefix}: {m['content']}")
        conversation_parts.append("Neuro:")
        
        full_prompt = "\n".join(conversation_parts)
        
        try:
            response = gemini_model.generate_content(full_prompt)
            
            if response.candidates and response.candidates[0].finish_reason.name == 'SAFETY':
                print(f"Gemini blocked the prompt.")
                response_text = "Filtered"
            elif not response.text:
                print("Gemini returned empty response or candidate.")
                response_text = "Somone tell Vedal there is a problem with my Internet"
            else:
                response_text = response.text.strip()
        
        except GoogleAPICallError as e:
            print(f"Somone tell Vedal there is a problem with my API: {type(e).__name__}: {e}")
            error_message = str(e).lower()
            if "invalid api key" in error_message or "permission denied" in error_message:
                response_text = "Somone tell Vedal there is a problem with my API"
            elif "quota" in error_message or "limit" in error_message or "resource_exhausted" in error_message:
                response_text = "API quota exceeded. Please try again later."
            else:
                response_text = f"API error: {str(e)[:100]}"
        except Exception as e:
            print(f"Unexpected Error during Gemini call: {type(e).__name__}: {e}")
            response_text = f"Somone tell Vedal there is a problem with my AI: {str(e)[:100]}"
    
    else:
        response_text = "Gemini API is not configured. Please check your API key."

    memory.append({"role": "assistant", "content": response_text})
    save_memory(MEMORY_FILE, memory)

    return jsonify({"response": response_text})

@app.route("/clear_memory", methods=["POST"])
def clear_memory():
    global memory
    memory = []
    save_memory(MEMORY_FILE, memory)
    print("Memory cleared.")
    return jsonify({"status": "cleared"})

@app.route("/config", methods=["GET"])
def get_config():
    has_key = bool(gemini_api_key) and gemini_api_key != "Your-Gemini-API-Key-Here"
    return jsonify({
        "has_api_key": has_key,
        "model_available": gemini_model is not None
    })

@app.route("/config", methods=["POST"])
def update_config():
    global config, gemini_api_key, gemini_model
    
    try:
        data = request.get_json()
        
        if "gemini_api_key" in data and data["gemini_api_key"] != gemini_api_key:
            gemini_api_key = data["gemini_api_key"]
            config["gemini_api_key"] = gemini_api_key
            print("API key updated")
            initialize_gemini()

        save_memory(CONFIG_FILE, config)
        
        return jsonify({
            "status": "success",
            "model_available": gemini_model is not None
        })
    
    except Exception as e:
        print(f"Error in update_config: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    import webbrowser
    import threading
    
    print("\nNeuro Chatbot Server")
    print("Server running at http://127.0.0.1:5000")
    print("Opening browser...")
    print("Press Ctrl+C to stop\n")
    
    def open_browser():
        import time
        time.sleep(1.5)
        webbrowser.open('http://127.0.0.1:5000')
    
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host="127.0.0.1", port=5000)