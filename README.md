# Alexa

WhatsApp automation engine and notification gateway built with Baileys and Fastify.

---

## Features

- **High-Performance Gateway**: Non-blocking REST API for text, media, OTP, and status delivery.
- **Provider-Agnostic AI**: Native support for Gemini, OpenAI, Groq, DeepSeek, Ollama, and custom endpoints.
- **Multi-Turn Memory**: Sliding-window session retention with automatic TTL eviction.
- **Human Takeover & Auto-Snooze**: Automatically silences AI when an owner replies manually or when a customer requests support.
- **Autonomous Tool Calling**: Built-in function calling for real-time clock, handover requests, and system diagnostics.
- **Anti-Ban Queue**: Leaky-bucket outbound message scheduler with jitter protection.
- **Interactive Documentation**: Built-in OpenAPI specification and Swagger UI.

---

## Requirements

- Node.js 20+
- npm or pnpm

---

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

3. Configure essential keys in `.env`:
   - `API_KEY`: Secret key for REST API authentication.
   - `OWNER_NUMBERS`: Comma-separated WhatsApp numbers for administrative access.
   - `AI_PROVIDER`: Selected provider (`gemini`, `openai`, `groq`, `deepseek`, `ollama`, `custom`).
   - `AI_API_KEY`: Provider API key.
   - `AI_MODEL`: Model identifier (e.g. `openai/gpt-oss-120b`, `gpt-4o-mini`, `gemini-1.5-flash`).

4. Start development server:
   ```bash
   npm run dev
   ```

---

## Project Structure

```text
src/
├── commands/           # Modular commands (general, automation, ai)
├── config/             # Zod environment schema and validation
├── core/               # Baileys socket, serializer, and command manager
├── handlers/           # Inbound message event dispatcher
├── queue/              # Outbound message throttler (anti-ban delay)
├── server/             # Fastify REST API, Swagger, and Dashboard routes
├── services/
│   ├── ai/             # Multi-provider engine, memory, takeover, and tools
│   └── alerts/         # Real-time owner notifications & payment forwarding
├── types/              # TypeScript interfaces
└── utils/              # Logger, webhook dispatcher, and JID normalizer
```

---

## Built-In Commands

Command prefix is configurable in `.env` (default: `/`). Mobile keyboard autospacing (e.g. `/ menu`) is automatically normalized.

| Command | Aliases | Category | Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/menu` | `/help` | General | Public | List available commands |
| `/ping` | `/p` | General | Public | Check bot response latency |
| `/info` | `/about` | General | Public | Display runtime and system metrics |
| `/human` | `/cs`, `/admin` | General | Public | Request assistance from a human representative |
| `/ai` | `/ask`, `/tanya` | AI | Public | Query AI assistant with context memory |
| `/reset` | `/clear`, `/clearchat` | AI | Public | Reset active conversation memory session |
| `/mute` | `/pause`, `/snooze` | Automation | Owner | Mute AI auto-reply in current chat |
| `/unmute` | `/resume` | Automation | Owner | Restore autonomous AI auto-reply |
| `/logout` | `/disconnect`, `/unbind` | Automation | Owner | Disconnect session and prepare for new pairing |
| `/sessions` | `/profiles` | Automation | Owner | List saved session profiles on server |
| `/switch` | `/changesession` | Automation | Owner | Hot-swap active session profile |
| `/reloadkb` | `/refreshkb` | Automation | Owner | Reload business knowledge documents |
| `/broadcast` | `/bc` | Automation | Owner | Manage & dispatch anti-ban bulk broadcast campaigns |

*Note: Administrative commands are automatically hidden from `/menu` for non-owner contacts.*

---

## Conversational AI Engine

### Grounded Business Knowledge Base
- Documents placed inside `knowledge/` (`business.md` and `faq.json`) are automatically indexed and injected into the AI's grounding context.
- Grounding prevents hallucinations by strictly guiding answers based on official pricing, verified bank accounts, and business operating policies.
- Hot-reload knowledge at any time via `/reloadkb` command or `POST /api/knowledge/reload`.

### Multi-Turn Session Memory
- **Sliding Window**: Retains the last `AI_MAX_HISTORY` messages (default: 6) per session to maintain context without exceeding token quotas.
- **Inactivity TTL**: Inactive sessions automatically expire after `AI_SESSION_TIMEOUT_MIN` minutes (default: 15).
- **Session Scoping**: Conversations are isolated per user in private messages, and per-user-per-group in group chats.

### Human Takeover & Auto-Snooze
- **Owner Manual Reply**: When an owner replies directly from their phone in a private chat, AI auto-reply is automatically muted for 30 minutes to prevent interruptions.
- **Customer Handover**: When a customer requests a human agent (via `/human` or natural language prompt), the session is muted for 60 minutes and a `support.requested` webhook is dispatched.
- **Manual Control**: Owners can silence or resume auto-replies at any time using `/mute [minutes]` and `/unmute`.

### Autonomous Tool Calling
When using tool-capable models (e.g. Groq, OpenAI), the assistant autonomously executes backend functions:
- `get_current_time`: Retrieves the real-time clock in Indonesia (WIB, UTC+7).
- `request_human_handover`: Triggers support handover and pauses AI responses.
- `get_system_status`: Inspects runtime uptime and environment metrics.

---

## REST API

Base URL: `http://localhost:3000`  
Interactive Swagger documentation is available at `http://localhost:3000/docs`.

