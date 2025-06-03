// Hitman Game Server
import { serve } from "bun";
import { join } from "path";

// Game state types
interface Player {
  id: string; // Serverside unique identifier for the player
  name: string; // Player's name
  target?: string; // ID of the player's target (assigned after game starts)
  code: string; // Unique code for the player, used for game logic
  alive: boolean; // Whether the player is still alive in the game
}

interface Game {
  id: string; // Unique identifier for the game
  players: Map<string, Player>; // Map of players in the game, keyed by player ID
  host: Player; // The player who created the game, also a participant
  started: boolean; // Whether the game has started
  finished: boolean; // Whether the game has finished
  winner?: string; // ID of the winning player, if any
}

// Global game storage
const games = new Map<string, Game>();

// Utility functions
function generateId(): string {
  const words = [
    "Wolf",
    "Eagle",
    "Tiger",
    "Lion",
    "Bear",
    "Fox",
    "Hawk",
    "Shark",
    "Dragon",
    "Phoenix",
    "Thunder",
    "Lightning",
    "Storm",
    "Fire",
    "Ice",
    "Star",
    "Moon",
    "Sun",
    "Arrow",
    "Blade",
    "Swift",
    "Shadow",
    "Steel",
    "Crystal",
    "River",
    "Mountain",
    "Forest",
    "Ocean",
    "Crown",
    "Castle",
    "Ruby",
    "Diamond",
    "Silver",
    "Gold",
    "Frost",
    "Flame",
    "Wind",
    "Stone",
    "Peak",
    "Valley",
  ];

  const word = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(Math.random() * 900) + 100; // 3-digit number (100-999)

  return `${word}${number}`;
}

function generateCode(): string {
  return (
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
      //Replace all ambiguous characters
      .replace(/[O0I1l]/g, (c) => {
        switch (c) {
          case "O":
            return "Q";
          case "0":
            return "D";
          case "I":
            return "J";
          case "1":
            return "T";
          case "l":
            return "F";
          default:
            return c;
        }
      })
  );
}

function assignTargets(players: Player[]): void {
  if (players.length < 2) return;

  // Create a circular assignment
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    const nextIndex = (i + 1) % shuffled.length;
    if (shuffled[i] && shuffled[nextIndex]) {
      shuffled[i]!.target = shuffled[nextIndex].id;
    }
  }
}

