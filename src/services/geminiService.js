/**
 * Gemini API Service
 * Handles communication with Google's Gemini API via REST
 */

const GEMINI_API_KEY = 'AIzaSyDu9pmFF4pL-CcNjZWIPu7WgCz14vTG5bA';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

class GeminiService {
  constructor(apiKey = GEMINI_API_KEY) {
    this.apiKey = apiKey;
    this.model = 'gemini-3-flash-preview';
  }

  /**
   * Generate content with tools
   */
  async generateContent(prompt, tools = [], conversationHistory = []) {
    try {
      const contents = this.buildContents(conversationHistory, prompt);
      
      const requestBody = {
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 4096,
        },
        tools: tools.length > 0 ? this.buildTools(tools) : []
      };

      const response = await fetch(
        `${GEMINI_BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  /**
   * Build conversation contents
   */
  buildContents(history, currentPrompt) {
    const contents = [];
    
    history.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: currentPrompt }]
    });

    return contents;
  }

  /**
   * Build tools for Gemini
   */
  buildTools(tools) {
    return [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || {
          type: 'object',
          properties: {},
          required: []
        }
      }))
    }];
  }

  /**
   * Parse API response
   */
  parseResponse(data) {
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from model');
    }

    const result = {
      content: '',
      functionCalls: []
    };

    // Check for text content
    if (candidate.content?.parts) {
      candidate.content.parts.forEach(part => {
        if (part.text) {
          result.content += part.text;
        }
        if (part.functionCall) {
          result.functionCalls.push({
            name: part.functionCall.name,
            arguments: part.functionCall.args || {}
          });
        }
      });
    }

    return result;
  }
}

export const geminiService = new GeminiService();
export default GeminiService;
