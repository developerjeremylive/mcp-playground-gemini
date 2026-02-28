import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiPlus, FiSettings, FiInfo, FiX, FiCpu, FiDatabase, FiClock, FiGlobe, FiFolder, FiLink, FiBook, FiZap } from 'react-icons/fi';
import { MCPServers } from './config/mcpTools';
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

// Model configurations - all Z.AI models
const MODELS = {
  // Models WITH MCP/Function Calling support
  'minimax/minimax-m2.5:free': {
    name: 'MiniMax M2.5 Free',
    supportsTools: true,
    description: 'Free - Supports MCP tools'
  },
  'glm-5:free': {
    name: 'GLM-5 Free',
    supportsTools: true,
    description: 'Free - Supports MCP tools'
  },
  'qwen/qwen-turbo': {
    name: 'Qwen Turbo',
    supportsTools: true,
    description: 'Fast - Supports MCP tools'
  },
  'liu.20240417:fast': {
    name: 'Liu Fast',
    supportsTools: true,
    description: 'Fast - Supports MCP tools'
  },
  // Models WITHOUT MCP (chat only)
  'qwen/qwen-plus': {
    name: 'Qwen Plus',
    supportsTools: false,
    description: 'Plus - Chat only'
  },
  'yi/yi-lightning': {
    name: 'Yi Lightning',
    supportsTools: false,
    description: 'Lightning - Chat only'
  }
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedModel, setSelectedModel] = useState('minimax/minimax-m2.5:free');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState('servers');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentModel = MODELS[selectedModel];
  const supportsTools = currentModel?.supportsTools || false;

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

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    
    // Update Z.AI service
    zaiService.setModel(newModel, MODELS[newModel]?.supportsTools || false);
    
    // Disable server selection if model doesn't support tools
    if (!MODELS[newModel]?.supportsTools) {
      setSelectedServer(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

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
      // Get conversation history
      const history = messages.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Get tools if supported and server selected
      let tools = [];
      if (supportsTools && selectedServer) {
        tools = MCPServers[selectedServer]?.tools || [];
      }

      // Call Z.AI
      const response = await zaiService.generateContent(userMessage, tools, history);

      // Check for tool call
      if (supportsTools && response.toolCall) {
        const toolCall = response.toolCall;
        
        // Add assistant message with tool call
        const assistantMsg = {
          id: Date.now(),
          role: 'assistant',
          content: response.content.replace(/\[TOOL:.*?\]/g, '').trim() || `Executing ${toolCall.name}...`,
          timestamp: new Date().toISOString(),
          toolCall: toolCall
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Execute the tool
        const toolResult = await toolExecutor.executeTool(
          toolCall.name,
          toolCall.arguments || {},
          selectedServer
        );

        // Add tool result message
        const toolMsg = {
          id: Date.now() + 1,
          role: 'tool',
          content: JSON.stringify(toolResult, null, 2),
          timestamp: new Date().toISOString(),
          toolName: toolCall.name,
          toolResult: toolResult
        };
        setMessages(prev => [...prev, toolMsg]);

        // Continue conversation
        const followUp = await zaiService.generateContent(
          `El resultado de la herramienta fue: ${JSON.stringify(toolResult)}. Explica el resultado al usuario.`,
          [],
          [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: response.content }]
        );

        const finalMsg = {
          id: Date.now() + 2,
          role: 'assistant',
          content: followUp.content,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, finalMsg]);

      } else {
        // Regular response
        const cleanContent = response.content.replace(/\[TOOL:.*?\]/g, '').trim();
        const assistantMsg = {
          id: Date.now(),
          role: 'assistant',
          content: cleanContent || 'No response',
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
              <label className="block text-xs text-gray-500 mb-1">Z.AI Model</label>
              <select
                value={selectedModel}
                onChange={handleModelChange}
                className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm"
              >
                <optgroup label="With MCP Tools">
                  {Object.entries(MODELS).filter(([k, v]) => v.supportsTools).map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name} ✓
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Chat Only">
                  {Object.entries(MODELS).filter(([k, v]) => !v.supportsTools).map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {!supportsTools && (
                <p className="text-xs text-amber-500 mt-1">⚠️ Chat only - No MCP tools</p>
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
                  <div className="px-2 py-1 text-xs text-gray-500 uppercase font-medium">MCP Servers</div>
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
                </>
              ) : (
                <div className="text-gray-500 text-sm p-2">
                  {messages.filter(m => m.role === 'user').length} messages
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
            {selectedServer && supportsTools && (
              <span className="text-xs text-gpt-accent bg-gpt-accent/20 px-2 py-0.5 rounded-full">
                {MCPServers[selectedServer]?.tools.length} tools
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${supportsTools ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {supportsTools ? '✓ MCP Enabled' : 'Chat Only'}
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
                Select a <span className="text-gpt-accent">Z.AI model</span> from the sidebar.
                <br/>
                Models with ✓ support MCP tools.
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
                    : msg.role === 'system'
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                    : 'bg-gradient-to-br from-gpt-accent to-emerald-600'
                }`}>
                  {msg.role === 'user' ? '👤' : msg.role === 'tool' ? '🔧' : msg.role === 'system' ? 'ℹ️' : '⚡'}
                </div>
                <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`text-xs text-gray-500 mb-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.role === 'user' ? 'You' : msg.role === 'tool' ? `🔧 ${msg.toolName}` : msg.role === 'system' ? 'System' : 'AI'} · {formatTimestamp(msg.timestamp)}
                  </div>
                  <div className={`rounded-2xl p-3 ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600/20 border border-indigo-500/30' 
                      : msg.role === 'tool'
                      ? 'bg-amber-600/20 border border-amber-500/30 font-mono text-sm'
                      : msg.isError
                      ? 'bg-red-600/20 border border-red-500/30'
                      : msg.role === 'system'
                      ? 'bg-blue-600/20 border border-blue-500/30 text-sm'
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
                    : 'Select a server or ask anything...')
                  : 'Chat only - Select a model with MCP for tools...'
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
              Z.AI {currentModel?.name} · {supportsTools ? 'MCP Enabled' : 'Chat Only'}
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
                <label className="block text-sm text-gray-400 mb-1">Z.AI Model</label>
                <select
                  value={selectedModel}
                  onChange={handleModelChange}
                  className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm"
                >
                  <optgroup label="With MCP Tools">
                    {Object.entries(MODELS).filter(([k, v]) => v.supportsTools).map(([key, model]) => (
                      <option key={key} value={key}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Chat Only">
                    {Object.entries(MODELS).filter(([k, v]) => !v.supportsTools).map(([key, model]) => (
                      <option key={key} value={key}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Storage</label>
                <p className="text-sm">Stored in browser localStorage</p>
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
              <h3 className="text-lg font-semibold">About</h3>
              <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-gpt-hover rounded-lg">
                <FiX />
              </button>
            </div>
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
                ⚡
              </div>
              <h2 className="text-xl font-semibold">MCP Playground</h2>
              <p className="text-gray-400 text-sm">Powered by Z.AI</p>
            </div>
            <div className="bg-gpt-tertiary rounded-xl p-4 space-y-2">
              <h4 className="font-medium">Available Models:</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>✓ <strong>MiniMax, GLM-5, Qwen, Liu</strong> - Support MCP tools</li>
                <li>○ <strong>Qwen Plus, Yi Lightning</strong> - Chat only</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
