/**
 * MCP Tools Configuration
 * Contains all MCP servers and tools that don't require credentials
 */

export const MCPServers = {
  filesystem: {
    id: 'filesystem',
    name: 'File System',
    icon: '📁',
    description: 'Access and manage files in the filesystem',
    category: 'storage',
    requiresAuth: false,
    tools: [
      {
        name: 'read_file',
        description: 'Read contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'create_directory',
        description: 'Create a new directory',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path for the new directory' }
          },
          required: ['path']
        }
      },
      {
        name: 'list_directory',
        description: 'List files in a directory',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to list' }
          },
          required: ['path']
        }
      },
      {
        name: 'delete',
        description: 'Delete a file or directory',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to delete' },
            recursive: { type: 'boolean', description: 'Delete recursively', default: false }
          },
          required: ['path']
        }
      }
    ]
  },

  memory: {
    id: 'memory',
    name: 'Memory',
    icon: '💾',
    description: 'Persistent vector storage for memories',
    category: 'storage',
    requiresAuth: false,
    tools: [
      {
        name: 'append',
        description: 'Add new memory to collection',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name', default: 'default' },
            content: { type: 'string', description: 'Memory content to store' }
          },
          required: ['content']
        }
      },
      {
        name: 'query',
        description: 'Query memories by similarity',
        parameters: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name', default: 'default' },
            query: { type: 'string', description: 'Query text' },
            limit: { type: 'number', description: 'Max results', default: 5 }
          },
          required: ['query']
        }
      },
      {
        name: 'list_collections',
        description: 'List all collections',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'create_collection',
        description: 'Create a new collection',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Collection name' }
          },
          required: ['name']
        }
      }
    ]
  },

  fetch: {
    id: 'fetch',
    name: 'Web Fetch',
    icon: '🌐',
    description: 'Fetch content from URLs',
    category: 'web',
    requiresAuth: false,
    tools: [
      {
        name: 'fetch',
        description: 'Fetch content from a URL',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            max_length: { type: 'number', description: 'Max characters', default: 10000 }
          },
          required: ['url']
        }
      }
    ]
  },

  time: {
    id: 'time',
    name: 'Time',
    icon: '⏰',
    description: 'Get current time and date',
    category: 'utility',
    requiresAuth: false,
    tools: [
      {
        name: 'get_current_time',
        description: 'Get current UTC time in RFC 3339 format',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_timezone',
        description: 'Get time for a specific timezone',
        parameters: {
          type: 'object',
          properties: {
            timezone: { type: 'string', description: 'IANA timezone (e.g., America/New_York)' }
          },
          required: ['timezone']
        }
      }
    ]
  },

  sequentialthinking: {
    id: 'sequentialthinking',
    name: 'Sequential Thinking',
    icon: '🧠',
    description: 'Advanced reasoning and thought processing',
    category: 'reasoning',
    requiresAuth: false,
    tools: [
      {
        name: 'think',
        description: 'Process thoughts sequentially with context',
        parameters: {
          type: 'object',
          properties: {
            thought: { type: 'string', description: 'Current thought' },
            context: { type: 'string', description: 'Previous context' },
            depth: { type: 'number', description: 'Thinking depth', default: 3 }
          },
          required: ['thought']
        }
      }
    ]
  },

  git: {
    id: 'git',
    name: 'Git',
    icon: '📚',
    description: 'Git repository operations',
    category: 'development',
    requiresAuth: false,
    tools: [
      {
        name: 'git_status',
        description: 'Show working tree status',
        parameters: {
          type: 'object',
          properties: {
            repo_path: { type: 'string', description: 'Repository path', default: '.' }
          }
        }
      },
      {
        name: 'git_log',
        description: 'Show commit history',
        parameters: {
          type: 'object',
          properties: {
            repo_path: { type: 'string', description: 'Repository path', default: '.' },
            max_count: { type: 'number', description: 'Max commits', default: 10 }
          }
        }
      },
      {
        name: 'git_branch',
        description: 'List all branches',
        parameters: {
          type: 'object',
          properties: {
            repo_path: { type: 'string', description: 'Repository path', default: '.' }
          }
        }
      }
    ]
  },

  http: {
    id: 'http',
    name: 'HTTP',
    icon: '🔗',
    description: 'Make HTTP requests',
    category: 'web',
    requiresAuth: false,
    tools: [
      {
        name: 'request',
        description: 'Make an HTTP request',
        parameters: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
            url: { type: 'string', description: 'Request URL' },
            headers: { type: 'object', description: 'Request headers' },
            body: { type: 'string', description: 'Request body' }
          },
          required: ['url']
        }
      }
    ]
  },

  sqlite: {
    id: 'sqlite',
    name: 'SQLite',
    icon: '🗃️',
    description: 'SQLite database operations',
    category: 'database',
    requiresAuth: false,
    tools: [
      {
        name: 'query',
        description: 'Execute a SQL query',
        parameters: {
          type: 'object',
          properties: {
            database: { type: 'string', description: 'Database path', default: ':memory:' },
            query: { type: 'string', description: 'SQL query' }
          },
          required: ['query']
        }
      }
    ]
  },

  puppeteer: {
    id: 'puppeteer',
    name: 'Browser',
    icon: '🌎',
    description: 'Browser automation',
    category: 'automation',
    requiresAuth: false,
    tools: [
      {
        name: 'navigate',
        description: 'Navigate to a URL',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate' }
          },
          required: ['url']
        }
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Save path' }
          }
        }
      }
    ]
  },

  context7: {
    id: 'context7',
    name: 'Context7',
    icon: '📖',
    description: 'Documentation lookup',
    category: 'reference',
    requiresAuth: false,
    tools: [
      {
        name: 'search_docs',
        description: 'Search documentation',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            source: { type: 'string', description: 'Documentation source' }
          },
          required: ['query']
        }
      }
    ]
  },

  everything: {
    id: 'everything',
    name: 'Everything',
    icon: '🔮',
    description: 'Comprehensive MCP tools',
    category: 'utility',
    requiresAuth: false,
    tools: [
      {
        name: 'everything',
        description: 'General purpose tool',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action to perform' },
            params: { type: 'object', description: 'Action parameters' }
          },
          required: ['action']
        }
      }
    ]
  }
};

// Auth required servers (for display)
export const AuthRequiredServers = [
  'github', 'notion', 'slack', 'gmail', 'google-drive', 
  'linear', 'confluence', 'jira', 'postgres', 'mongodb',
  'redis', 'elasticsearch', 'supabase', 'neon', 'stripe'
];

// Get all available tools flat
export const getAllTools = () => {
  const tools = [];
  Object.values(MCPServers).forEach(server => {
    server.tools.forEach(tool => {
      tools.push({
        ...tool,
        serverId: server.id,
        serverName: server.name,
        serverIcon: server.icon
      });
    });
  });
  return tools;
};

// Get tool schema for LLM
export const getToolsSchema = () => {
  return Object.values(MCPServers).map(server => ({
    name: server.id,
    description: server.description,
    tools: server.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }))
  }));
};
