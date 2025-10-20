## Overview

Welcome to the MCP (Model Context Protocol) integration guide for Julep! This integration enables you to connect Julep agents with any MCP-compatible server, providing access to a vast ecosystem of tools and capabilities. MCP is a standardized protocol that allows language models to interact with external tools and services in a consistent, secure manner.The MCP integration is unique because instead of hardcoding specific tools, it dynamically discovers available capabilities from any MCP server. This makes Julep infinitely extensible - simply point it at a new MCP server and all its tools become available to your agents automatically.

## Prerequisites

To use the MCP integration, you need access to an MCP-compatible server. The server can be:
- A public MCP server (e.g., DeepWiki, GitHub Copilot MCP)
- A private MCP server you’ve deployed
Some servers may require authentication tokens or API keys.

## Supported Transports

The MCP integration supports two transport types:

## How to Use the Integration

To get started with the MCP integration, you need to define two types of tools:

## Examples

### Example 1: Basic HTTP Transport (DeepWiki)

```
name: Test DeepWiki with HTTP Transport

tools:

- type: integration

  name: mcp_fetch

  integration:

    provider: mcp

    method: list_tools

    setup:

      transport: http

      http_url: https://mcp.deepwiki.com/mcp

- type: integration

  name: mcp_call_tool

  integration:

    provider: mcp

    method: call_tool

    setup:

      transport: http

      http_url: https://mcp.deepwiki.com/mcp

main:

- tool: mcp_fetch

- tool: mcp_call_tool

  arguments:

    tool_name: read_wiki_structure

    arguments:

      repoName: facebook/react
```

### Example 2: SSE Transport with Headers

### Example 3: Authenticated MCP Server (GitHub)

## YAML Configuration Explained

Basic Configuration

- ***name***: A descriptive name for the task
- ***tools***: Lists the MCP integration tools being used
- ***type***: Must be `integration` for MCP tools

Integration Setup

For `call_tool` method:
- ***tool\_name***: The name of the MCP tool to execute
- ***arguments***: (Optional) Arguments to pass to the MCP tool
- ***timeout\_seconds***: (Optional) Per-call timeout in seconds (default: 60)
For `list_tools` method:
- No arguments required (empty object or omit entirely)

## Best Practices

**Tool Discovery**: Always call `list_tools` first to discover available capabilities before attempting to use specific tools. This ensures you’re aware of what tools are available and their required parameters.

**Authentication**: Never hardcode authentication tokens in your task definitions. Use Julep’s secrets management to store sensitive credentials securely.

## Advanced Features

### Dynamic Tool Discovery

The MCP integration’s killer feature is dynamic tool discovery. Instead of defining tools statically, your agents can:
1. Connect to any MCP server
2. Discover available tools at runtime
3. Adapt their capabilities based on what’s available
This means you can:
- Switch between different MCP servers without changing your code
- Add new capabilities by simply deploying new MCP servers
- Build agents that adapt to their environment

### Response Handling

MCP tool responses are normalized into a consistent format:

```
{

  "text": "Concatenated text content if any",

  "structured": {

    // Any structured data returned by the tool

  },

  "content": [

    // Raw content items as returned by the server

  ],

  "is_error": false

}
```

This allows you to handle responses consistently regardless of the underlying MCP server implementation.

## Using MCP with Automatic Tool Execution

One of the most powerful features of Julep is automatic tool execution, which works seamlessly with MCP integrations. This allows your agents to dynamically discover and use MCP tools without manual intervention.

### How It Works

When you combine MCP integration with Julep’s `auto_run_tools` feature:
1. **Tool Discovery**: The agent first calls `list_tools` to discover available capabilities from the MCP server
2. **Automatic Execution**: When the model determines an MCP tool is needed, it’s executed automatically
3. **Result Integration**: Tool results are fed back to the model to continue processing
4. **Seamless Workflow**: Everything happens in a single call - no manual intervention required

### Example: Autonomous MCP Agent in Tasks

```
name: Autonomous Documentation Assistant

tools:

  - type: integration

    name: mcp_discover

    integration:

      provider: mcp

      method: list_tools

      setup:

        transport: http

        http_url: https://mcp.deepwiki.com/mcp

  - type: integration

    name: mcp_execute

    integration:

      provider: mcp

      method: call_tool

      setup:

        transport: http

        http_url: https://mcp.deepwiki.com/mcp

main:

  # Step 1: Use discovered tools automatically to answer questions

  - prompt:

      - role: user

        content: |

          Using the available MCP tools, find information about the React repository structure

          and provide a comprehensive overview of its main components.

    auto_run_tools: true  # MCP tools execute automatically when needed
```

