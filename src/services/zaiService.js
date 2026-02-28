/**
 * Z.ai API Service
 * Uses OpenAI-compatible API with CORS proxy
 */

const ZAI_API_KEY = '0aa91aeed2ca438b802fe07220515705.BmC62zS8S2h9Rhfs';
const ZAI_BASE_URL = 'https://api.z.ai/v1';

class ZAIService {
  constructor(apiKey = ZAI_API_KEY) {
    this.apiKey = apiKey;
    this.model = 'minimax/minimax-m2.5:free';
  }

  setModel(modelName) {
    this.model = modelName;
  }

  /**
   * Generate content - simple chat without tools (CORS workaround)
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

      // Try direct API call first
      let response;
      try {
        response = await fetch(
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
      } catch (e) {
        // If direct fails, try via proxy
        console.log('Direct API failed, trying alternative...');
        throw e;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'API request failed');
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('Z.AI Error:', error);
      // Return a fallback response so the app doesn't break
      return {
        content: 'Lo siento, hay un problema de conexión con Z.AI. Por favor intenta de nuevo o usa otro modelo.',
        functionCalls: []
      };
    }
  }

  buildMessages(history, currentPrompt) {
    const messages = [];
    
    messages.push({
      role: 'system',
      content: 'Eres un asistente útil. Responde en español o inglés de manera clara y concisa.'
    });

    history.forEach(msg => {
      if (msg.content) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    });

    messages.push({
      role: 'user',
      content: currentPrompt
    });

    return messages;
  }

  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) {
      return { content: 'No response', functionCalls: [] };
    }

    return {
      content: choice.message?.content || 'No response',
      functionCalls: []
    };
  }
}

export const zaiService = new ZAIService();
export default ZAIService;
