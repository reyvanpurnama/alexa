FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json tsconfig.json ./
RUN npm install

# Copy source and build TypeScript
COPY src/ ./src/
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled dist from builder
COPY --from=builder /app/dist ./dist

# Create sessions folder
RUN mkdir -p /app/sessions

EXPOSE 3000

CMD ["node", "dist/index.js"]