### Authentication
Include the `x-api-key` header with your configured `API_KEY` on all requests.

### Key Endpoints

- `GET /api/status`: Connection state and message queue statistics.
- `POST /api/send-message`: Dispatch an outbound text message.
  ```json
  {
    "to": "628123456789",
    "message": "Your verification code is 492019."
  }
  ```
- `POST /api/send-media`: Send media attachments (image, document, video, audio).
  ```json
  {
    "to": "628123456789",
    "type": "document",
    "url": "https://example.com/invoice.pdf",
    "caption": "Your monthly statement."
  }
  ```
- `POST /api/check-number`: Verify WhatsApp registration status of a phone number.
  ```json
  {
    "phoneNumber": "628123456789"
  }
  ```
- `POST /api/pairing`: Request an 8-digit WhatsApp pairing code for linking a new phone number.
  ```json
  {
    "phoneNumber": "628123456789"
  }
  ```
- `POST /api/session/logout`: Disconnect active WhatsApp session and clear credentials without restarting the server.
- `GET /api/sessions`: List all saved WhatsApp session profiles, active profile, and registration status.
- `POST /api/sessions/switch`: Hot-swap active WhatsApp connection to another session profile without deleting credentials.
  ```json
  {
    "sessionName": "backup_sales"
  }
  ```
- `DELETE /api/sessions/:sessionName`: Delete a saved inactive session profile from disk.
- `GET /api/knowledge`: Inspect loaded business knowledge base context and stats.
- `POST /api/knowledge/reload`: Force reload and re-index knowledge documents from disk.
- `POST /api/alerts/test`: Dispatch an instant test alert to all configured `OWNER_NUMBERS`.
- `POST /api/broadcast`: Start bulk broadcast with Spintax variation, pacing delay, and batch rest.
- `GET /api/broadcast/status`: Inspect active broadcast progress, sent/failed metrics, and recent history.
- `POST /api/broadcast/pause`: Pause active broadcast execution.
- `POST /api/broadcast/resume`: Resume paused broadcast.
- `POST /api/broadcast/cancel`: Cancel active broadcast.
- `POST /api/broadcast/preview`: Test Spintax template variations count and sample outputs.

---

## Anti-Ban Smart Broadcast Engine

Designed to eliminate spam detection and ban risks during bulk marketing campaigns:

- **Recursive Spintax Parser**: Supports deep nested options (`{Halo|{Hai|Selamat pagi}} {kak|bunda|mas}`) to guarantee unique wording for every recipient.
- **Dynamic Variable Injection**: Automatically interpolates `{{name}}`, `{{phone}}`, `{{time}}`, and `{{date}}`.
- **Human-Velocity Pacing**: Messages are dispatched sequentially with dynamic random jitter (default 4s – 8s per message).
- **Batch Rest Intervals**: Pauses execution automatically after every batch limit (default 25s rest every 15 messages) to simulate natural human activity.
- **Dashboard & Chat Control**: Launch campaigns, preview variations, and monitor live progress directly via Web Dashboard (`/dashboard`) or WhatsApp command (`/bc`).

---

## Real-Time Alerts & Payment Forwarding

Designed for high-converting business operations with zero friction:

- **Payment Proof Auto-Forwarding**: Inbound payment receipts (images, documents, PDFs) with transfer intent keywords (`bukti`, `transfer`, `tf`, `struk`, `lunas`, `bca`, `qris`, etc.) are automatically forwarded to all configured `OWNER_NUMBERS` with an Apple HIG-formatted context note.
- **Silent Human Takeover**: AI auto-reply is automatically snoozed for 60 minutes whenever payment proof is received or human handover is requested, preventing automated responses from interrupting business transactions.
- **Escalation Notification**: When a customer triggers `/human` or when the AI autonomously triggers `request_human_handover`, all owners receive an immediate WhatsApp notification with customer details and escalation reason.

---

## Webhooks

Set `WEBHOOK_URL` in `.env` to receive real-time HTTP POST notifications.

### Message Received (`message.received`)
```json
{
  "event": "message.received",
  "timestamp": 1727318000,
  "data": {
    "messageId": "3EB0B123456789",
    "from": "628123456789@s.whatsapp.net",
    "isGroup": false,
    "senderNumber": "628123456789",
    "senderName": "Budi",
    "body": "Hello world",
    "type": "text",
    "hasPrefix": false,
    "command": null
  }
}
```

### Support Requested (`support.requested`)
```json
{
  "event": "support.requested",
  "timestamp": 1727318050,
  "data": {
    "senderNumber": "628123456789",
    "reason": "Customer requested human assistance"
  }
}
```

Optional `WEBHOOK_SECRET` will be transmitted via the `x-webhook-secret` header for request verification.

---

## Docker Deployment

```bash
docker compose up -d
```

---

## License

MIT
