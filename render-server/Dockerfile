# syntax=docker/dockerfile:1
FROM node:20-slim

# Install system dependencies for node-canvas and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    build-essential \
    python3 \
    pkg-config \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (layer cache for npm install)
COPY package.json ./

# Install Node.js dependencies (canvas will compile from source)
RUN npm install --omit=dev

# Copy server source
COPY server.js renderer.js ./

# Copy static WASM files (if present)
COPY public/ ./public/

# Cloud Run sets PORT automatically; default to 3001 for local testing
ENV PORT=3001
EXPOSE $PORT

CMD ["node", "server.js"]