## Troubleshooting

Connection Issues

- Use `list_tools` to verify the tool exists on the server
- Check the tool’s input schema for required parameters

Authentication Errors

## Conclusion

The MCP integration opens up unlimited possibilities for extending Julep agents with external capabilities. By following a standardized protocol, you can connect to any MCP-compatible server and instantly gain access to its tools, making your agents more powerful and adaptable.

For more information about the Model Context Protocol, visit the [official MCP documentation](https://modelcontextprotocol.io/). To explore available MCP servers, check out the [MCP server directory](https://github.com/modelcontextprotocol/servers).

[Remote Browser](https://docs.julep.ai/integrations/webbrowser/remote-browser) [Add New Integrations](https://docs.julep.ai/integrations/contributing-integrations)

⌘I

Julep Assistant

Agents are the core building blocks in Julep. They are AI-powered entities that can execute tasks and interact with users through sessions.

## Creating an Agent

```
const agent = await client.agents.create({

  name: 'Customer Support Agent',

  model: 'claude-3.5-sonnet',

  about: 'A helpful customer support agent that assists users with their queries',

  metadata: {

    department: 'support',

    language: 'english'

  }

});
```

## Retrieving Agents

```
// Get a specific agent

const agent = await client.agents.get(agentId);

// List all agents

const agents = await client.agents.list({

  limit: 10,

  offset: 0

});

// Search agents

const searchResults = await client.agents.search({

  query: 'support',

  metadata: {

    department: 'support'

  }

});
```

## Updating Agents

```
const updatedAgent = await client.agents.update(agentId, {

  name: 'Senior Support Agent',

  metadata: {

    department: 'support',

    seniority: 'senior'

  }

});
```

## Deleting Agents

```
await client.agents.delete(agentId);
```

## Managing Agent Documents

Agents can be associated with documents that provide context for their tasks:

```
// Add a document

const document = await client.agents.docs.create(agentId, {

  title: 'Support Guidelines',

  content: 'Here are the guidelines for customer support...',

  metadata: {

    category: 'guidelines',

    version: '1.0'

  }

});

// Search documents

const docs = await client.agents.docs.search(agentId, {

  query: 'refund policy',

  metadata: {

    category: 'policy'

  }

});

// Delete a document

await client.agents.docs.delete(agentId, documentId);
```

## Adding Tools to Agents

Extend your agent’s capabilities by adding tools:

```
// Add a web search tool

const tool = await client.agents.tools.create(agentId, {

  name: 'web_search',

  description: 'Search the web for information',

  integration: {

    provider: 'brave',

    method: 'search',

    setup: {

      brave_api_key: process.env.BRAVE_API_KEY

    }

  }

});

// Add a custom function tool

const customTool = await client.agents.tools.create(agentId, {

  name: 'calculate_price',

  description: 'Calculate the final price including tax',

  type: 'function',

  function: {

    parameters: {

      type: 'object',

      properties: {

        base_price: {

          type: 'number',

          description: 'Base price before tax'

        },

        tax_rate: {

          type: 'number',

          description: 'Tax rate as a decimal'

        }

      },

      required: ['base_price', 'tax_rate']

    }

  }

});
```

The SDK uses custom error classes for better error handling:

```
try {

  const agent = await client.agents.create({

    name: 'Test Agent',

    model: 'invalid-model'

  });

} catch (error) {

  if (error.name === 'ValidationError') {

    console.error('Invalid model specified:', error.message);

  } else if (error.name === 'ApiError') {

    console.error('API error:', error.message, error.status);

  } else {

    console.error('Unexpected error:', error);

  }

}
```## [Tasks](https://docs.julep.ai/sdks/nodejs/tasks)

[

Learn how to create and execute tasks

](https://docs.julep.ai/sdks/nodejs/tasks)Sessions

Manage agent sessions

[View original](https://docs.julep.ai/sdks/nodejs/sessions)Tools Integration

Add more capabilities to your agents

[View original](https://docs.julep.ai/sdks/nodejs/tools-integration)Advanced Usage

Explore advanced patterns

[View original](https://docs.julep.ai/sdks/nodejs/advanced-usage)

[Installation & Setup](https://docs.julep.ai/sdks/nodejs/installation) [Tasks](https://docs.julep.ai/sdks/nodejs/tasks)

⌘I

Julep Assistant


Tasks are multi-step workflows that agents can execute. They can include prompts, tool calls, conditional logic, and more.

## Creating Tasks

Tasks can be created using either YAML or JavaScript objects:

```
// Using a JavaScript object

const task = await client.tasks.create(agentId, {

  name: 'Customer Support Task',

  description: 'Handle customer support requests',

  main: [

    {

      prompt: [

        {

          role: 'system',

          content: 'You are a helpful customer support agent.'

        },

        {

          role: 'user',

          content: '{{_.user_query}}'

        }

      ]

    },

    {

      tool: 'web_search',

      arguments: {

        query: '{{_.user_query}}'

      }

    }

  ]

});

// Using YAML

const taskYaml = \`

name: Customer Support Task

description: Handle customer support requests

main:

  - prompt:

      - role: system

        content: You are a helpful customer support agent.

      - role: user

        content: "{{_.user_query}}"

  - tool: web_search

    arguments:

      query: "{{_.user_query}}"

\`;

const task = await client.tasks.create(agentId, yaml.parse(taskYaml));
```

## Task Steps

Tasks can include various types of steps:

```
const task = await client.tasks.create(agentId, {

  name: 'Complex Task',

  description: 'A task with multiple step types',

  main: [

    // Prompt step

    {

      prompt: 'Analyze the following data: {{_.data}}'

    },

    // Tool call step

    {

      tool: 'web_search',

      arguments: {

        query: '{{_.search_query}}'

      }

    },

    // Evaluate step

    {

      evaluate: {

        average_score: 'sum(_.scores) / len(_.scores)'

      }

    },

    // Conditional step

    {

      if: '_.score > 0.8',

      then: [

        { log: 'High score achieved' }

      ],

      else: [

        { error: 'Score too low' }

      ]

    },

    // Iteration step

    {

      foreach: {

        in: '_.items',

        do: [

          { log: 'Processing item {{_}}' }

        ]

      }

    },

    // Parallel execution

    {

      parallel: [

        {

          tool: 'web_search',

          arguments: { query: 'query1' }

        },

        {

          tool: 'web_search',

          arguments: { query: 'query2' }

        }

      ]

    }

  ]

});
```

## Executing Tasks

```
// Execute a task

const execution = await client.executions.create(taskId, {

  input: {

    user_query: 'How do I reset my password?'

  }

});

// Get execution status

const status = await client.executions.get(execution.id);

// Wait for execution to complete

while (status.status !== 'succeeded' && status.status !== 'failed') {

  await new Promise(resolve => setTimeout(resolve, 1000));

  const updatedStatus = await client.executions.get(execution.id);

  console.log('Execution status:', updatedStatus.status);

}
```

## Managing Tasks

```
// Get a specific task

const task = await client.tasks.get(taskId);

// List all tasks

const tasks = await client.tasks.list({

  limit: 10,

  offset: 0

});

// Update a task

const updatedTask = await client.tasks.update(taskId, {

  description: 'Updated task description'

});

// Delete a task

await client.tasks.delete(taskId);
```

```
try {

  const execution = await client.executions.create(taskId, {

    input: {

      user_query: 'How do I reset my password?'

    }

  });

} catch (error) {

  if (error.name === 'ValidationError') {

    console.error('Invalid task configuration:', error.message);

  } else if (error.name === 'ExecutionError') {

    console.error('Execution failed:', error.message);

  } else {

    console.error('Unexpected error:', error);

  }

}
```## [Sessions](https://docs.julep.ai/sdks/nodejs/sessions)

[

Learn about session management

](https://docs.julep.ai/sdks/nodejs/sessions)Tools Integration

Add tools to your tasks

[View original](https://docs.julep.ai/sdks/nodejs/tools-integration)Advanced Usage

Explore advanced patterns

[View original](https://docs.julep.ai/sdks/nodejs/advanced-usage)API Reference

View the complete API reference

[View original](https://docs.julep.ai/api-reference)

[Agents](https://docs.julep.ai/sdks/nodejs/agents) [Sessions](https://docs.julep.ai/sdks/nodejs/sessions)

⌘I

Julep Assistant

Tools in Julep extend your agents’ capabilities by allowing them to interact with external services and perform specific functions. There are several types of tools available:

## Tool Types

1. **User-defined Functions**: Custom functions that you implement
2. **System Tools**: Built-in tools for interacting with Julep’s APIs
3. **Integrations**: Pre-built integrations with third-party services
4. **Direct API Calls**: Make HTTP requests to external APIs

## User-defined Functions

Create custom tools that your agents can use:

```
// Create a custom function tool

const tool = await client.agents.tools.create(agentId, {

  name: 'calculate_discount',

  description: 'Calculate the final price after applying a discount',

  type: 'function',

  function: {

    parameters: {

      type: 'object',

      properties: {

        original_price: {

          type: 'number',

          description: 'Original price before discount'

        },

        discount_percentage: {

          type: 'number',

          description: 'Discount percentage (0-100)'

        }

      },

      required: ['original_price', 'discount_percentage']

    }

  }

});
```

## System Tools

Use built-in tools to interact with Julep’s APIs:

```
// Add a system tool for listing agents

const systemTool = await client.agents.tools.create(agentId, {

  name: 'list_agent_docs',

  description: 'List all documents for the given agent',

  type: 'system',

  system: {

    resource: 'agent',

    subresource: 'doc',

    operation: 'list'

  }

});
```

## Built-in Integrations

Julep provides several pre-built integrations:

```
// Add Brave Search integration

const braveSearch = await client.agents.tools.create(agentId, {

  name: 'web_search',

  description: 'Search the web for information',

  integration: {

    provider: 'brave',

    method: 'search',

    setup: {

      brave_api_key: process.env.BRAVE_API_KEY

    }

  }

});
```

### Email Integration

```
// Add email integration

const emailTool = await client.agents.tools.create(agentId, {

  name: 'send_email',

  description: 'Send an email',

  integration: {

    provider: 'email',

    setup: {

      host: 'smtp.example.com',

      port: 587,

      user: process.env.EMAIL_USER,

      password: process.env.EMAIL_PASSWORD

    }

  }

});
```

### Weather Integration

```
// Add weather integration

const weatherTool = await client.agents.tools.create(agentId, {

  name: 'check_weather',

  description: 'Get weather information',

  integration: {

    provider: 'weather',

    setup: {

      openweathermap_api_key: process.env.OPENWEATHER_API_KEY

    }

  }

});
```

### Wikipedia Integration

```
// Add Wikipedia integration

const wikiTool = await client.agents.tools.create(agentId, {

  name: 'wiki_search',

  description: 'Search Wikipedia articles',

  integration: {

    provider: 'wikipedia'

  }

});
```

## Direct API Calls

Make direct HTTP requests to external APIs:

## Using Tools in Tasks

Once tools are added to an agent, they can be used in tasks:

```
const task = await client.tasks.create(agentId, {

  name: 'Research Task',

  description: 'Research a topic using multiple tools',

  main: [

    // Use web search

    {

      tool: 'web_search',

      arguments: {

        query: '{{_.topic}}'

      }

    },



    // Use Wikipedia

    {

      tool: 'wiki_search',

      arguments: {

        query: '{{_.topic}}'

      }

    },



    // Send results via email

    {

      tool: 'send_email',

      arguments: {

        to: '{{_.email}}',

        subject: 'Research Results: {{_.topic}}',

        body: '{{_.results}}'

      }

    }

  ]

});
```

## Tool Management

```
// List tools for an agent

const tools = await client.agents.tools.list(agentId);

// Get a specific tool

const tool = await client.agents.tools.get(agentId, toolId);

// Update a tool

const updatedTool = await client.agents.tools.update(agentId, toolId, {

  description: 'Updated tool description'

});

// Delete a tool

await client.agents.tools.delete(agentId, toolId);
```

```
try {

  const tool = await client.agents.tools.create(agentId, {

    name: 'web_search',

    integration: {

      provider: 'brave',

      setup: {

        brave_api_key: process.env.BRAVE_API_KEY

      }

    }

  });

} catch (error) {

  if (error.name === 'ValidationError') {

    console.error('Invalid tool configuration:', error.message);

  } else if (error.name === 'IntegrationError') {

    console.error('Integration setup failed:', error.message);

  } else {

    console.error('Unexpected error:', error);

  }

}
```## [Advanced Usage](https://docs.julep.ai/sdks/nodejs/advanced-usage)

[

Learn advanced patterns and best practices

](https://docs.julep.ai/sdks/nodejs/advanced-usage)API Reference

View the complete API reference

[View original](https://docs.julep.ai/api-reference)Examples

See real-world examples

[View original](https://docs.julep.ai/examples)Common Patterns

Learn common integration patterns

[View original](https://docs.julep.ai/sdks/common/error-handling)

[Managing Secrets with Node.js SDK](https://docs.julep.ai/sdks/nodejs/secrets) [Advanced Usage](https://docs.julep.ai/sdks/nodejs/advanced-usage)

⌘I

Julep Assistant
