import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as ynab from "ynab";
import { isReadOnly, registerAll } from "./registry.js";

// Authentication belongs to the reverse proxy in this deployment.
if (!process.env.YNAB_API_TOKEN) throw new Error("YNAB_API_TOKEN is required");
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
const api = new ynab.API(process.env.YNAB_API_TOKEN);

const http = createServer(async (request, response) => {
  const path = request.url?.split("?")[0];
  if (path === "/health" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "text/plain" }).end("ok\n");
    return;
  }
  if (path !== "/mcp") {
    response.writeHead(404).end();
    return;
  }

  // Stateless requests work across Nomad allocations without sticky sessions.
  const server = new McpServer({ name: "ynab-mcp-server", version: "0.7.2" });
  registerAll(server, api, { readOnly: isReadOnly(process.env.YNAB_READ_ONLY) });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  response.on("close", () => {
    void server.close().catch(console.error);
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!response.headersSent) response.writeHead(500).end();
    else response.end();
    await server.close();
  }
});

http.listen(port, "0.0.0.0", () => {
  console.error(`YNAB MCP HTTP server listening on port ${port} at /mcp`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    http.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
