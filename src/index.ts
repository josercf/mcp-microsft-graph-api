#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAuthTools } from "./tools/auth-tools.js";

const server = new McpServer({
  name: "mcp-microsoft-graph",
  version: "1.0.0",
});

registerAuthTools(server);

// Modules registered progressively as they are implemented:
// Phase 2 → registerMailTools(server)
// Phase 3 → registerCalendarTools(server)
// Phase 4 → registerTodoTools(server)
// Phase 5 → registerContactTools(server)
// Phase 6 → registerFileTools(server)

const transport = new StdioServerTransport();
await server.connect(transport);
