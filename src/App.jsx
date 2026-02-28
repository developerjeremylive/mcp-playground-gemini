import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiPlus, FiSettings, FiInfo, FiX, FiCpu, FiDatabase, FiClock, FiGlobe, FiFolder, FiLink, FiBook, FiZap, FiKey } from 'react-icons/fi';
import { MCPServers } from './config/mcpTools';
import { kiloCodeService, MODEL_CONFIG } from './services/kiloCodeService';
import { toolExecutor } from './services/toolExecutor';

const serverIcons = {
  filesystem: FiFolder, memory: FiDatabase, fetch: FiGlobe, time: FiClock,
  git: FiCpu, http: FiLink, context7: FiBook, everything: FiZap,
  sqlite: FiDatabase, puppeteer: FiGlobe, sequentialthinking: FiCpu
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedModel, setSelectedModel] = useState('kilocode/anthropic/claude-haiku-3.5');
  const [apiKey, setApiKey] = useState('');
  const [customProxy, setCustomProxy] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState('servers');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentModel = MODEL_CONFIG[selectedModel];
  const supportsTools = currentModel?.supportsTools || false;
  const hasApiKey = apiKey.length > 0;

  useEffect(() => {
    const savedApiKey = localStorage.getItem('kilocode_api_key');
    if (savedApiKey) { setApiKey(savedApiKey); kiloCodeService.setApiKey(savedApiKey); }
    
    const savedProxy = localStorage.getItem('kilocode_proxy');
    if (savedProxy) { setCustomProxy(savedProxy); kiloCodeService.setCustomProxy(savedProxy); }
    
    const saved = localStorage.getItem('mcp_chat_history');
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) { console.error('Failed to load history:', e); }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('mcp_chat_history', JSON.stringify(messages.slice(-50)));
  }, [messages]);

  useEffect(() => {
    if (apiKey) { localStorage.setItem('kilocode_api_key', apiKey); kiloCodeService.setApiKey(apiKey); }
  }, [apiKey]);

  useEffect(() => {
    if (customProxy) { localStorage.setItem('kilocode_proxy', customProxy); kiloCodeService.setCustomProxy(customProxy); }
  }, [customProxy]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    kiloCodeService.setModel(newModel);
    if (!MODEL_CONFIG[newModel]?.supportsTools) setSelectedServer(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!hasApiKey) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: '⚠️ Please configure your API key first.', timestamp: new Date().toISOString(), isError: true }]);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    const userMsg = { id: Date.now(), role: 'user', content: userMessage, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      let tools = [];
      if (supportsTools && selectedServer) tools = MCPServers[selectedServer]?.tools || [];
      const response = await kiloCodeService.generateContent(userMessage, tools, history);

      if (supportsTools && response.toolCall) {
        const toolCall = response.toolCall;
        const assistantMsg = { id: Date.now(), role: 'assistant', content: (response.content || '').replace(/\[TOOL:.*?\]/g, '').trim() || `Executing ${toolCall.name}...`, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, assistantMsg]);

        const toolResult = await toolExecutor.executeTool(toolCall.name, toolCall.arguments || {}, selectedServer);
        const toolMsg = { id: Date.now() + 1, role: 'tool', content: JSON.stringify(toolResult, null, 2), timestamp: new Date().toISOString(), toolName: toolCall.name };
        setMessages(prev => [...prev, toolMsg]);

        const followUp = await kiloCodeService.generateContent(`Result: ${JSON.stringify(toolResult)}. Explain to user.`, [], [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: response.content }]);
        setMessages(prev => [...prev, { id: Date.now() + 2, role: 'assistant', content: followUp.content.replace(/\[TOOL:.*?\]/g, '').trim(), timestamp: new Date().toISOString() }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: (response.content || '').replace(/\[TOOL:.*?\]/g, '').trim() || 'No response', timestamp: new Date().toISOString() }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date().toISOString(), isError: true }]);
    }
    setIsLoading(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const clearChat = () => { setMessages([]); localStorage.removeItem('mcp_chat_history'); };
  const selectServer = (serverId) => { if (!supportsTools) return; setSelectedServer(serverId); setMessages(prev => [...prev, { id: Date.now(), role: 'system', content: `Selected ${MCPServers[serverId].name}`, timestamp: new Date().toISOString() }]); };
  const formatTimestamp = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const modelsWithTools = Object.entries(MODEL_CONFIG).filter(([k, v]) => v.supportsTools);
  const chatOnlyModels = Object.entries(MODEL_CONFIG).filter(([k, v]) => !v.supportsTools);

  return (
    <div className="flex h-screen bg-gpt-dark text-white overflow-hidden">
      <AnimatePresence>
        {showSidebar && (
          <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="w-72 bg-gpt-secondary border-r border-gpt-border flex flex-col">
            <div className="p-4 border-b border-gpt-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-lg flex items-center justify-center text-lg">⚡</div>
                <span className="font-semibold">MCP Playground</span>
              </div>
            </div>
            <div className="p-3 border-b border-gpt-border">
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${hasApiKey ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                <FiKey /> {hasApiKey ? 'API Key configured' : 'API Key missing'}
              </div>
            </div>
            <div className="p-3 border-b border-gpt-border">
              <label className="block text-xs text-gray-500 mb-1">AI Model</label>
              <select value={selectedModel} onChange={handleModelChange} className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm">
                <optgroup label="With MCP Tools">{modelsWithTools.map(([key, model]) => (<option key={key} value={key}>{model.name} ✓</option>))}</optgroup>
                <optgroup label="Chat Only">{chatOnlyModels.map(([key, model]) => (<option key={key} value={key}>{model.name}</option>))}</optgroup>
              </select>
            </div>
            <div className="p-3"><button onClick={clearChat} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-gpt-tertiary hover:bg-gpt-hover border border-gpt-border rounded-xl"><FiPlus /> New Chat</button></div>
            <div className="flex border-b border-gpt-border">
              <button onClick={() => setActiveTab('servers')} className={`flex-1 py-2 text-xs font-medium ${activeTab === 'servers' ? 'text-gpt-accent border-b-2 border-gpt-accent' : 'text-gray-400'}`}>Servers</button>
              <button onClick={() => setActiveTab('models')} className={`flex-1 py-2 text-xs font-medium ${activeTab === 'models' ? 'text-gpt-accent border-b-2 border-gpt-accent' : 'text-gray-400'}`}>Models</button>
              <button onClick={() => setActiveTab('apikey')} className={`flex-1 py-2 text-xs font-medium ${activeTab === 'apikey' ? 'text-gpt-accent border-b-2 border-gpt-accent' : 'text-gray-400'}`}>API Key</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {activeTab === 'servers' && Object.entries(MCPServers).map(([id, server]) => {
                const Icon = serverIcons[id] || FiCpu;
                return <button key={id} onClick={() => selectServer(id)} disabled={!supportsTools} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${selectedServer === id ? 'bg-gpt-accent/20 text-gpt-accent border border-gpt-accent/30' : !supportsTools ? 'opacity-40' : 'hover:bg-gpt-hover'}`}><Icon /><span className="text-sm">{server.name}</span></button>;
              })}
              {activeTab === 'models' && modelsWithTools.map(([key, model]) => (
                <div key={key} onClick={() => handleModelChange({ target: { value: key } })} className={`px-3 py-2 rounded-lg cursor-pointer ${selectedModel === key ? 'bg-gpt-accent/20' : 'hover:bg-gpt-hover'}`}><div className="text-sm font-medium">{model.name}</div><div className="text-xs text-gray-500">{model.provider}</div></div>
              ))}
              {activeTab === 'apikey' && (
                <div className="space-y-4 p-2">
                  <div><label className="block text-sm font-medium mb-2">KiloCode API Key</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter API key..." className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-sm font-medium mb-2">Custom Proxy URL (optional)</label><input type="text" value={customProxy} onChange={(e) => setCustomProxy(e.target.value)} placeholder="https://your-proxy.com/api" className="w-full bg-gpt-tertiary border border-gpt-border rounded-lg px-3 py-2 text-sm" /></div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gpt-border"><button onClick={() => setShowSettings(true)} className="w-full flex items-center justify-center gap-2 py-2 bg-gpt-tertiary hover:bg-gpt-hover rounded-lg text-sm"><FiSettings /> Settings</button></div>
          </motion.aside>
        )}
      </AnimatePresence>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gpt-border flex items-center justify-between px-4 bg-gpt-secondary">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 hover:bg-gpt-hover rounded-lg">☰</button>
            <h1 className="font-semibold">{selectedServer ? MCPServers[selectedServer]?.name : currentModel?.name || 'MCP Playground'}</h1>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${hasApiKey ? (supportsTools ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400') : 'bg-red-500/20 text-red-400'}`}>
            {!hasApiKey ? '⚠️ No API Key' : (supportsTools ? '✓ MCP Enabled' : 'Chat Only')}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gpt-accent to-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-4">⚡</div>
              <h2 className="text-2xl font-semibold mb-2">MCP Playground</h2>
              {!hasApiKey ? (<><p className="text-gray-400 mb-4">Configure your <span className="text-gpt-accent">KiloCode API key</span> first.</p><button onClick={() => setActiveTab('apikey')} className="px-4 py-2 bg-gpt-accent hover:bg-gpt-accent-hover rounded-lg">Configure API Key</button></>) : (<p className="text-gray-400">Select a model and server, then chat!</p>)}
            </div>
          ) : messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : msg.role === 'tool' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : msg.isError ? 'bg-gradient-to-br from-red-500 to-pink-600' : 'bg-gradient-to-br from-gpt-accent to-emerald-600'}`}>
                {msg.role === 'user' ? '👤' : msg.role === 'tool' ? '🔧' : '⚡'}
              </div>
              <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className="text-xs text-gray-500 mb-1">{msg.role === 'user' ? 'You' : msg.role === 'tool' ? `🔧 ${msg.toolName}` : currentModel?.name} · {formatTimestamp(msg.timestamp)}</div>
                <div className={`rounded-2xl p-3 ${msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : msg.role === 'tool' ? 'bg-amber-600/20 border border-amber-500/30 font-mono text-sm' : msg.isError ? 'bg-red-600/20 border border-red-500/30' : 'bg-gpt-tertiary border border-gpt-border'}`}>
                  <pre className="whitespace-pre-wrap text-sm">{msg.content}</pre>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gpt-accent to-emerald-600 flex items-center justify-center">⚡</div><div className="bg-gpt-tertiary border border-gpt-border rounded-2xl px-4 py-3"><div className="typing-indicator flex gap-1"><span className="w-2 h-2 bg-gpt-accent rounded-full"></span><span className="w-2 h-2 bg-gpt-accent rounded-full"></span><span className="w-2 h-2 bg-gpt-accent rounded-full"></span></div></div></div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-gpt-border bg-gpt-secondary">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder={!hasApiKey ? 'Configure API key first...' : (supportsTools ? (selectedServer ? `Message ${MCPServers[selectedServer]?.name}...` : 'Select a server or chat...') : 'Chat only mode...')} disabled={!hasApiKey} rows={1} className="w-full bg-gpt-tertiary border border-gpt-border rounded-xl px-4 py-3 pr-12 resize-none outline-none focus:border-gpt-accent disabled:opacity-50" style={{ minHeight: '52px', maxHeight: '200px' }} />
              <button onClick={handleSend} disabled={!input.trim() || isLoading || !hasApiKey} className="absolute right-2 bottom-2 p-2 bg-gpt-accent hover:bg-gpt-accent-hover disabled:bg-gpt-hover rounded-lg"><FiSend className="text-white" /></button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