const server = serve({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url);
    // API endpoints
    if (url.pathname === "/api/create") {
      if (req.method === "POST") {
        const body = (await req.json()) as {
          playerName: string;
        };
        const { playerName } = body;

        const gameId = generateId();
        const playerId = generateId();
        const playerCode = generateCode();

        const player: Player = {
          id: playerId,
          name: playerName,
          code: playerCode,
          alive: true,
        };

        const game: Game = {
          id: gameId,
          players: new Map(),
          host: player,
          started: false,
          finished: false,
        };

        game.players.set(playerId, player);
        games.set(gameId, game);

        return Response.json({
          success: true,
          gameId,
          playerId,
        });
      }
    }

    if (url.pathname === "/api/join") {
      if (req.method === "POST") {
        const { gameId, playerName } = (await req.json()) as {
          gameId: string;
          playerName: string;
        };

        const game = games.get(gameId);
        if (!game) {
          return Response.json({ success: false, error: "Game not found" });
        }

        if (game.started) {
          return Response.json({
            success: false,
            error: "Game already started",
          });
        }

        const playerId = generateId();
        const playerCode = generateCode();

        const player: Player = {
          id: playerId,
          name: playerName,
          code: playerCode,
          alive: true,
        };
        game.players.set(playerId, player);

        // Notify all players individually with personalized data
        return Response.json({
          success: true,
          gameId,
          playerId,
        });
      }
    }

    if (url.pathname === "/api/game") {
      if (req.method === "GET") {
        const gameId = url.searchParams.get("gameId");
        const playerId = url.searchParams.get("playerId");

        if (!gameId || !playerId) {
          return Response.json({
            success: false,
            error: "Game ID and Player ID required",
          });
        }

        const game = games.get(gameId);
        if (!game) {
          return Response.json({ success: false, error: "Game not found" });
        }

        const player = game.players.get(playerId);
        if (!player) {
          return Response.json({ success: false, error: "Player not found" });
        }        // Convert players map to array for frontend
        const players = Array.from(game.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          alive: p.alive,
          isHost: p.id === game.host.id,
        }));        // Get target information if game has started
        let targetInfo = null;
        if (game.started && player.target) {
          const target = game.players.get(player.target);
          if (target) {
            targetInfo = {
              id: target.id,
              name: target.name
              // Don't send the target's code to the client
            };
          }
        }

        return Response.json({
          success: true,
          game: {
            id: game.id,
            started: game.started,
            finished: game.finished,
            winner: game.winner,
            players: players,
            isHost: player.id === game.host.id,
            target: targetInfo,
            playerCode: player.code
          },
        });
      }
    }

    if (url.pathname === "/api/start") {
      if (req.method === "POST") {
        const { gameId, playerId } = (await req.json()) as {
          gameId: string;
          playerId: string;
        };

        const game = games.get(gameId);
        if (!game) {
          return Response.json({ success: false, error: "Game not found" });
        }

        const player = game.players.get(playerId);
        if (!player) {
          return Response.json({ success: false, error: "Player not found" });
        }

        // Only host can start the game
        if (player.id !== game.host.id) {
          return Response.json({
            success: false,
            error: "Only the host can start the game",
          });
        }

        if (game.started) {
          return Response.json({
            success: false,
            error: "Game already started",
          });
        }

        if (game.players.size < 2) {
          return Response.json({
            success: false,
            error: "Need at least 2 players to start",
          });
        }

        // Assign targets to all players
        const playerArray = Array.from(game.players.values());
        assignTargets(playerArray);

        // Mark game as started
        game.started = true;

        return Response.json({
          success: true,
          message: "Game started successfully",
        });
      }
    }

    if (url.pathname === "/api/eliminate") {
      if (req.method === "POST") {
        const { gameId, playerId, targetCode } = (await req.json()) as {
          gameId: string;
          playerId: string;
          targetCode: string;
        };

        const game = games.get(gameId);
        if (!game) {
          return Response.json({ success: false, error: "Game not found" });
        }

        if (!game.started) {
          return Response.json({
            success: false,
            error: "Game has not started yet",
          });
        }

        if (game.finished) {
          return Response.json({
            success: false,
            error: "Game has already finished",
          });
        }

        const player = game.players.get(playerId);
        if (!player) {
          return Response.json({ success: false, error: "Player not found" });
        }

        if (!player.alive) {
          return Response.json({ success: false, error: "You are already eliminated" });
        }

        if (!player.target) {
          return Response.json({ success: false, error: "You don't have a target" });
        }

        const target = game.players.get(player.target);
        if (!target) {
          return Response.json({ success: false, error: "Target not found" });
        }

        if (!target.alive) {
          return Response.json({
            success: false,
            error: "Target is already eliminated",
          });
        }

        // Check if the code matches the target's code
        if (targetCode.toUpperCase() !== target.code) {
          return Response.json({
            success: false,
            error: "Incorrect code. Elimination failed.",
          });
        }

        // Elimination successful, update game state
        target.alive = false;

        // Assign the target's target to the player
        if (target.target) {
          player.target = target.target;
        } else {
          player.target = undefined;
        }        // Check if the game is over (only one player alive)
        const alivePlayers = Array.from(game.players.values()).filter(p => p.alive);
        if (alivePlayers.length === 1) {
          game.finished = true;
          game.winner = alivePlayers[0]?.id;
        }        return Response.json({
          success: true,
          message: "Target eliminated successfully",
          newTarget: player.target ? {
            id: game.players.get(player.target)?.id,
            name: game.players.get(player.target)?.name
          } : null,
          gameOver: game.finished,
          winner: game.winner,
        });
      }
    }

    try {
      // Serve compiled files from dist/public, but fallback to src/public for HTML
      let path;
      if (url.pathname.endsWith(".js")) {
        // Serve compiled JS from dist
        path = join(import.meta.dir, "public", url.pathname);
      } else {
        // Serve other static files (HTML, CSS) from src/public
        path = join(
          import.meta.dir,
          "public",
          url.pathname === "/" ? "index.html" : url.pathname
        );
      }
      return new Response(Bun.file(path));
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
});

console.log(`🎯 Hitman Game Server running on http://localhost:${server.port}`);
