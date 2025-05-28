// Hitman Game Server
import { serve } from "bun";

// Game state types
interface Player {
  id: string;
  name: string;
  target?: string;
  code: string;
  alive: boolean;
  ws?: any; // ServerWebSocket type
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
  return Math.random().toString(36).substring(2, 15);
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

function broadcast(game: Game, message: any): void {
  game.players.forEach((player) => {
    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify(message));
    }
  });
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

// HTML template with URL-based reconnection
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hitman Game</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
            border: 1px solid rgba(255, 255, 255, 0.18);
            min-width: 400px;
            max-width: 600px;
            width: 90%;
        }
        
        h1 {
            text-align: center;
            margin-bottom: 2rem;
            font-size: 2.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .screen {
            display: none;
        }
        
        .screen.active {
            display: block;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }
        
        input {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
            font-size: 1rem;
        }
        
        button {
            background: linear-gradient(45deg, #ff6b6b, #feca57);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: transform 0.2s;
            width: 100%;
            margin-bottom: 1rem;
        }
        
        button:hover {
            transform: translateY(-2px);
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .player-list {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 1rem;
            margin: 1rem 0;
        }
        
        .player {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .player:last-child {
            border-bottom: none;
        }
        
        .player.me {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            padding: 0.5rem;
        }
        
        .player.dead {
            opacity: 0.5;
            text-decoration: line-through;
        }
        
        .status {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 1rem;
            margin: 1rem 0;
            text-align: center;
        }
        
        .target-info {
            background: rgba(255, 0, 0, 0.2);
            border: 2px solid rgba(255, 0, 0, 0.5);
            border-radius: 10px;
            padding: 1rem;
            margin: 1rem 0;
            text-align: center;
        }
        
        .code-input {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 1rem;
            margin: 1rem 0;
        }
        
        .share-link {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 1rem;
            margin: 1rem 0;
            word-break: break-all;
        }
        
        .winner {
            background: rgba(0, 255, 0, 0.2);
            border: 2px solid rgba(0, 255, 0, 0.5);
            border-radius: 10px;
            padding: 2rem;
            margin: 1rem 0;
            text-align: center;
            font-size: 1.5rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Hitman Game</h1>
        
        <!-- Main Menu -->
        <div id="mainMenu" class="screen active">
            <button onclick="showScreen('createGame')">Create New Game</button>
            <button onclick="showScreen('joinGame')">Join Game</button>
        </div>
        
        <!-- Create Game -->
        <div id="createGame" class="screen">
            <h2>Create New Game</h2>
            <div class="form-group">
                <label for="gameName">Game Name:</label>
                <input type="text" id="gameName" placeholder="Enter game name">
            </div>
            <div class="form-group">
                <label for="creatorName">Your Name:</label>
                <input type="text" id="creatorName" placeholder="Enter your name">
            </div>
            <button onclick="createGame()">Create Game</button>
            <button onclick="showScreen('mainMenu')">Back</button>
        </div>
        
        <!-- Join Game -->
        <div id="joinGame" class="screen">
            <h2>Join Game</h2>
            <div class="form-group">
                <label for="gameId">Game ID:</label>
                <input type="text" id="gameId" placeholder="Enter game ID">
            </div>
            <div class="form-group">
                <label for="playerName">Your Name:</label>
                <input type="text" id="playerName" placeholder="Enter your name">
            </div>
            <button onclick="joinGame()">Join Game</button>
            <button onclick="showScreen('mainMenu')">Back</button>
        </div>
        
        <!-- Game Lobby -->
        <div id="gameLobby" class="screen">
            <h2 id="lobbyGameName">Game Lobby</h2>
            <div class="share-link">
                <strong>Share this link:</strong><br>
                <span id="shareLink"></span>
            </div>
            <div class="player-list">
                <h3>Players:</h3>
                <div id="playerList"></div>
            </div>
            <button id="startGameBtn" onclick="startGame()" style="display: none;">Start Game</button>
            <button onclick="leaveGame()">Leave Game</button>
        </div>
        
        <!-- Game Playing -->
        <div id="gamePlaying" class="screen">
            <h2>Game in Progress</h2>
            <div id="targetInfo" class="target-info">
                <h3>Your Target: <span id="targetName"></span></h3>
                <p>Your assassination code: <strong id="myCode"></strong></p>
            </div>
            <div class="code-input">
                <label for="assassinationCode">Enter code to assassinate:</label>
                <input type="text" id="assassinationCode" placeholder="Enter target's code">
                <button onclick="assassinate()">Assassinate</button>
            </div>
            <div class="player-list">
                <h3>Players:</h3>
                <div id="gamePlayerList"></div>
            </div>
        </div>
        
        <!-- Game Finished -->
        <div id="gameFinished" class="screen">
            <div class="winner">
                <h2>🏆 Game Over!</h2>
                <p id="winnerText"></p>
            </div>
            <button onclick="showScreen('mainMenu')">Back to Main Menu</button>
        </div>
    </div>

    <script>
        let ws;
        let currentGame = null;
        let playerId = null;
        
        function showScreen(screenId) {
            document.querySelectorAll('.screen').forEach(screen => {
                screen.classList.remove('active');
            });
            document.getElementById(screenId).classList.add('active');
        }
        
        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(\`\${protocol}//\${window.location.host}/ws\`);
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };
            
            ws.onclose = () => {
                setTimeout(connectWebSocket, 3000);
            };
        }
        
        function handleWebSocketMessage(data) {
            switch(data.type) {
                case 'gameState':
                    updateGameState(data.state);
                    break;
                case 'gameStarted':
                    showScreen('gamePlaying');
                    updateGameState(data.state);
                    break;
                case 'playerEliminated':
                    alert(\`\${data.playerName} has been eliminated!\`);
                    updateGameState(data.state);
                    break;
                case 'gameFinished':
                    document.getElementById('winnerText').textContent = \`Winner: \${data.winner}\`;
                    showScreen('gameFinished');
                    break;
                case 'error':
                    if (data.code === 'PLAYER_NOT_FOUND') {
                        alert('Game session expired or not found. Redirecting to main menu.');
                        window.location.href = '/';
                    } else {
                        alert('Error: ' + data.message);
                    }
                    break;
            }
        }
        
        function updateGameState(state) {
            currentGame = state;
            
            if (state.started && !state.finished) {
                document.getElementById('targetName').textContent = state.myTarget || 'None';
                document.getElementById('myCode').textContent = state.myCode || '';
                updatePlayerList('gamePlayerList', state.players);
                showScreen('gamePlaying');
            } else if (!state.started) {
                document.getElementById('lobbyGameName').textContent = state.gameName;
                document.getElementById('shareLink').textContent = window.location.origin + '/?gameid=' + state.gameId;
                updatePlayerList('playerList', state.players);
                
                const startBtn = document.getElementById('startGameBtn');
                startBtn.style.display = state.players.length >= 2 ? 'block' : 'none';
                showScreen('gameLobby');
            }
        }
        
        function updatePlayerList(elementId, players) {
            const list = document.getElementById(elementId);
            list.innerHTML = '';
            
            players.forEach(player => {
                const div = document.createElement('div');
                div.className = 'player' + (player.isMe ? ' me' : '') + (player.alive === false ? ' dead' : '');
                div.innerHTML = \`
                    <span>\${player.name}\${player.isMe ? ' (You)' : ''}</span>
                    <span>\${player.alive === false ? '💀' : '✅'}</span>
                \`;
                list.appendChild(div);
            });
        }
        
        async function createGame() {
            const gameName = document.getElementById('gameName').value.trim();
            const creatorName = document.getElementById('creatorName').value.trim();
            
            if (!gameName || !creatorName) {
                alert('Please fill in all fields');
                return;
            }
            
            const response = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameName, playerName: creatorName })
            });
            
            const data = await response.json();
            if (data.success) {
                // Redirect to game URL with player info
                window.location.href = \`/?gameid=\${data.gameId}&playerid=\${data.playerId}\`;
            } else {
                alert('Error creating game: ' + data.error);
            }
        }
        
        async function joinGame() {
            const gameId = document.getElementById('gameId').value.trim();
            const playerName = document.getElementById('playerName').value.trim();
            
            if (!gameId || !playerName) {
                alert('Please fill in all fields');
                return;
            }
            
            const response = await fetch('/api/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, playerName })
            });
            
            const data = await response.json();
            if (data.success) {
                // Redirect to game URL with player info
                window.location.href = \`/?gameid=\${gameId}&playerid=\${data.playerId}\`;
            } else {
                alert('Error joining game: ' + data.error);
            }
        }
        
        function startGame() {
            if (ws && currentGame) {
                ws.send(JSON.stringify({ type: 'startGame', gameId: currentGame.gameId }));
            }
        }
        
        function assassinate() {
            const code = document.getElementById('assassinationCode').value.trim().toUpperCase();
            if (!code) {
                alert('Please enter a code');
                return;
            }
            
            if (ws && currentGame) {
                ws.send(JSON.stringify({ 
                    type: 'assassinate', 
                    gameId: currentGame.gameId, 
                    code 
                }));
                document.getElementById('assassinationCode').value = '';
            }
        }
        
        function leaveGame() {
            if (ws) {
                ws.close();
            }
            window.location.href = '/';
        }
        
        // Auto-join based on URL parameters
        window.onload = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const gameId = urlParams.get('gameid');
            const playerIdParam = urlParams.get('playerid');
            
            if (gameId && playerIdParam) {
                // Auto-rejoin existing game
                playerId = playerIdParam;
                connectWebSocket();
                ws.onopen = () => {
                    ws.send(JSON.stringify({ 
                        type: 'join', 
                        gameId: gameId, 
                        playerId: playerId 
                    }));
                };
            } else if (gameId) {
                // Join game by ID only (from share link)
                document.getElementById('gameId').value = gameId;
                showScreen('joinGame');
            } else {
                // Show main menu
                showScreen('mainMenu');
            }
        };
    </script>
</body>
</html>
`;

const server = serve({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) {
        return;
      }
      return new Response("Upgrade failed", { status: 400 });
    }

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
        };

        game.players.set(playerId, player);

        // Notify other players
        broadcast(game, {
          type: "gameState",
          state: getGameState(game),
        });

        return Response.json({
          success: true,
          gameId,
          playerId,
        });
      }
    }

    // Serve HTML
    return new Response(htmlTemplate, {
      headers: { "Content-Type": "text/html" },
    });
  },

  websocket: {
    message(ws, message) {
      try {
        const data = JSON.parse(message as string);

        switch (data.type) {
          case "join":
            const game = games.get(data.gameId);
            if (game && game.players.has(data.playerId)) {
              const player = game.players.get(data.playerId)!;
              player.ws = ws;

              // Send appropriate screen based on game state
              if (game.finished) {
                ws.send(
                  JSON.stringify({
                    type: "gameFinished",
                    winner: game.winner,
                  })
                );
              } else if (game.started) {
                ws.send(
                  JSON.stringify({
                    type: "gameStarted",
                    state: getGameState(game, data.playerId),
                  })
                );
              } else {
                ws.send(
                  JSON.stringify({
                    type: "gameState",
                    state: getGameState(game, data.playerId),
                  })
                );
              }
            } else {
              // Player ID not found, send error to trigger fallback
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Player not found in game",
                  code: "PLAYER_NOT_FOUND",
                })
              );
            }
            break;

          case "startGame":
            const startGame = games.get(data.gameId);
            if (
              startGame &&
              !startGame.started &&
              startGame.players.size >= 2
            ) {
              startGame.started = true;

              // Assign targets
              const players = Array.from(startGame.players.values());
              assignTargets(players);

              broadcast(startGame, {
                type: "gameStarted",
                state: getGameState(startGame),
              });

              // Send individual states with target info
              startGame.players.forEach((player, playerId) => {
                if (player.ws) {
                  player.ws.send(
                    JSON.stringify({
                      type: "gameState",
                      state: getGameState(startGame, playerId),
                    })
                  );
                }
              });
            }
            break;

          case "assassinate":
            const assassinateGame = games.get(data.gameId);
            if (
              assassinateGame &&
              assassinateGame.started &&
              !assassinateGame.finished
            ) {
              // Find the assassin player
              let assassinPlayer: Player | null = null;
              for (const player of assassinateGame.players.values()) {
                if (player.ws === ws && player.alive) {
                  assassinPlayer = player;
                  break;
                }
              }

              if (!assassinPlayer) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "You are not alive or not in this game",
                  })
                );
                break;
              }

              // Find the target player (must be the assassin's assigned target)
              const targetPlayer = assassinateGame.players.get(
                assassinPlayer.target!
              );

              if (
                targetPlayer &&
                targetPlayer.alive &&
                targetPlayer.code === data.code
              ) {
                targetPlayer.alive = false;

                // Check if game is finished
                const alivePlayers = Array.from(
                  assassinateGame.players.values()
                ).filter((p) => p.alive);

                if (alivePlayers.length === 1) {
                  assassinateGame.finished = true;
                  assassinateGame.winner = alivePlayers[0]?.name;

                  broadcast(assassinateGame, {
                    type: "gameFinished",
                    winner: assassinateGame.winner,
                  });
                } else {
                  // Reassign targets if needed
                  if (alivePlayers.length > 1) {
                    assignTargets(alivePlayers);
                  }

                  broadcast(assassinateGame, {
                    type: "playerEliminated",
                    playerName: targetPlayer.name,
                    state: getGameState(assassinateGame),
                  });

                  // Send updated individual states
                  assassinateGame.players.forEach((player, playerId) => {
                    if (player.ws && player.alive) {
                      player.ws.send(
                        JSON.stringify({
                          type: "gameState",
                          state: getGameState(assassinateGame, playerId),
                        })
                      );
                    }
                  });
                }
              } else {
                // Invalid code or not your target
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Invalid code or this is not your assigned target",
                  })
                );
              }
            }
            break;
        }
      } catch (error) {
        console.error("WebSocket error:", error);
      }
    },

    close(ws) {
      // Clean up disconnected players if needed
      for (const game of games.values()) {
        for (const player of game.players.values()) {
          if (player.ws === ws) {
            player.ws = undefined;
            break;
          }
        }
      }
    },
  },
});

console.log(`🎯 Hitman Game Server running on http://localhost:${server.port}`);
console.log(
  "Players can create games, join with invitation links, and start assassinating!"
);