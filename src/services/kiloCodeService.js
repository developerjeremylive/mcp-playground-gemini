/**
 * KiloCode API Service
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

// Default Cloudflare Worker proxy - uses workers.dev subdomain
const DEFAULT_PROXY = 'https://kilocode-proxy.b7a628f29ce7b9e4d28128bf5b4442b6.workers.dev/v1/chat/completions';

class KiloCodeService {
  constructor() {
    this.model = 'kilocode/anthropic/claude-haiku-3.5';
    this.supportsTools = true;
    this.apiKey = '';
    this.customProxy = DEFAULT_PROXY;
  }

  setApiKey(key) { this.apiKey = key; }
  getApiKey() { return this.apiKey; }
  setCustomProxy(url) { this.customProxy = url || DEFAULT_PROXY; }
  getCustomProxy() { return this.customProxy; }
  
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

    try {
      console.log('Calling proxy:', this.customProxy);
      const response = await fetch(this.customProxy, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Proxy error ${response.status}: ${err.substring(0, 100)}`);
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (e) {
      console.error('Error:', e.message);
      throw e;
    }
  }

  buildMessages(history, currentPrompt) {
    const messages = [];
    let systemContent = 'You are a helpful AI assistant. ';
    if (this.supportsTools) {
      systemContent += 'Use [TOOL:tool]args[/TOOL] for tools. ';
    }
    systemContent += 'Respond in Spanish or English.';
    messages.push({ role: 'system', content: systemContent });
    history.slice(-8).forEach(msg => { if (msg.content) messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }); });
    messages.push({ role: 'user', content: currentPrompt });
    return messages;
  }

  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No response from model');
    const content = choice.message?.content || '';
    const toolCalls = choice.message?.tool_calls || [];
    if (toolCalls && toolCalls.length > 0) {
      return { content, toolCall: { name: toolCalls[0].function.name, arguments: typeof toolCalls[0].function.arguments === 'string' ? JSON.parse(toolCalls[0].function.arguments) : toolCalls[0].function.arguments } };
    }
    return { content, toolCall: this.detectToolCallFromText(content) };
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
