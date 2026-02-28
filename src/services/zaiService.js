/**
 * Z.ai API Service
 * Handles communication with Z.AI models - with MCP tool detection
 */

const ZAI_API_KEY = '0aa91aeed2ca438b802fe07220515705.BmC62zS8S2h9Rhfs';
const ZAI_BASE_URL = 'https://api.z.ai/v1';

// MCP tools descriptions for the LLM
const MCP_TOOLS_INFO = `
You have access to these MCP tools:
- filesystem: read_file, write_file, list_directory, create_directory, delete
- memory: append, query, list_collections, create_collection
- fetch: fetch (get content from URLs)
- time: get_current_time, get_timezone
- git: git_status, git_log, git_branch
- http: request
- sqlite: query
- context7: search_docs
- sequentialthinking: think
- puppeteer: navigate, screenshot

When the user asks to use a tool, respond in this format:
[TOOL:tool_name]argument1=value1&argument2=value2[/TOOL]

For example:
- "What time is it?" -> [TOOL:get_current_time][/TOOL]
- "Save this: hello world" -> [TOOL:write_file]path=/test.txt&content=hello world[/TOOL]
- "List files" -> [TOOL:list_directory]path=/[/TOOL]
`;

class ZAIService {
  constructor(apiKey = ZAI_API_KEY) {
    this.apiKey = apiKey;
    this.model = 'minimax/minimax-m2.5:free';
  }

  setModel(modelName, supportsTools = true) {
    this.model = modelName;
    this.supportsTools = supportsTools;
  }

  supportsMCP() {
    return this.supportsTools;
  }

  /**
   * Generate content with MCP tool detection
   */
  async generateContent(prompt, tools = [], conversationHistory = []) {
    try {
      const messages = this.buildMessages(conversationHistory, prompt);
      
      const requestBody = {
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096
      };

      const response = await fetch(
        `${ZAI_BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'API request failed');
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('Z.AI Error:', error);
      throw error;
    }
  }

  /**
   * Build messages with MCP context
   */
  buildMessages(history, currentPrompt) {
    const messages = [];
    
    // System prompt
    let systemContent = 'Eres un asistente útil y amigable. ';
    
    if (this.supportsTools) {
      systemContent += MCP_TOOLS_INFO;
      systemContent += '\n\nWhen you need to use a tool, respond with [TOOL:name]args[/TOOL] format. Otherwise, respond conversationally in Spanish or English.';
    } else {
      systemContent += 'Responde de manera clara y concisa en español o inglés.';
    }

    messages.push({ role: 'system', content: systemContent });

    // History (last 8 messages)
    history.slice(-8).forEach(msg => {
      if (msg.content) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    });

    messages.push({ role: 'user', content: currentPrompt });

    return messages;
  }

  /**
   * Parse response and detect tool calls
   */
  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from model');
    }

    const content = choice.message?.content || '';
    
    // Detect tool calls in response
    const toolCall = this.detectToolCall(content);
    
    return {
      content: content,
      toolCall: toolCall
    };
  }

  /**
   * Detect tool call from response
   */
  detectToolCall(content) {
    // Look for [TOOL:tool_name]args[/TOOL] pattern
    const toolPattern = /\[TOOL:(\w+)\](.*?)\[\/TOOL\]/g;
    const match = toolPattern.exec(content);
    
    if (match) {
      const toolName = match[1];
      const argsStr = match[2];
      
      // Parse arguments
      const args = {};
      if (argsStr) {
        argsStr.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            args[key] = decodeURIComponent(value);
          }
        });
      }
      
      return { name: toolName, arguments: args };
    }
    
    return null;
  }
}

export const zaiService = new ZAIService();
export default ZAIService;
