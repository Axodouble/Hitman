# Use the official Bun image as base
FROM oven/bun:alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN bun install

# Copy source code
COPY src/ ./src/

# Expose the port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "src/index.ts"]
