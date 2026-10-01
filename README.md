# Alexa

> Autonomous WhatsApp Business Engine with Embedded Edge-Data Mirroring & Apple HIG Conversational UX.  
> Built with Baileys, Fastify, and Node.js Native SQLite.

[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-339933?logo=node.js&logoColor=white)](#requirements)
[![Fastify](https://img.shields.io/badge/fastify-v5.x-black?logo=fastify&logoColor=white)](#rest-api)
[![Baileys](https://img.shields.io/badge/baileys-v7.x-25D366?logo=whatsapp&logoColor=white)](#conversational-ux)
[![Storage](https://img.shields.io/badge/storage-embedded%20sqlite%20(WAL)-003B57?logo=sqlite&logoColor=white)](#edge-data-mirroring)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

Alexa is an enterprise-grade WhatsApp automation engine designed for modern businesses, e-commerce stores, and retail operations. Rather than querying live production databases or relying on rigid hardcoded endpoints, Alexa integrates an **Embedded Edge-Data Store** with **Apple HIG Conversational Mechanics**:

1. **Edge-Data Mirroring**: Replicates transactional records into an embedded SQLite database in WAL mode. When administrators or owners query analytics (*"What is today's revenue by cashier?"*), the AI autonomously runs safe, microsecond SQL aggregations locally without placing any load on external databases or point-of-sale systems.
2. **Apple HIG Conversational UX**: Incoming messages receive an immediate 0-second double blue tick (`markRead`) and sustain a continuous 4-second typing heartbeat (`sendTyping`) during AI inference, providing clear visual feedback and making wait times feel natural.
3. **Universal REST Gateway & Delivery Receipts**: Full API for transactional messaging, anti-ban bulk broadcasts with recursive Spintax, lifecycle delivery tracking (Queued ➔ Sent ➔ Delivered ➔ Read), and outbound webhooks.
4. **Quiet Web Dashboard**: A minimalist control plane built with Apple Inset Grouped layout, dual-mode knowledge editor, and Page Visibility API integration to eliminate background battery and network drain.
5. **Role-Based Access Control & Slim Intent Router**: Pluggable role resolver classifies incoming senders into granular roles (`OWNER`, `ADMIN`, `STAFF`, `VIP`, `PUBLIC`) with command-level permission guards. Natural language messages are routed via a 2-Tier Slim Intent Router (Tier 1 regex: 0 tokens; Tier 2 slim LLM: ~300 tokens), achieving a 93%+ token reduction with zero SQL hallucination.

---

## Key Features

- **Embedded SQLite Core (WAL Mode)**: High-throughput local storage running directly inside Node.js. Zero external database configuration required.
- **Role-Based Access Control (RBAC)**: Pluggable `RoleResolver` callback classifies incoming phone numbers with fine-grained command-level guards (`roles?: string[]`) and role-aware `/menu` filtering.
- **Slim AI Intent Router (2-Tier)**: Eliminates heavy 5,000+ token raw SQL prompts by mapping natural queries to deterministic handlers via Tier 1 regex (0 tokens, <1ms) or Tier 2 slim LLM classification (~300 tokens, <1.5s).
- **Autonomous Business Analytics Tool**: The AI introspects local table schemas and generates read-only `SELECT` queries to aggregate metrics in under 2 milliseconds, reducing LLM token consumption by up to 90%.
- **Hardware-Grade Read-Only Guard**: Mutation keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `PRAGMA`) are strictly rejected by an AST-level query validator to prevent prompt injection attacks.
- **Immediate Read Receipts**: Instant double blue ticks acknowledge message reception within 0 seconds.
- **Persistent Typing Heartbeat**: Automatically refreshes the WhatsApp `composing` indicator every 4 seconds to override the native 5-second timeout during AI reasoning.
- **Anti-Ban Outbound Queue**: Sequential execution, randomized human jitter (4s–8s), and automatic batch cooldowns to mitigate spam detection.
- **Universal Delivery Lifecycle**: Comprehensive delivery tracking with real-time webhooks (`message.delivered`, `message.read`, `message.failed`).
- **Quiet Control Plane**: Adheres to Apple Human Interface Guidelines: zero visual clutter, progressive disclosure sheets, and automatic polling suspension when browser tabs are hidden.

---

## Quick Start

### Requirements
* Node.js **20.0+** (Node.js 22+ recommended for native `node:sqlite`)
* npm, pnpm, or yarn

### Installation
```bash
# Clone repository
git clone https://github.com/reyvanpurnama/alexa.git
cd alexa

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### Environment Configuration
Configure `.env` with your credentials:

```ini
# Server Configuration
PORT=3000
HOST=0.0.0.0
API_KEY=your_secure_api_key_here

# Bot Identity
BOT_NAME=Alexa
PREFIX=/
OWNER_NUMBERS=628123456789

# AI Provider (gemini | openai | groq | deepseek | ollama | custom)
AI_PROVIDER=groq
AI_API_KEY=gsk_your_groq_api_key_here
AI_MODEL=openai/gpt-oss-120b
AI_AUTO_REPLY=true

# Optional: Outbound Webhook Integration
WEBHOOK_URL=https://your-domain.com/api/whatsapp/webhook
WEBHOOK_SECRET=your_webhook_secret_key
```

### Run
```bash
npm run dev
```

Navigate to **`http://localhost:3000/dashboard`** to link your WhatsApp account via QR Code or 8-Digit Pairing Code.

---

## Developer Integration Guide

Integrate external applications (Laravel, Django, Node.js, Go, or POS terminals) with Alexa via standard HTTP requests without touching the core engine code.

### 1. Ingest Real-Time Business Data
Push transactions, orders, inventory updates, or customer profiles whenever events occur in your primary system:

```bash
curl -X POST http://localhost:3000/api/sync/events \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secure_api_key_here" \
  -d '{
    "table": "pos_transactions",
    "action": "upsert",
    "primaryKey": "id",
    "data": {
      "id": 1054,
      "invoice_no": "INV-20260927-001",
      "total_amount": 75000,
      "cashier_name": "Alex",
      "payment_method": "QRIS",
      "created_at": "2026-09-27 18:30:00"
    }
  }'
```
*Note: If the target table or new columns do not exist yet, Alexa automatically creates and alters the local SQLite schema dynamically (Auto-DDL).*

### 2. Send Outbound Messages with Delivery Tracking
Dispatch notifications or verification codes with lifecycle tracking:

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secure_api_key_here" \
  -d '{
    "to": "628123456789",
    "message": "Hello! Your order #1054 has been confirmed.",
    "queued": true,
    "referenceId": "ORDER-1054"
  }'
```

### 3. Query Delivery Receipts
Verify whether a message was delivered or read by the recipient:

```bash
curl -X GET "http://localhost:3000/api/messages/status?referenceId=ORDER-1054" \
  -H "x-api-key: your_secure_api_key_here"
```

### 4. Outbound Webhook Events
When `WEBHOOK_URL` is set, Alexa dispatches real-time events signed with `x-webhook-secret`:
- `message.received`: Inbound message or attachment received.
- `payment.received`: Inbound image or PDF detected with payment receipt intent.
- `support.requested`: Customer requested a human representative.

### 5. Role-Based Access Control (RBAC) & Slim Intent Router
Applications can register custom role resolvers and role-scoped deterministic intents into the core engine without modifying engine code:

```typescript
import { commandManager } from './core/commandManager.js';
import { intentRouter } from './services/ai/intentRouter.js';

// 1. Register custom role resolver (e.g., query customer tier or staff credentials)
commandManager.setRoleResolver(async (senderNumber) => {
  const staff = await getStaffRecord(senderNumber);
  if (staff) return { role: 'STAFF', data: { staffId: staff.id, name: staff.name, branch: staff.branch } };

  const customer = await getCustomerRecord(senderNumber);
  if (customer?.isVip) return { role: 'VIP', data: { customerId: customer.id, tier: 'gold' } };

  return 'PUBLIC';
});

// 2. Register role-scoped deterministic intent (Tier 1 regex + Tier 2 slim LLM)
intentRouter.registerIntent({
  name: 'sales_summary',
  description: 'Retrieve daily or monthly sales metrics for authorized staff',
  roles: ['STAFF', 'ADMIN', 'OWNER'],
  patterns: [/sales.*(today|month)/i, /revenue.*report/i],
  handler: async (ctx) => {
    // Fast deterministic database lookup (0 LLM tokens, <1ms)
    const metrics = await getSalesMetrics(ctx.params.period || 'today', ctx.roleData?.branch);
    return `*Sales Summary (${ctx.params.period || 'Today'})*\n• Revenue: $${metrics.revenue.toLocaleString()}\n• Orders: ${metrics.orders}`;
  },
});
```

---

## Conversational AI & Grounding

### Dual-Mode Knowledge Hub
- **Business Profile (`knowledge/business.md`)**: Define business hours, verified payment details, policies, and address in Markdown.
- **FAQ Builder (`knowledge/faq.json`)**: Manage structured Q&A pairs categorized by topic directly from the Web Dashboard.
- **Zero Hallucinations**: Grounding prompts constrain the assistant to verified business knowledge.

### Human Takeover & Auto-Snooze
- **Owner Manual Reply**: When an owner replies directly from their phone in a private chat, AI auto-reply automatically mutes for 30 minutes.
- **Customer Handover**: When a customer requests human assistance (via `/human` or natural phrasing), AI auto-reply mutes for 60 minutes and alerts the owners.
- **Manual Control**: Silence or resume auto-replies at any time via `/mute [minutes]` and `/unmute`.

---

## REST API Reference

Interactive OpenAPI documentation is available at `http://localhost:3000/docs`.

| Endpoint | Method | Scope | Description |
| :--- | :--- | :--- | :--- |
| `/api/status` | `GET` | Public | System uptime, connection state, and queue statistics |
| `/api/send-message` | `POST` | Protected | Dispatch outbound text message (immediate or queued) |
| `/api/send-media` | `POST` | Protected | Dispatch media (image, PDF document, video, audio) |
| `/api/check-number` | `POST` | Protected | Check if phone number is registered on WhatsApp |
| `/api/messages/status` | `GET` | Protected | Query message delivery lifecycle by client `referenceId` |
| `/api/messages/recent` | `GET` | Protected | Inspect recent outbound messages and carrier ACKs |
| `/api/sync/events` | `POST` | Protected | Ingest real-time business records into local SQLite store |
| `/api/sync/status` | `GET` | Protected | View local database stats, tables, and active schema |
| `/api/sync/query` | `POST` | Protected | Read-only SQL query explorer for administrators |
| `/api/broadcast` | `POST` | Protected | Launch campaign with Spintax, jitter pacing, and batch rest |
| `/api/broadcast/status` | `GET` | Protected | Monitor active broadcast progress and completion metrics |
| `/api/broadcast/pause` | `POST` | Protected | Pause active broadcast execution |
| `/api/broadcast/resume`| `POST` | Protected | Resume paused broadcast |
| `/api/broadcast/cancel`| `POST` | Protected | Cancel remaining broadcast queue |
| `/api/pairing` | `POST` | Protected | Request 8-digit WhatsApp pairing code |
| `/api/session/logout` | `POST` | Protected | Disconnect active WhatsApp session safely |
| `/api/sessions` | `GET` | Protected | List all saved session profiles on server |
| `/api/sessions/switch` | `POST` | Protected | Hot-swap active WhatsApp profile without re-pairing |
| `/api/knowledge` | `GET` | Protected | Inspect loaded knowledge documents and indexed chars |
| `/api/knowledge/reload`| `POST` | Protected | Force re-index knowledge documents from disk |
| `/api/settings` | `GET/PUT`| Protected | View or update runtime settings (delays, AI toggle, bot name)|
| `/api/settings/owners` | `POST` | Protected | Add new administrator phone number |
| `/api/settings/owners/:phone` | `DELETE` | Protected | Remove administrator phone number |

---

## Built-In Commands

Command prefix is configurable in `.env` (default: `/`). Mobile keyboard auto-spacing (e.g. `/ menu`) is automatically normalized.

| Command | Aliases | Scope | Description |
| :--- | :--- | :--- | :--- |
| `/menu` | `/help` | Public | Display available commands |
| `/ping` | `/p` | Public | Measure bot response and network latency |
| `/info` | `/about` | Public | Display system runtime and Baileys version |
| `/human` | `/cs`, `/admin` | Public | Request immediate handover to a human representative |
| `/ai` | `/ask`, `/tanya` | Public | Query AI assistant directly with typing heartbeat |
| `/reset` | `/clear` | Public | Clear personal multi-turn conversation memory |
| `/mute` | `/pause`, `/snooze` | Owner | Silence AI auto-replies in current conversation |
| `/unmute`| `/resume` | Owner | Re-enable AI auto-replies in current conversation |
| `/broadcast` | `/bc` | Owner | Launch and manage Spintax broadcast campaigns |
| `/sessions` | `/profiles` | Owner | List all saved session profiles |
| `/switch` | `/changesession` | Owner | Switch active session profile |
| `/reloadkb`| `/refreshkb` | Owner | Reload and re-index business knowledge documents |
| `/logout` | `/disconnect` | Owner | Log out current WhatsApp connection |

---

## Project Structure

```text
alexa/
├── data/                       # Embedded SQLite store (gitignored)
│   └── local_store.sqlite      # Real-time WAL edge replica
├── knowledge/                  # Grounding documents
│   ├── business.md             # Markdown business profile & policies
│   └── faq.json                # Structured FAQ entries
├── public/dashboard/           # Apple HIG Quiet Web Dashboard
│   ├── css/                    # Modular CSS architecture (13 sub-sheets)
│   ├── js/                     # Modular frontend with Visibility API guard
│   └── index.html              # Bento grid layout with progressive disclosure
├── src/
│   ├── commands/               # Modular commands (general, ai, automation)
│   ├── config/                 # Zod environment schemas & settings manager
│   ├── core/                   # Baileys socket, serializer, & command manager (RBAC Guard)
│   │   └── store/              # Embedded SQLite core with Read-Only Guard
│   ├── handlers/               # Inbound message event dispatcher (0s markRead)
│   ├── queue/                  # Anti-ban queue throttler with jitter
│   ├── server/                 # Fastify REST API, Swagger UI, & Web Dashboard
│   │   └── routes/api/         # Modular endpoints (sync, messages, sessions, etc.)
│   ├── services/
│   │   ├── ai/                 # Multi-provider LLM, Slim Intent Router, & tools
│   │   ├── alerts/             # Real-time owner notifications & payment forwarding
│   │   ├── chat/               # Persistent chat activity logger
│   │   ├── messages/           # Message lifecycle tracker & LRU cache
│   │   └── sync/               # Incremental data catch-up reconciler worker
│   ├── types/                  # TypeScript interfaces & definitions
│   └── utils/                  # Logger, webhook dispatcher, & Spintax parser
├── package.json
└── tsconfig.json
```

---

## Production Deployment

### Standard Node.js
```bash
npm run build
npm start
```

### Docker
```bash
docker compose up -d
```

---

## License

This project is licensed under the [MIT License](LICENSE).
