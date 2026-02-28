// Netlify function - handle all CORS preflight
exports.handler = async (event, context) => {
  // Always include CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers,
      body: ''
    };
  }

  // Only process POST for API
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Use POST method' }) 
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { messages, model, tools, apiKey } = body;
    
    if (!apiKey) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ error: 'API key required' }) 
      };
    }

    const requestBody = {
      model: model || 'kilocode/anthropic/claude-haiku-3.5',
      messages: messages || [],
      temperature: 0.7,
      max_tokens: 4096
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
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

    const responseText = await response.text();

    if (!response.ok) {
      return { 
        statusCode: response.status, 
        headers,
        body: responseText 
      };
    }

    const data = JSON.parse(responseText);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
