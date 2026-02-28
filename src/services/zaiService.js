/**
 * Z.ai API Service
 * Handles communication with Z.AI models via REST API
 */

const ZAI_API_KEY = '0aa91aeed2ca438b802fe07220515705.BmC62zS8S2h9Rhfs';
const ZAI_BASE_URL = 'https://api.z.ai/v1';

class ZAIService {
  constructor(apiKey = ZAI_API_KEY) {
    this.apiKey = apiKey;
    this.model = 'minimax/minimax-m2.5:free';
  }

  /**
   * Set the model to use
   */
  setModel(modelName) {
    this.model = modelName;
  }

  /**
   * Generate content with tools (function calling)
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

      // Add tools if available
      if (tools.length > 0) {
        requestBody.tools = this.buildTools(tools);
        requestBody.tool_choice = "auto";
      }

      console.log('Z.AI Request:', JSON.stringify(requestBody, null, 2));

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
        console.error('Z.AI Error Response:', errorText);
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error?.message || error.message || 'API request failed');
        } catch (e) {
          throw new Error(errorText || 'API request failed');
        }
      }

      const data = await response.json();
      console.log('Z.AI Response:', JSON.stringify(data, null, 2));
      return this.parseResponse(data);
    } catch (error) {
      console.error('Z.AI API Error:', error);
      throw error;
    }
  }

  /**
   * Build messages array
   */
  buildMessages(history, currentPrompt) {
    const messages = [];
    
    // System prompt
    messages.push({
      role: 'system',
      content: 'You are an AI assistant. When asked to use a tool, use the function calling feature. Otherwise, respond conversationally in Spanish or English.'
    });

    // History
    history.forEach(msg => {
      if (msg.content) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    });

    // Current prompt
    messages.push({
      role: 'user',
      content: currentPrompt
    });

    return messages;
  }

  /**
   * Build tools in OpenAI format for Z.AI
   */
  buildTools(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }

  /**
   * Parse API response
   */
  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from model');
    }

    const message = choice.message;
    const result = {
      content: message.content || '',
      functionCalls: []
    };

    // Check for function calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      message.tool_calls.forEach(call => {
        let args = {};
        try {
          args = typeof call.function.arguments === 'string' 
            ? JSON.parse(call.function.arguments) 
            : call.function.arguments;
        } catch (e) {
          console.error('Failed to parse function arguments:', e);
        }
        
        result.functionCalls.push({
          name: call.function.name,
          arguments: args
        });
      });
    }

    return result;
  }
}

export const zaiService = new ZAIService();
export default ZAIService;
