# HTTP container

```sh
docker build -f Dockerfile.http -t ynab-mcp-server .
docker run --rm -p 3000:3000 -e YNAB_API_TOKEN ynab-mcp-server
```

Supply `YNAB_API_TOKEN` at runtime (for example through Nomad secrets).
The container listens on `0.0.0.0:3000`; set `PORT` to override it.
Point Pangolin at that port and connect MCP clients to `/mcp` using
Streamable HTTP. Require HTTP Basic Auth in Pangolin; the container itself
does not authenticate requests.

Use `GET /health` for a Nomad HTTP service check. This checks the server,
without contacting YNAB. The server handles SIGTERM for graceful shutdown.
Requests are stateless, so multiple allocations do not need session affinity.

The environment variables documented in README.md apply, including optional
`YNAB_PLAN_ID` and `YNAB_READ_ONLY=true`. The container serves the shared YNAB
tools; Cloudflare-specific OAuth, scheduled jobs, and D1 auto-budget tools
remain part of the Worker deployment.
