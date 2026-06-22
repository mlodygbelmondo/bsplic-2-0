---
name: dev-tunnel
description: Start, reuse, and verify a phone-accessible Cloudflare Quick Tunnel for a local development app. Use when the user asks to expose localhost, open the app on a phone, create a tunnel, use Cloudflare tunnel or trycloudflare, share a local Vite app, or run this project on custom port 6767 instead of port 3000 for manual testing.
---

# Dev Tunnel

## Quick Start

Run the helper from the repository root:

```bash
bash .codex/skills/dev-tunnel/scripts/start-dev-tunnel.sh
```

Defaults:

- Port: `6767`
- Path: `/dev/jackpot`
- App command when the port is not already listening: `npm run dev -- --host 0.0.0.0 --port 6767`
- Tunnel command: `cloudflared tunnel --url http://localhost:6767 --http-host-header localhost:6767`

Override the port or path when needed:

```bash
bash .codex/skills/dev-tunnel/scripts/start-dev-tunnel.sh 6767 /dev/jackpot
bash .codex/skills/dev-tunnel/scripts/start-dev-tunnel.sh 8081 /
```

## Workflow

1. Start with the script above. It installs `cloudflared` with Homebrew on macOS if it is missing and Homebrew is available.
2. Wait for the script to print the Cloudflare URL. Report the full URL including the requested path.
3. Keep the dev server and tunnel running unless the user explicitly asks to stop them.
4. If the user needs confidence that the UI works from a phone-sized screen, run a Playwright mobile viewport smoke test against the printed URL.

## Output To Report

Give the user:

- Primary Cloudflare URL.
- LAN URL when the script finds a local network IP.
- Local URL.
- Log locations if something fails.

Do not suggest port `3000` unless the user asks for it. Prefer `6767` for this project.

## Reliability Notes

Cloudflare Quick Tunnels are good for development demos and phone testing. They are free and do not require a Cloudflare account, but they are not production-grade:

- The URL is random and changes when a new quick tunnel is started.
- Cloudflare documents Quick Tunnels as testing/development only.
- Quick Tunnels currently have a 200 in-flight request limit.
- Quick Tunnels do not support Server-Sent Events.
- There is no uptime/SLA guarantee for accountless TryCloudflare tunnels.

For a reliable permanent setup, use a named Cloudflare Tunnel with a Cloudflare account and a domain or subdomain. Keep Quick Tunnels for temporary local testing.
