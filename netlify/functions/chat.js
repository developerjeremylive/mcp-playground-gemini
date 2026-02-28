exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { messages, model, tools, apiKey } = JSON.parse(event.body);
    
    if (!apiKey) {
      return { statusCode: 400, body: JSON.stringify({ error: 'API key required' }) };
    }

    const requestBody = {
      model: model || 'kilocode/anthropic/claude-haiku-3.5',
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || { type: 'object', properties: {}, required: [] }
        }
      }));
      requestBody.tool_choice = "auto";
    }

    const response = await fetch('https://api.kilocode.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: response.status, body: errorText };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
