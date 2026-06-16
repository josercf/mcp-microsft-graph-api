#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAuthTools } from "./tools/auth-tools.js";
import { registerMailTools } from "./tools/mail-tools.js";

const server = new McpServer({
  name: "mcp-microsoft-graph",
  version: "1.0.0",
});

registerAuthTools(server);
registerMailTools(server);

// Phase 3 → registerCalendarTools(server)
// Phase 4 → registerTodoTools(server)
// Phase 5 → registerContactTools(server)
// Phase 6 → registerFileTools(server)

const transport = new StdioServerTransport();
await server.connect(transport);
