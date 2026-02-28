import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiPlus, FiSettings, FiInfo, FiX, FiCpu, FiDatabase, FiClock, FiGlobe, FiFolder, FiLink, FiBook, FiZap } from 'react-icons/fi';
import { MCPServers } from './config/mcpTools';
import { kiloCodeService, MODEL_CONFIG } from './services/kiloCodeService';
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

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedModel, setSelectedModel] = useState('kilocode/anthropic/claude-haiku-3.5');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState('servers');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentModel = MODEL_CONFIG[selectedModel];
  const supportsTools = currentModel?.supportsTools || false;

  // Initialize
  useEffect(() => {
    kiloCodeService.setModel(selectedModel);
    
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

  // Save conversation
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('mcp_chat_history', JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    kiloCodeService.setModel(newModel);
    
    if (!MODEL_CONFIG[newModel]?.supportsTools) {
      setSelectedServer(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    setIsLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));

      let tools = [];
      if (supportsTools && selectedServer) {
        tools = MCPServers[selectedServer]?.tools || [];
      }

      const response = await kiloCodeService.generateContent(userMessage, tools, history);

      // Handle tool call
      if (supportsTools && response.toolCall) {
        const toolCall = response.toolCall;
        
        const assistantMsg = {
          id: Date.now(),
          role: 'assistant',
          content: (response.content || '').replace(/\[TOOL:.*?\]/g, '').trim() || `Executing ${toolCall.name}...`,
          timestamp: new Date().toISOString(),
          toolCall: toolCall
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Execute tool
        const toolResult = await toolExecutor.executeTool(
          toolCall.name,
          toolCall.arguments || {},
          selectedServer
        );

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
        const followUp = await kiloCodeService.generateContent(
          `El resultado fue: ${JSON.stringify(toolResult)}. Explica al usuario.`,
          [],
          [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: response.content }]
        );

        const finalMsg = {
          id: Date.now() + 2,
          role: 'assistant',
          content: followUp.content.replace(/\[TOOL:.*?\]/g, '').trim(),
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, finalMsg]);

      } else {
        const cleanContent = (response.content || '').replace(/\[TOOL:.*?\]/g, '').trim();
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

  = (e) => {
    if (e.key === const handleKeyPress 'Enter' && !e.shiftKey) {
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

  // Group models
  const modelsWithTools = Object.entries(MODEL_CONFIG).filter(([k, v]) => v.supportsTools);
  const chatOnlyModels = Object.entries(MODEL_CONFIG).filter(([k, v]) => !v.supportsTools);

  return (
    <div className="flex h-screen bg-gpt-dark text-white overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-72 bg-gpt-secondary border-r border-gpt-border flex flex-col"
          >
            {/* Logo */}
            <div className="p-4 border-b border-gpt-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-lg flex items-center justify-center text-lg">
                  ⚡
                </div>
                <div>
                  <span className="font-semibold block">MCP Playground</span>
                  <span className="text-xs text-gray-500">KiloCode Models</span>
                </div>
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
                <optgroup label="With MCP Tools">
                  {modelsWithTools.map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name} ✓
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Chat Only">
                  {chatOnlyModels.map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {!supportsTools && (
                <p className="text-xs text-amber-500 mt-1">⚠️ Chat only - No MCP</p>
              )}
            </div>

            {/* New Chat */}
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
                onClick={() => setActiveTab('models')}
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'models' ? 'text-gpt-accent border-b-2 border-gpt-accent' : 'text-gray-400'}`}
              >
                Models
              </button>
            </div>

            {/* Server List */}
            <div className="flex-1 overflow-y-auto p-2">
              {activeTab === 'servers' ? (
                <>
                  <div className="px-2 py-1 text-xs text-gray-500 uppercase font-medium">MCP Servers</div>
                  {Object.entries(MCPServers).map(([id, server]) => {
                    const Icon = serverIcons[id] || FiCpu;
                    return (
                      <button
                        key={id}
                        onClick={() => selectServer(id)}
                        disabled={!supportsTools}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          selectedServer === id 
                            ? 'bg-gpt-accent/20 text-gpt-accent border border-gpt-accent/30' 
                            : !supportsTools
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
                <div className="space-y-2">
                  <div className="px-2 py-1 text-xs text-gray-500 uppercase font-medium">With MCP</div>
                  {modelsWithTools.map(([key, model]) => (
                    <div
                      key={key}
                      onClick={() => handleModelChange({ target: { value: key } })}
                      className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedModel === key
                          ? 'bg-gpt-accent/20 border border-gpt-accent/30'
                          : 'hover:bg-gpt-hover'
                      }`}
                    >
                      <div className="text-sm font-medium">{model.name}</div>
                      <div className="text-xs text-gray-500">{model.provider}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="p-3 border-t border-gpt-border">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-gpt-tertiary hover:bg-gpt-hover rounded-lg text-sm"
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
              {selectedServer ? MCPServers[selectedServer]?.name : currentModel?.name || 'MCP Playground'}
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
            <button onClick={() => setShowAbout(true)} className="p-2 hover:bg-gpt-hover rounded-lg">
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
                Select a <span className="text-gpt-accent">KiloCode model</span> with ✓ for MCP tools.
                <br/>
                Models without ✓ are chat-only.
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
                  msg.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 
                  msg.role === 'tool' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                  msg.role === 'system' ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
                  'bg-gradient-to-br from-gpt-accent to-emerald-600'
                }`}>
                  {msg.role === 'user' ? '👤' : msg.role === 'tool' ? '🔧' : msg.role === 'system' ? 'ℹ️' : '⚡'}
                </div>
                <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`text-xs text-gray-500 mb-1`}>
                    {msg.role === 'user' ? 'You' : msg.role === 'tool' ? `🔧 ${msg.toolName}` : msg.role === 'system' ? 'System' : currentModel?.name} · {formatTimestamp(msg.timestamp)}
                  </div>
                  <div className={`rounded-2xl p-3 ${
                    msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : 
                    msg.role === 'tool' ? 'bg-amber-600/20 border border-amber-500/30 font-mono text-sm' :
                    msg.isError ? 'bg-red-600/20 border border-red-500/30' :
                    msg.role === 'system' ? 'bg-blue-600/20 border border-blue-500/30' :
                    'bg-gpt-tertiary border border-gpt-border'
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
                  ? (selectedServer ? `Message ${MCPServers[selectedServer]?.name}...` : 'Select a server or ask anything...')
                  : 'Chat only mode...'
                }
                rows={1}
                className="w-full bg-gpt-tertiary border border-gpt-border rounded-xl px-4 py-3 pr-12 resize-none outline-none focus:border-gpt-accent"
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-2 p-2 bg-gpt-accent hover:bg-gpt-accent-hover disabled:bg-gpt-hover rounded-lg"
              >
                <FiSend className="text-white" />
              </button>
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
              {currentModel?.name} · {supportsTools ? 'MCP Enabled' : 'Chat Only'}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-gpt-secondary border border-gpt-border rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gpt-hover rounded-lg"><FiX /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Model</label>
                <select value={selectedModel} onChange={handleModelChange} className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm">
                  <optgroup label="With MCP Tools">
                    {modelsWithTools.map(([key, model]) => (<option key={key} value={key}>{model.name}</option>))}
                  </optgroup>
                  <optgroup label="Chat Only">
                    {chatOnlyModels.map(([key, model]) => (<option key={key} value={key}>{model.name}</option>))}
                  </optgroup>
                </select>
              </div>
              <button onClick={() => { localStorage.clear(); setMessages([]); }} className="text-sm text-red-400 hover:text-red-300">Clear all data</button>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAbout(false)}>
          <div className="bg-gpt-secondary border border-gpt-border rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">About</h3>
              <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-gpt-hover rounded-lg"><FiX /></button>
            </div>
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">⚡</div>
              <h2 className="text-xl font-semibold">MCP Playground</h2>
              <p className="text-gray-400 text-sm">Powered by KiloCode</p>
            </div>
            <div className="bg-gpt-tertiary rounded-xl p-4 space-y-2">
              <h4 className="font-medium">Available Models:</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>✓ <strong>Claude, Gemini, Llama, Qwen</strong> - Support MCP tools</li>
                <li>○ <strong>Phi-3, Mistral</strong> - Chat only</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
