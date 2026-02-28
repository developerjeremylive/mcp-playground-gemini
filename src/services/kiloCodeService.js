/**
 * KiloCode API Service
 * Using Workers AI as alternative
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

// Fallback to free LLM APIs that work from browser
const FALLBACK_APIS = {
  // Uses Claude API directly (no CORS issues)
  'claude': async (messages, apiKey) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: messages
      })
    });
    const data = await response.json();
    return {
      choices: [{ message: { content: data.content[0].text } }]
    };
  }
};

const KILOCODE_API = 'https://api.kilocode.ai/v1/chat/completions';

class KiloCodeService {
  constructor() {
    this.model = 'kilocode/anthropic/claude-haiku-3.5';
    this.supportsTools = true;
    this.apiKey = '';
    this.customProxy = '';
  }

  setApiKey(key) { this.apiKey = key; }
  getApiKey() { return this.apiKey; }
  setCustomProxy(url) { this.customProxy = url; }
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

    const messages = this.buildMessages(conversationHistory, prompt);
    
    const requestBody = {
      model: this.model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096
    };

    if (this.supportsTools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto";
    }

    // Try custom proxy first
    if (this.customProxy) {
      try {
        console.log('Trying custom proxy...');
        const response = await fetch(this.customProxy, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
          body: JSON.stringify(requestBody)
        });
        if (response.ok) {
          const data = await response.json();
          return this.parseResponse(data);
        }
      } catch (e) { console.log('Custom proxy failed:', e.message); }
    }

    // Try direct KiloCode API
    try {
      console.log('Trying KiloCode API directly...');
      const response = await fetch(KILOCODE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      if (response.ok) {
        const data = await response.json();
        return this.parseResponse(data);
      }
    } catch (e) { console.log('KiloCode direct failed:', e.message); }

    // Try Netlify function
    try {
      console.log('Trying Netlify function...');
      const nfResponse = await fetch('https://mcp-gemini-ai.netlify.app/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, apiKey: this.apiKey })
      });
      if (nfResponse.ok) {
        const data = await nfResponse.json();
        return this.parseResponse(data);
      }
    } catch (e) { console.log('Netlify failed:', e.message); }

    throw new Error('Unable to connect. Please set up a custom proxy or try again later.');
  }

  buildMessages(history, currentPrompt) {
    const messages = [];
    let systemContent = 'You are a helpful AI assistant. ';
    
    if (this.supportsTools) {
      systemContent += this.getToolsPrompt();
      systemContent += '\n\nWhen you need to use a tool, respond with [TOOL:tool_name]args[/TOOL]. Otherwise, respond in Spanish or English.';
    } else {
      systemContent += 'Respond in Spanish or English clearly and concisely.';
    }

    messages.push({ role: 'system', content: systemContent });
    history.slice(-8).forEach(msg => { if (msg.content) messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }); });
    messages.push({ role: 'user', content: currentPrompt });
    return messages;
  }

  getToolsPrompt() {
    return `You have access to MCP tools: filesystem, memory, fetch, time, git, http, sqlite, context7, sequentialthinking. Use [TOOL:tool_name]args[/TOOL] format when needed.`;
  }

  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No response from model');
    const content = choice.message?.content || '';
    const toolCalls = choice.message?.tool_calls || [];
    
    if (toolCalls && toolCalls.length > 0) {
      return {
        content: content,
        toolCall: { name: toolCalls[0].function.name, arguments: typeof toolCalls[0].function.arguments === 'string' ? JSON.parse(toolCalls[0].function.arguments) : toolCalls[0].function.arguments }
      };
    }
    return { content: content, toolCall: this.detectToolCallFromText(content) };
  }

  detectToolCallFromText(content) {
    const match = content.match(/\[TOOL:(\w+)\](.*?)\[\/TOOL\]/s);
    if (match) {
      const args = {};
      if (match[2]) match[2].split('&').forEach(pair => { const [k, ...v] = pair.split('='); if (k && v.length) args[k] = decodeURIComponent(v.join('=')); });
      return { name: match[1], arguments: args };
    }
    return null;
  }
}

export const kiloCodeService = new KiloCodeService();
export { MODEL_CONFIG };
export default KiloCodeService;
