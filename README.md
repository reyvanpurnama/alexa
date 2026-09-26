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
├── server/             # Fastify REST API and Swagger routes
├── services/
│   └── ai/             # Multi-provider engine, memory, takeover, and tools
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

*Note: Administrative commands are automatically hidden from `/menu` for non-owner contacts.*

---

## Conversational AI Engine

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
- `POST /api/pairing`: Request an 8-digit WhatsApp pairing code.
  ```json
  {
    "phoneNumber": "628123456789"
  }
  ```

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
