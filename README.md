# Hitman Multiplayer Game

A real-time multiplayer assassination game built with Bun, WebSockets, and TypeScript.

## Features

- 🎯 Real-time multiplayer gameplay
- 🔗 URL-based game joining with simple Game IDs (e.g., "Wolf123")
- 📱 QR code generation for easy mobile joining
- 🎮 Circular target assignment system
- 💀 Live elimination tracking
- 🏆 Winner detection

## Local Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

The game will be available at `http://localhost:3000`

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

### Using Docker directly

Build the image:
```bash
docker build -t hitman-game .
```

Run the container:
```bash
docker run -p 3000:3000 hitman-game
```

## How to Play

1. **Create a Game**: Enter a game name and your player name
2. **Share the Game**: Give other players the Game ID (e.g., "Dragon567") or let them scan the QR code
3. **Start Playing**: Once 2+ players join, start the game
4. **Eliminate Targets**: Each player gets assigned a target and a secret code
5. **Win**: Be the last player standing!

## Game Rules

- Each player is assigned one target in a circular chain
- To eliminate your target, you need to enter their secret assassination code
- Only your assigned target can be eliminated by you
- When a player is eliminated, targets are reassigned among remaining players
- The last player alive wins!

This project was created using `bun init` in bun v1.2.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
