/**
 * KiloCode API Service
 * Direct call to Netlify function
 */

const MODEL_CONFIG = {
  'kilocode/anthropic/claude-opus-4.6': { name: 'Claude Opus', supportsTools: true, provider: 'Anthropic' },
  'kilocode/anthropic/claude-sonnet-4.6': { name: 'Claude Sonnet', supportsTools: true, provider: 'Anthropic' },
  'kilocode/anthropic/claude-haiku-3.5': { name: 'Claude Haiku', supportsTools: true, provider: 'Anthropic' },
  'kilocode/google/gemini-pro-1.5': { name: 'Gemini Pro 1.5', supportsTools: true, provider: 'Google' },
  'kilocode/google/gemini-flash-1.5': { name: 'Gemini Flash 1.5', supportsTools: true, provider: 'Google' },
  'kilocode/meta-llama/llama-3.1-70b-instruct': { name: 'Llama 3.1 70B', supportsTools: true, provider: 'Meta' },
  'kilocode/meta-llama/llama-3.1-8b-instruct': { name: 'Llama 3.1 8B', supportsTools: true, provider: 'Meta' },
  'kilocode/qwen/qwen-2-72b-instruct': { name: 'Qwen 2 72B', supportsTools: true, provider: 'Qwen' },
  'kilocode/microsoft/phi-3-mini-128k-instruct': { name: 'Phi-3 Mini', supportsTools: false, provider: 'Microsoft' },
  'kilocode/mistralai/mistral-7b-instruct-v0.2': { name: 'Mistral 7B', supportsTools: false, provider: 'Mistral' }
};

// Direct function URL
const FUNCTION_URL = 'https://mcp-gemini-ai.netlify.app/.netlify/functions/chat';

class KiloCodeService {
  constructor() {
    this.model = 'kilocode/anthropic/claude-haiku-3.5';
    this.supportsTools = true;
    this.apiKey = '';
  }

  setApiKey(key) { this.apiKey = key; }
  getApiKey() { return this.apiKey; }
  setModel(modelName) {
    this.model = modelName;
    const config = MODEL_CONFIG[modelName] || { supportsTools: false };
    this.supportsTools = config.supportsTools;
  }
  supportsMCP() { return this.supportsTools; }
  getModelConfig(modelName) { return MODEL_CONFIG[modelName] || { name: modelName, supportsTools: false }; }
  static getModels() { return MODEL_CONFIG; }

  async generateContent(prompt, tools = [], conversationHistory = []) {
    if (!this.apiKey) {
      throw new Error('API Key not configured. Please add your KiloCode API key in Settings.');
    }

    try {
      const messages = this.buildMessages(conversationHistory, prompt);
      
      const requestBody = {
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,
        apiKey: this.apiKey
      };

      if (this.supportsTools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = "auto";
      }

      console.log('Calling function directly at:', FUNCTION_URL);
      
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Function error:', errorText);
        throw new Error(errorText || `Function error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Success!');

      if (data.error) {
        throw new Error(data.error.message || data.error);
      }

      return this.parseResponse(data);
    } catch (error) {
      console.error('KiloCode Error:', error);
      throw error;
    }
  }

  buildMessages(history, currentPrompt) {
    const messages = [];
    let systemContent = 'You are a helpful AI assistant. ';
    
    if (this.supportsTools) {
      systemContent += this.getToolsPrompt();
      systemContent += '\n\nWhen you need to use a tool, respond with [TOOL:tool_name]arg1=value1&arg2=value2[/TOOL]. Otherwise, respond in Spanish or English.';
    } else {
      systemContent += 'Respond in Spanish or English clearly and concisely.';
    }

    messages.push({ role: 'system', content: systemContent });

    history.slice(-8).forEach(msg => {
      if (msg.content) {
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
      }
    });

    messages.push({ role: 'user', content: currentPrompt });
    return messages;
  }

  getToolsPrompt() {
    return `
You have access to these MCP tools:
- filesystem: read_file(path), write_file(path, content), list_directory(path), create_directory(path), delete(path)
- memory: append(collection, content), query(collection, query, limit), list_collections(), create_collection(name)
- fetch: fetch(url, max_length)
- time: get_current_time(), get_timezone(timezone)
- git: git_status(repo_path), git_log(repo_path, max_count), git_branch(repo_path)
- http: request(method, url, headers, body)
- sqlite: query(database, query)
- context7: search_docs(query, source)
- sequentialthinking: think(thought, context, depth)
Use tools when appropriate to help the user.`;
  }

  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No response from model');

    const content = choice.message?.content || '';
    const toolCalls = choice.message?.tool_calls || [];
    
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      return {
        content: content,
        toolCall: {
          name: toolCall.function.name,
          arguments: typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments
        }
      };
    }
    
    return { content: content, toolCall: this.detectToolCallFromText(content) };
  }

  detectToolCallFromText(content) {
    const toolPattern = /\[TOOL:(\w+)\](.*?)\[\/TOOL\]/s;
    const match = content.match(toolPattern);
    
    if (match) {
      const toolName = match[1];
      const argsStr = match[2];
      const args = {};
      if (argsStr) {
        argsStr.split('&').forEach(pair => {
          const [key, ...valueParts] = pair.split('=');
          if (key && valueParts.length > 0) args[key] = decodeURIComponent(valueParts.join('='));
        });
      }
      return { name: toolName, arguments: args };
    }
    return null;
  }
}

export const kiloCodeService = new KiloCodeService();
export { MODEL_CONFIG };
export default KiloCodeService;
