#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAuthTools } from "./tools/auth-tools.js";
import { registerMailTools } from "./tools/mail-tools.js";
import { registerCalendarTools } from "./tools/calendar-tools.js";
import { registerTodoTools } from "./tools/todo-tools.js";
import { registerContactTools } from "./tools/contact-tools.js";

const server = new McpServer({
  name: "mcp-microsoft-graph",
  version: "1.0.0",
});

registerAuthTools(server);
registerMailTools(server);
registerCalendarTools(server);
registerTodoTools(server);
registerContactTools(server);

// Phase 6 → registerFileTools(server)

const transport = new StdioServerTransport();
await server.connect(transport);
