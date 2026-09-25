# Alexa

WhatsApp automation engine and notification gateway built with Baileys and Fastify.

## Requirements

- Node.js 20+
- npm or pnpm

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

3. Configure `.env`:
   - `PORT`: REST API port (default: `3000`)
   - `API_KEY`: Secret key for API authentication
   - `BOT_NAME`: Bot identifier (default: `Alexa`)
   - `PREFIX`: Command prefix (default: `!`)
   - `OWNER_NUMBERS`: Comma-separated phone numbers for owner access
   - `USE_PAIRING_CODE`: Set to `true` to use 8-digit pairing code instead of QR

4. Start development server:
   ```bash
   npm run dev
   ```

## Project Structure

```text
src/
├── commands/       # Modular command handlers
├── config/         # Environment and configuration validation
├── core/           # Baileys socket, message serializer, command manager
├── handlers/       # Inbound message event dispatcher
├── queue/          # Outbound message throttler (anti-ban delay)
├── server/         # Fastify REST API routes
├── types/          # TypeScript interfaces
└── utils/          # Logger and JID normalizer
```

## Adding Commands

Create a TypeScript file inside `src/commands/<category>/<command_name>.ts`:

```typescript
import type { Command } from '../../types/command.js';

const command: Command = {
  name: 'ping',
  description: 'Health check command',
  execute: async ({ m }) => {
    await m.reply('pong');
  },
};

export default command;
```

Commands are automatically registered on startup. Supported options:
- `aliases`: string[]
- `category`: 'general' | 'automation' | 'tools' | 'ai' | 'owner'
- `ownerOnly`: boolean
- `groupOnly`: boolean
- `privateOnly`: boolean

## REST API

Base URL: `http://localhost:3000`

Interactive Swagger documentation is available at `/docs`.

### Endpoints

- `GET /api/status`: Connection state and message queue stats
- `POST /api/send-message`: Send text notification
  - Header: `x-api-key: <API_KEY>`
  - Body: `{"to": "08123456789", "message": "hello"}`
- `POST /api/send-media`: Send media attachment (document, image, video, audio)
  - Header: `x-api-key: <API_KEY>`
  - Body: `{"to": "08123456789", "type": "document", "url": "https://example.com/invoice.pdf"}`
- `POST /api/pairing`: Request 8-digit pairing code
  - Header: `x-api-key: <API_KEY>`
  - Body: `{"phoneNumber": "628123456789"}`

## Docker

```bash
docker compose up -d
```
