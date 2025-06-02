// Hitman Game Server
import { serve } from "bun";
import { join } from "path";

// Game state types
interface Player {
  id: string;
  name: string;
  target?: string;
  code: string;
  alive: boolean;
}

interface Game {
  id: string;
  name: string;
  players: Map<string, Player>;
  started: boolean;
  finished: boolean;
  winner?: string;
}

// Global game storage
const games = new Map<string, Game>();

// Utility functions
function generateId(): string {
  const words = [
    'Wolf', 'Eagle', 'Tiger', 'Lion', 'Bear', 'Fox', 'Hawk', 'Shark', 'Dragon', 'Phoenix',
    'Thunder', 'Lightning', 'Storm', 'Fire', 'Ice', 'Star', 'Moon', 'Sun', 'Arrow', 'Blade',
    'Swift', 'Shadow', 'Steel', 'Crystal', 'River', 'Mountain', 'Forest', 'Ocean', 'Crown', 'Castle',
    'Ruby', 'Diamond', 'Silver', 'Gold', 'Frost', 'Flame', 'Wind', 'Stone', 'Peak', 'Valley'
  ];
  
  const word = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(Math.random() * 900) + 100; // 3-digit number (100-999)
  
  return `${word}${number}`;
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

function getGameState(game: Game, playerId?: string): any {
  const players = Array.from(game.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    isMe: p.id === playerId,
  }));

  const state: any = {
    gameId: game.id,
    gameName: game.name,
    players,
    started: game.started,
    finished: game.finished,
    winner: game.winner,
  };

  if (playerId && game.players.has(playerId)) {
    const player = game.players.get(playerId)!;
    if (game.started && player.alive) {
      const target = game.players.get(player.target!);
      state.myTarget = target ? target.name : null;
      state.myCode = player.code;
    }
  }

  return state;
}

const server = serve({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url);
    // API endpoints
    if (url.pathname === "/api/create") {
      if (req.method === "POST") {
        const body = (await req.json()) as {
          gameName: string;
          playerName: string;
        };
        const { gameName, playerName } = body;

        const gameId = generateId();
        const playerId = generateId();
        const playerCode = generateCode();

        const game: Game = {
          id: gameId,
          name: gameName,
          players: new Map(),
          started: false,
          finished: false,
        };

        const player: Player = {
          id: playerId,
          name: playerName,
          code: playerCode,
          alive: true,
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
        };        game.players.set(playerId, player);

        // Notify all players individually with personalized data
        return Response.json({
          success: true,
          gameId,
          playerId,
        });
      }
    }    try {
      // Serve compiled files from dist/public, but fallback to src/public for HTML
      let path;
      if (url.pathname.endsWith('.js')) {
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
  }
});

console.log(`🎯 Hitman Game Server running on http://localhost:${server.port}`);