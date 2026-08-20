# ==============================================================================
# RGGAMER Panel - Dockerfile (Java 25 Runtime + Node.js)
# Optimized for Paper 26.2+ and Minecraft 26.x+ servers
# ==============================================================================

# Build Stage
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source code and build
COPY . .
RUN npm run build

# Production Runtime Stage (OpenJDK 25 + Node.js 22)
FROM eclipse-temurin:25-jre-noble

# Set environment
ENV NODE_ENV=production \
    PORT=3000 \
    JAVA_HOME=/opt/java/openjdk \
    PATH="/opt/java/openjdk/bin:${PATH}"

WORKDIR /app

# Install Node.js 22 and necessary tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    procps \
    git \
    tar \
    unzip \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && npm install -g pm2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy built application assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/install.sh ./install.sh
COPY --from=builder /app/update.sh ./update.sh

# Create persistent storage directories
RUN mkdir -p .data backups .logs \
    && chmod +x scripts/*.sh update.sh install.sh

# Expose panel web port and default game server ports
EXPOSE 3000 25565-25585

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start panel server
CMD ["node", "dist/server.cjs"]
