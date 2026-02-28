import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiPlus, FiSettings, FiInfo, FiX, FiCpu, FiDatabase, FiClock, FiGlobe, FiFolder, FiLink, FiBook, FiZap } from 'react-icons/fi';
import { MCPServers, getToolsSchema, getAllTools } from './config/mcpTools';
import { geminiService } from './services/geminiService';
import { zaiService } from './services/zaiService';
import { toolExecutor } from './services/toolExecutor';

// Icons mapping
const serverIcons = {
  filesystem: FiFolder,
  memory: FiDatabase,
  fetch: FiGlobe,
  time: FiClock,
  git: FiCpu,
  http: FiLink,
  context7: FiBook,
  everything: FiZap,
  sqlite: FiDatabase,
  puppeteer: FiGlobe,
  sequentialthinking: FiCpu
};

// Model configurations - Z.AI models with function calling + Gemini without
const MODELS = {
  // Z.AI models with MCP/Function Calling support
  'z-ai/minimax/minimax-m2.5:free': {
    name: 'MiniMax M2.5 Free',
    provider: 'z-ai',
    supportsTools: true,
    description: 'Z.AI - Supports MCP tools'
  },
  'z-ai/glm-5:free': {
    name: 'GLM-5 Free',
    provider: 'z-ai',
    supportsTools: true,
    description: 'Z.AI - Supports MCP tools'
  },
  'z-ai/qwen/qwen-turbo': {
    name: 'Qwen Turbo',
    provider: 'z-ai',
    supportsTools: true,
    description: 'Z.AI - Supports MCP tools'
  },
  'z-ai/liu.20240417:fast': {
    name: 'Liu Fast',
    provider: 'z-ai',
    supportsTools: true,
    description: 'Z.AI - Supports MCP tools'
  },
  // Gemini without MCP
  'gemini-3-flash-preview': {
    name: 'Gemini 3 Flash Preview',
    provider: 'gemini',
    supportsTools: false,
    description: 'Google - No MCP tools'
  }
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedModel, setSelectedModel] = useState('z-ai/minimax/minimax-m2.5:free');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState('servers');
  const [toolHistory, setToolHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentModel = MODELS[selectedModel];
  const supportsTools = currentModel?.supportsTools || false;
  const isZAI = currentModel?.provider === 'z-ai';

  // Load conversation from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mcp_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save conversation to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('mcp_chat_history', JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    
    // Update Z.AI service model if needed
    if (MODELS[newModel]?.provider === 'z-ai') {
      zaiService.setModel(newModel);
    }
    
    // Disable server selection if model doesn't support tools
    if (!MODELS[newModel]?.supportsTools) {
      setSelectedServer(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    scrollToBottom();

    // Add user message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    setIsLoading(true);

    try {
      // Build context with selected server
      let systemPrompt = `You are an AI assistant with access to Model Context Protocol (MCP) tools. `;
      
      if (selectedServer && supportsTools) {
        const server = MCPServers[selectedServer];
        systemPrompt += `The user has selected the "${server.name}" server. `;
        systemPrompt += `Available tools: ${server.tools.map(t => t.name).join(', ')}. `;
        systemPrompt += `Use these tools when appropriate to help the user. `;
      } else if (supportsTools) {
        systemPrompt += `Available MCP servers: ${Object.values(MCPServers).map(s => s.name).join(', ')}. `;
        systemPrompt += `You can suggest which server to use based on the user's request. `;
      } else {
        systemPrompt += `This model doesn't support tool calling. Just respond to the user's request conversationally. `;
      }

      systemPrompt += `When the user asks to use a tool and the model supports tools, respond with the tool call in JSON format: {"tool": "tool_name", "args": {...}}. `;
      systemPrompt += `Otherwise, respond conversationally.`;

      // Get tools schema if model supports it and server is selected
      let tools = [];
      if (supportsTools && selectedServer) {
        const server = MCPServers[selectedServer];
        tools = server.tools;
      }

      // Get conversation history (last 10 messages)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      let response;

      // Use Z.AI for MCP tools, Gemini for regular chat
      if (isZAI && supportsTools) {
        response = await zaiService.generateContent(
          `${systemPrompt}\n\nUser: ${userMessage}`,
          tools,
          history
        );
      } else {
        // Use Gemini (no tools)
        response = await geminiService.generateContent(
          `${systemPrompt}\n\nUser: ${userMessage}`,
          [],
          history
        );
      }

      // Check for function calls (only if supported)
      if (supportsTools && response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        
        // Add assistant message with tool call
        const assistantMsg = {
          id: Date.now(),
          role: 'assistant',
          content: response.content || `I'll use the ${functionCall.name} tool.`,
          timestamp: new Date().toISOString(),
          toolCall: {
            name: functionCall.name,
            args: functionCall.arguments
          }
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Execute the tool
        const toolResult = await toolExecutor.executeTool(
          functionCall.name,
          functionCall.arguments,
          selectedServer
        );

        // Add tool result message
        const toolMsg = {
          id: Date.now() + 1,
          role: 'tool',
          content: JSON.stringify(toolResult, null, 2),
          timestamp: new Date().toISOString(),
          toolName: functionCall.name,
          toolResult: toolResult
        };
        setMessages(prev => [...prev, toolMsg]);
        setToolHistory(prev => [...prev.slice(-19), toolMsg]);

        // Continue conversation with tool result
        if (isZAI) {
          response = await zaiService.generateContent(
            `The tool result was: ${JSON.stringify(toolResult)}. Please explain this result to the user.`,
            [],
            [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: response.content }]
          );
        } else {
          response = await geminiService.generateContent(
            `The tool result was: ${JSON.stringify(toolResult)}. Please explain this result to the user.`,
            [],
            [...history, { role: 'user', content: userMessage }, { role: 'model', content: response.content }]
          );
        }

        const finalMsg = {
          id: Date.now() + 2,
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, finalMsg]);

      } else {
        // Regular response
        const assistantMsg = {
          id: Date.now(),
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);
      }

    } catch (error) {
      const errorMsg = {
        id: Date.now(),
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    setIsLoading(false);
    scrollToBottom();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('mcp_chat_history');
  };

  const selectServer = (serverId) => {
    if (!supportsTools) return;
    setSelectedServer(serverId);
    const server = MCPServers[serverId];
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'system',
      content: `Selected ${server.name}. ${server.description}`,
      timestamp: new Date().toISOString()
    }]);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-gpt-dark text-white overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            className="w-64 bg-gpt-secondary border-r border-gpt-border flex flex-col"
          >
            {/* Logo */}
            <div className="p-4 border-b border-gpt-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-lg flex items-center justify-center text-lg">
                  ⚡
                </div>
                <span className="font-semibold">MCP Playground</span>
              </div>
            </div>

            {/* Model Selector */}
            <div className="p-3 border-b border-gpt-border">
              <label className="block text-xs text-gray-500 mb-1">AI Model</label>
              <select
                value={selectedModel}
                onChange={handleModelChange}
                className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm"
              >
                <optgroup label="Z.AI (Supports MCP)">
                  {Object.entries(MODELS).filter(([k, v]) => v.provider === 'z-ai').map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name} ✓
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Google (No MCP)">
                  {Object.entries(MODELS).filter(([k, v]) => v.provider === 'gemini').map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {!supportsTools && (
                <p className="text-xs text-amber-500 mt-1">⚠️ MCP disabled</p>
              )}
            </div>

            {/* New Chat Button */}
            <div className="p-3">
              <button
                onClick={clearChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-gpt-tertiary hover:bg-gpt-hover border border-gpt-border rounded-xl transition-colors"
              >
                <FiPlus /> New Chat
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gpt-border">
              <button
                onClick={() => setActiveTab('servers')}
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'servers' ? 'text-gpt-accent border-b-2 border-gpt-accent' : 'text-gray-400'}`}
              >
                Servers
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'history' ? 'text-gpt-accent border-b-2 border-gpt-accent' : 'text-gray-400'}`}
              >
                History
              </button>
            </div>

            {/* Server List */}
            <div className="flex-1 overflow-y-auto p-2">
              {activeTab === 'servers' ? (
                <>
                  <div className="px-2 py-1 text-xs text-gray-500 uppercase font-medium">Available</div>
                  {Object.entries(MCPServers).map(([id, server]) => {
                    const Icon = serverIcons[id] || FiCpu;
                    const isDisabled = !supportsTools;
                    return (
                      <button
                        key={id}
                        onClick={() => selectServer(id)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          selectedServer === id 
                            ? 'bg-gpt-accent/20 text-gpt-accent border border-gpt-accent/30' 
                            : isDisabled
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-gpt-hover'
                        }`}
                      >
                        <Icon className="text-lg" />
                        <span className="text-sm">{server.name}</span>
                      </button>
                    );
                  })}

                  <div className="px-2 py-1 text-xs text-gray-500 uppercase font-medium mt-4">Auth Required</div>
                  {['github', 'notion', 'slack', 'postgres'].map(id => (
                    <div
                      key={id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-left text-gray-500 opacity-50 cursor-not-allowed"
                    >
                      <FiCpu className="text-lg" />
                      <span className="text-sm">{id}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-gray-500 text-sm p-2">
                  {messages.filter(m => m.role === 'user').length} messages in this session
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-gpt-border flex gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gpt-tertiary hover:bg-gpt-hover rounded-lg text-sm"
              >
                <FiSettings /> Settings
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-gpt-border flex items-center justify-between px-4 bg-gpt-secondary">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gpt-hover rounded-lg transition-colors"
            >
              ☰
            </button>
            <h1 className="font-semibold">
              {selectedServer ? MCPServers[selectedServer]?.name : 'MCP Playground'}
            </h1>
            {selectedServer && (
              <span className="text-xs text-gpt-accent bg-gpt-accent/20 px-2 py-0.5 rounded-full">
                {MCPServers[selectedServer]?.tools.length} tools
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${supportsTools ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {supportsTools ? '✓ MCP Enabled' : '✗ MCP Disabled'}
            </span>
            <button
              onClick={() => setShowAbout(true)}
              className="p-2 hover:bg-gpt-hover rounded-lg transition-colors"
            >
              <FiInfo />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-4">
                ⚡
              </div>
              <h2 className="text-2xl font-semibold mb-2">MCP Playground</h2>
              <p className="text-gray-400 max-w-md">
                Select a <span className="text-gpt-accent">Z.AI model</span> from the sidebar to use MCP tools.
                <br/>
                Or use <span className="text-amber-400">Gemini</span> for regular chat.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                    : msg.role === 'tool'
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : 'bg-gradient-to-br from-gpt-accent to-emerald-600'
                }`}>
                  {msg.role === 'user' ? '👤' : msg.role === 'tool' ? '🔧' : '⚡'}
                </div>
                <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`text-xs text-gray-500 mb-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.role === 'user' ? 'You' : msg.role === 'tool' ? `🔧 ${msg.toolName}` : 'AI Assistant'} · {formatTimestamp(msg.timestamp)}
                  </div>
                  <div className={`rounded-2xl p-3 ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600/20 border border-indigo-500/30' 
                      : msg.role === 'tool'
                      ? 'bg-amber-600/20 border border-amber-500/30 font-mono text-sm'
                      : msg.isError
                      ? 'bg-red-600/20 border border-red-500/30'
                      : 'bg-gpt-tertiary border border-gpt-border'
                  }`}>
                    <pre className="whitespace-pre-wrap text-sm">{msg.content}</pre>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gpt-accent to-emerald-600 flex items-center justify-center">
                ⚡
              </div>
              <div className="bg-gpt-tertiary border border-gpt-border rounded-2xl px-4 py-3">
                <div className="typing-indicator flex gap-1">
                  <span className="w-2 h-2 bg-gpt-accent rounded-full"></span>
                  <span className="w-2 h-2 bg-gpt-accent rounded-full"></span>
                  <span className="w-2 h-2 bg-gpt-accent rounded-full"></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gpt-border bg-gpt-secondary">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={supportsTools 
                  ? (selectedServer 
                    ? `Message ${MCPServers[selectedServer]?.name}...` 
                    : 'Select a server and describe what you want to do...')
                  : 'MCP disabled. Using Gemini for chat only.'
                }
                rows={1}
                className="w-full bg-gpt-tertiary border border-gpt-border rounded-xl px-4 py-3 pr-12 resize-none outline-none focus:border-gpt-accent transition-colors"
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-2 p-2 bg-gpt-accent hover:bg-gpt-accent-hover disabled:bg-gpt-hover disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <FiSend className="text-white" />
              </button>
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
              {selectedModel} · {supportsTools ? 'MCP Enabled (Z.AI)' : 'Chat Only (Gemini)'}
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gpt-secondary border border-gpt-border rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gpt-hover rounded-lg">
                <FiX />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">AI Model</label>
                <select
                  value={selectedModel}
                  onChange={handleModelChange}
                  className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm"
                >
                  <optgroup label="Z.AI (Supports MCP)">
                    {Object.entries(MODELS).filter(([k, v]) => v.provider === 'z-ai').map(([key, model]) => (
                      <option key={key} value={key}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Google (No MCP)">
                    {Object.entries(MODELS).filter(([k, v]) => v.provider === 'gemini').map(([key, model]) => (
                      <option key={key} value={key}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Storage</label>
                <p className="text-sm">Conversations stored in browser localStorage</p>
                <button 
                  onClick={() => {
                    localStorage.clear();
                    setMessages([]);
                  }}
                  className="mt-2 text-sm text-red-400 hover:text-red-300"
                >
                  Clear all data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gpt-secondary border border-gpt-border rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">About MCP Playground</h3>
              <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-gpt-hover rounded-lg">
                <FiX />
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
                  ⚡
                </div>
                <h2 className="text-xl font-semibold">MCP Playground</h2>
                <p className="text-gray-400 text-sm">Powered by Z.AI + Google Gemini</p>
              </div>
              <div className="bg-gpt-tertiary rounded-xl p-4 space-y-2">
                <h4 className="font-medium">Available Models:</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>✓ <strong>Z.AI Models</strong> - Support MCP tools (function calling)</li>
                  <li>✗ <strong>Gemini 3 Flash</strong> - Chat only, no MCP</li>
                </ul>
              </div>
              <div className="text-xs text-gray-500 text-center">
                Built with React · Serverless ready
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
