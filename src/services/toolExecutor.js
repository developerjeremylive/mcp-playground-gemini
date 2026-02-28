/**
 * MCP Tool Executor
 * Executes MCP tools locally (simulated for browser environment)
 */

class ToolExecutor {
  constructor() {
    this.storageKey = 'mcp_playground_memory';
    this.initializeStorage();
  }

  /**
   * Initialize local storage for memory
   */
  initializeStorage() {
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify({
        collections: {},
        default: []
      }));
    }
  }

  /**
   * Get storage data
   */
  getStorage() {
    return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
  }

  /**
   * Save storage data
   */
  saveStorage(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName, args, serverId) {
    console.log(`Executing tool: ${toolName} on server: ${serverId}`, args);

    try {
      let result;

      switch (serverId) {
        case 'filesystem':
          result = await this.executeFilesystem(toolName, args);
          break;
        case 'memory':
          result = await this.executeMemory(toolName, args);
          break;
        case 'fetch':
          result = await this.executeFetch(toolName, args);
          break;
        case 'time':
          result = await this.executeTime(toolName, args);
          break;
        case 'git':
          result = await this.executeGit(toolName, args);
          break;
        case 'http':
          result = await this.executeHttp(toolName, args);
          break;
        case 'context7':
          result = await this.executeContext7(toolName, args);
          break;
        default:
          result = { success: false, error: `Server ${serverId} not implemented` };
      }

      return result;
    } catch (error) {
      console.error('Tool execution error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute filesystem tool
   */
  async executeFilesystem(toolName, args) {
    const fsKey = 'mcp_playground_files';
    
    switch (toolName) {
      case 'read_file': {
        const files = JSON.parse(localStorage.getItem(fsKey) || '{}');
        if (files[args.path]) {
          return { success: true, content: files[args.path] };
        }
        return { success: false, error: 'File not found. Create it first with write_file.' };
      }
      case 'write_file': {
        const files = JSON.parse(localStorage.getItem(fsKey) || '{}');
        files[args.path] = args.content;
        localStorage.setItem(fsKey, JSON.stringify(files));
        return { success: true, message: `File written to ${args.path}` };
      }
      case 'list_directory': {
        const files = JSON.parse(localStorage.getItem(fsKey) || '{}');
        const filesList = Object.keys(files).filter(f => f.startsWith(args.path || '/'));
        return { success: true, files: filesList };
      }
      case 'create_directory': {
        return { success: true, message: `Directory ${args.path} created (simulated)` };
      }
      case 'delete': {
        const files = JSON.parse(localStorage.getItem(fsKey) || '{}');
        delete files[args.path];
        localStorage.setItem(fsKey, JSON.stringify(files));
        return { success: true, message: `Deleted ${args.path}` };
      }
      default:
        return { success: false, error: `Unknown filesystem tool: ${toolName}` };
    }
  }

  /**
   * Execute memory tool
   */
  async executeMemory(toolName, args) {
    const storage = this.getStorage();

    switch (toolName) {
      case 'append': {
        const collection = args.collection || 'default';
        if (!storage.collections[collection]) {
          storage.collections[collection] = [];
        }
        storage.collections[collection].push({
          content: args.content,
          timestamp: new Date().toISOString()
        });
        this.saveStorage(storage);
        return { success: true, message: `Memory added to ${collection}` };
      }
      case 'query': {
        const collection = args.collection || 'default';
        const memories = storage.collections[collection] || [];
        // Simple search (in real app, use vector similarity)
        const query = args.query.toLowerCase();
        const results = memories
          .filter(m => m.content.toLowerCase().includes(query))
          .slice(0, args.limit || 5);
        return { success: true, results };
      }
      case 'list_collections': {
        return { success: true, collections: Object.keys(storage.collections) };
      }
      case 'create_collection': {
        const collection = args.name;
        if (!storage.collections[collection]) {
          storage.collections[collection] = [];
          this.saveStorage(storage);
          return { success: true, message: `Collection ${collection} created` };
        }
        return { success: false, error: 'Collection already exists' };
      }
      default:
        return { success: false, error: `Unknown memory tool: ${toolName}` };
    }
  }

  /**
   * Execute fetch tool
   */
  async executeFetch(toolName, args) {
    try {
      const response = await fetch(args.url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      let content = await response.text();
      
      // Truncate if too long
      if (args.max_length && content.length > args.max_length) {
        content = content.substring(0, args.max_length) + '...[truncated]';
      }

      return {
        success: true,
        status: response.status,
        content: content,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute time tool
   */
  async executeTime(toolName, args) {
    const now = new Date();

    switch (toolName) {
      case 'get_current_time':
        return {
          success: true,
          iso: now.toISOString(),
          rfc3339: now.toISOString(),
          unix: Math.floor(now.getTime() / 1000),
          utc: now.toUTCString()
        };
      case 'get_timezone':
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: args.timezone,
            timeStyle: 'full',
            dateStyle: 'full'
          });
          return {
            success: true,
            timezone: args.timezone,
            time: formatter.format(now)
          };
        } catch (e) {
          return { success: false, error: 'Invalid timezone' };
        }
      default:
        return { success: false, error: `Unknown time tool: ${toolName}` };
    }
  }

  /**
   * Execute git tool (simulated)
   */
  async executeGit(toolName, args) {
    const gitKey = 'mcp_playground_git';
    const gitData = JSON.parse(localStorage.getItem(gitKey) || '{"status":"clean","branch":"main","commits":[]}');

    switch (toolName) {
      case 'git_status':
        return { success: true, ...gitData };
      case 'git_log':
        return { success: true, commits: gitData.commits || [] };
      case 'git_branch':
        return { success: true, branches: [gitData.branch || 'main'], current: gitData.branch };
      default:
        return { success: false, error: `Git tool ${toolName} is simulated in browser` };
    }
  }

  /**
   * Execute HTTP tool
   */
  async executeHttp(toolName, args) {
    try {
      const response = await fetch(args.url, {
        method: args.method || 'GET',
        headers: args.headers || {},
        body: args.body
      });

      const content = await response.text();

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        content: content.substring(0, 10000),
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute Context7 tool (simulated)
   */
  async executeContext7(toolName, args) {
    // Simulated documentation lookup
    const docs = {
      'react': 'React is a JavaScript library for building user interfaces...',
      'javascript': 'JavaScript is a programming language that enables interactive web pages...',
      'python': 'Python is a high-level programming language...'
    };

    const query = args.query.toLowerCase();
    const source = args.source || 'general';

    // Find matching docs
    const results = Object.entries(docs)
      .filter(([key]) => key.includes(query) || query.includes(key))
      .map(([key, content]) => ({ source: key, content }));

    return {
      success: true,
      query: args.query,
      results: results.length > 0 ? results : [{ source: 'general', content: 'No specific docs found. Try: react, javascript, python' }]
    };
  }
}

export const toolExecutor = new ToolExecutor();
export default ToolExecutor;
