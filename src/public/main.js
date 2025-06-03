// @ts-check

/**
 * @param {string} screenId
 */
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  const screenElement = document.getElementById(screenId);
  if (screenElement) {
    screenElement.classList.add("active");
  }
}

/**
 * @param {string | number | boolean} url
 */
function generateQRCode(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    url
  )}`;
}

// Global game state
let currentGame = {
  id: /** @type {string|null} */ (null),
  playerId: /** @type {string|null} */ (null),
  playerName: /** @type {string|null} */ (null),
  isHost: false
};

/**
 * Create a new game
 */
async function createGame() {
  const creatorNameInput = /** @type {HTMLInputElement} */ (document.getElementById('creatorName'));
  
  if (!creatorNameInput) {
    alert('Required form elements not found');
    return;
  }
  const creatorName = creatorNameInput.value.trim();
  
  if (!creatorName) {
    alert('Please fill in all fields');
    return;
  }
  
  try {
    const response = await fetch('/api/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerName: creatorName
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Store game state
      currentGame.id = result.gameId;
      currentGame.playerId = result.playerId;
      currentGame.playerName = creatorName;
      currentGame.isHost = true;
      // Clear form inputs
      creatorNameInput.value = '';
      
      // Update URL with game state
      updateUrlWithGameState();
      
      // Show game lobby
      showGameLobby();
    } else {
      alert(result.error || 'Failed to create game');
    }
  } catch (error) {
    console.error('Error creating game:', error);
    alert('Failed to create game. Please try again.');
  }
}

/**
 * Display the game lobby with current game information
 */
function showGameLobby() {
  if (!currentGame.id) {
    alert('No active game found');
    return;
  }
  
  // Update lobby title
  const lobbyTitle = document.getElementById('lobbyGameName');
  if (lobbyTitle) {
    lobbyTitle.textContent = `Game Lobby - ${currentGame.id}`;
  }
  
  // Generate and display QR code
  const qrContainer = document.querySelector('.qr-container');
  if (qrContainer) {
    const gameUrl = `${window.location.origin}?join=${currentGame.id}`;
    const qrCodeUrl = generateQRCode(gameUrl);
    qrContainer.innerHTML = `<img src="${qrCodeUrl}" alt="QR Code" class="qr-code">`;
  }    // Display share link
  const shareLink = document.querySelector('.share-link');
  if (shareLink) {
    const simpleJoinUrl = `${window.location.origin}/?join=${currentGame.id}`;
    
    let gameIdHtml = `
      <strong>Join Link (for new players):</strong><br>
      <div class="clickable-link" onclick="copyToClipboard('${simpleJoinUrl}', event)">${simpleJoinUrl}</div>
      <div class="copy-hint">👆 Click to copy</div>
    `;
    
    shareLink.innerHTML = gameIdHtml;
  }
  
  // Show start game button if host
  const startGameBtn = document.getElementById('startGameBtn');
  if (startGameBtn && currentGame.isHost) {
    startGameBtn.style.display = 'block';
  }
    // Start polling for game state updates
  startGameStatePolling();
  
  // Switch to lobby screen
  showScreen('gameLobby');
}

/**
 * Update the player list display
 */
function updatePlayerList() {
  const playerList = document.querySelector('#gameLobby .player-list');
  if (!playerList || !currentGame.playerId) return;
  
  // For now, just show the current player (creator)
  // This will be enhanced when we add real-time updates
  playerList.innerHTML = `
    <div class="player me">
      <span>${currentGame.playerName} (You) ${currentGame.isHost ? '👑' : ''}</span>
      <span>Ready</span>
    </div>
  `;
}

/**
 * Fetch and update game state from server
 */
async function fetchGameState() {
  if (!currentGame.id || !currentGame.playerId) return null;

  try {
    const response = await fetch(`/api/game?gameId=${currentGame.id}&playerId=${currentGame.playerId}`);
    const result = await response.json();    
    
    if (result.success) {
      // Skip UI update if user is currently typing in the assassination code field
      const assassinationField = document.getElementById('assassinationCode');
      const isFieldFocused = assassinationField === document.activeElement;
      
      if (!isFieldFocused) {
        updateGameDisplay(result.game);
      } else {
        // Still update the game state behind the scenes, but don't refresh UI
        // This ensures we still track game changes while user is typing
        
        // Check for game state changes that should override focus (like game ending)
        if (result.game.finished) {
          updateGameDisplay(result.game);
        }
      }
      
      // Check if player was eliminated
      if (result.game.started && !result.game.finished) {
        checkPlayerElimination(result.game);
      }
      
      return result;
    } else {
      console.error('Failed to fetch game state:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error fetching game state:', error);
    return null;
  }
}

/**
 * Update the game display with fresh data from server
 * @param {any} gameData 
 */
function updateGameDisplay(gameData) {  // Check if player is eliminated
  const currentPlayer = gameData.players.find(/** @param {any} p */ (p) => p.id === currentGame.playerId);
  const isPlayerEliminated = currentPlayer && !currentPlayer.alive;

  // Update player list
  const playerList = document.querySelector('#gameLobby .player-list');
  if (playerList && gameData.players) {
    playerList.innerHTML = gameData.players.map(/** @param {any} player */ (player) => `
      <div class="player ${player.id === currentGame.playerId ? 'me' : ''} ${!player.alive ? 'dead' : ''}">
        <span>${player.name} ${player.id === currentGame.playerId ? '(You)' : ''} ${player.isHost ? '👑' : ''} ${!player.alive && player.id === currentGame.playerId ? '<span class="spectator-badge">SPECTATOR</span>' : ''}</span>
        <span>${player.alive ? 'Ready' : 'Dead'}</span>
      </div>
    `).join('');
  }

  // Show start button if user is host and game hasn't started
  const startGameBtn = /** @type {HTMLButtonElement} */ (document.getElementById('startGameBtn'));
  if (startGameBtn) {
    if (gameData.isHost && !gameData.started && gameData.players && gameData.players.length >= 2) {
      startGameBtn.style.display = 'block';
      startGameBtn.disabled = false;
      startGameBtn.textContent = 'Start Game';
    } else if (gameData.isHost && !gameData.started && gameData.players && gameData.players.length < 2) {
      startGameBtn.style.display = 'block';
      startGameBtn.disabled = true;
      startGameBtn.textContent = 'Need at least 2 players';
    } else {
      startGameBtn.style.display = 'none';
    }
  }
  // Handle game state changes
  if (gameData.started && !gameData.finished) {
    // Game has started, switch to playing screen
    updateGamePlayingScreen(gameData);
    showScreen('gamePlaying');
  } else if (gameData.finished) {
    // Game has finished, switch to finished screen
    updateGameFinishedScreen(gameData);
    showScreen('gameFinished');
  }
}

/**
 * Update the game playing screen with current game data
 * @param {any} gameData 
 */
function updateGamePlayingScreen(gameData) {
  // Check if player is eliminated
  const currentPlayer = gameData.players.find(/** @param {any} p */ (p) => p.id === currentGame.playerId);
  const isPlayerEliminated = currentPlayer && !currentPlayer.alive;

  // Update target information
  const targetInfo = document.querySelector('#gamePlaying #targetInfo');
  if (targetInfo) {
    if (isPlayerEliminated) {
      // Player is eliminated, show spectator mode
      targetInfo.innerHTML = `
        <h3>👁️ Spectator Mode</h3>
        <p>You've been eliminated, but you can still watch the game unfold.</p>
      `;
    } else if (gameData.target) {
      // Player is alive, show target info
      targetInfo.innerHTML = `
        <h3>🎯 Your Target</h3>
        <p><strong>Name:</strong> ${gameData.target.name}</p>
        <p style="font-size: 0.9em; opacity: 0.8;">Find your target and get them to reveal their code!</p>
      `;
    }
  }

  // Update player list in game screen
  const gamePlayerList = document.querySelector('#gamePlaying .player-list');
  if (gamePlayerList && gameData.players) {
    gamePlayerList.innerHTML = `
      <h3>Players:</h3>
      ${gameData.players.map(/** @param {any} player */ (player) => `
        <div class="player ${player.id === currentGame.playerId ? 'me' : ''} ${!player.alive ? 'dead' : ''}">
          <span>${player.name} ${player.id === currentGame.playerId ? '(You)' : ''} ${player.isHost ? '👑' : ''}</span>
          <span>${player.alive ? 'Alive' : 'Dead'}</span>
        </div>
      `).join('')}
    `;
  }  // Update code input section
  const codeInput = document.querySelector('#gamePlaying .code-input');
  if (codeInput) {
    if (isPlayerEliminated) {
      // Hide the code input section for eliminated players
      (/** @type {HTMLElement} */ (codeInput)).style.display = 'none';
    } else if (gameData.playerCode) {
      // Save current input value before updating the UI
      const currentInputValue = document.getElementById('assassinationCode') 
        ? (/** @type {HTMLInputElement} */ (document.getElementById('assassinationCode'))).value
        : '';
        
      // Show code input for active players
      codeInput.innerHTML = `
        <h3>🔑 Your Code</h3>
        <p>Your code is: <span style="font-family: 'Courier New', monospace; font-weight: bold; font-size: 1.2em; background: rgba(255,255,255,0.2); padding: 0.2em 0.5em; border-radius: 4px;">${gameData.playerCode}</span></p>
        <p style="font-size: 0.9em; opacity: 0.8;">Don't let anyone trick you into saying this!</p>
        <br>
        <h3>🗡️ Eliminate Target</h3>
        <p>Enter your target's code to eliminate them:</p>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <input type="text" id="assassinationCode" placeholder="Enter target's code" style="flex: 1;" value="${currentInputValue}">
          <button onclick="eliminateTarget()" style="width: auto;">Eliminate</button>
        </div>
      `;
    }
  }
}

/**
 * Update the game finished screen
 * @param {any} gameData 
 */
function updateGameFinishedScreen(gameData) {
  const winner = document.querySelector('#gameFinished .winner');
  if (winner && gameData.winner) {
    const winnerPlayer = gameData.players.find(/** @param {any} p */ (p) => p.id === gameData.winner);
    const isYouWinner = gameData.winner === currentGame.playerId;
    
    winner.innerHTML = `
      <h2>${isYouWinner ? '🎉 You Won!' : '🏆 Game Over'}</h2>
      <p>${isYouWinner ? 'Congratulations! You are the last one standing!' : `${winnerPlayer ? winnerPlayer.name : 'Unknown'} won the game!`}</p>
    `;
  }
}

// Game state polling
/** @type {any} */
let gameStateInterval = null;

/**
 * Start polling for game state updates
 */
function startGameStatePolling() {
  if (gameStateInterval) return; // Already polling
  
  // Poll every 5 seconds instead of 2 seconds to reduce UI disruption
  gameStateInterval = setInterval(fetchGameState, 5000);
  
  // Also fetch immediately
  fetchGameState();
}

/**
 * Stop polling for game state updates
 */
function stopGameStatePolling() {
  if (gameStateInterval) {
    clearInterval(gameStateInterval);
    gameStateInterval = null;
  }
}

/**
 * Copy text to clipboard
 * @param {string} text 
 * @param {Event} event
 */
async function copyToClipboard(text, event) {
  try {
    await navigator.clipboard.writeText(text);
    // Show temporary feedback
    const target = /** @type {HTMLElement} */ (event.target);
    if (target) {
      const originalText = target.textContent;
      target.textContent = 'Copied!';
      setTimeout(() => {
        target.textContent = originalText;
      }, 1000);
    }
  } catch (err) {
    console.error('Failed to copy: ', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Copied to clipboard!');
  }
}

/**
 * Handle URL parameters for direct join links and game state restoration
 */
function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check if we have full game state in URL (returning player)
  if (loadGameStateFromUrl()) {
    return; // Game state loaded, user will be redirected to lobby
  }
  
  // Check for simple join link (new player joining)
  const joinGameId = urlParams.get('join');
  if (joinGameId) {
    // Auto-fill the join game form and show join screen
    const gameIdInput = /** @type {HTMLInputElement} */ (document.getElementById('gameId'));
    if (gameIdInput) {
      gameIdInput.value = joinGameId;
    }
    showScreen('joinGame');
  }
}

/**
 * Join an existing game
 */
async function joinGame() {
  const gameIdInput = /** @type {HTMLInputElement} */ (document.getElementById('gameId'));
  const playerNameInput = /** @type {HTMLInputElement} */ (document.getElementById('playerName'));
  
  if (!gameIdInput || !playerNameInput) {
    alert('Required form elements not found');
    return;
  }
  
  const gameId = gameIdInput.value.trim();
  const playerName = playerNameInput.value.trim();
  
  if (!gameId || !playerName) {
    alert('Please fill in all fields');
    return;
  }
  
  try {
    const response = await fetch('/api/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId: gameId,
        playerName: playerName
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Store game state
      currentGame.id = result.gameId;
      currentGame.playerId = result.playerId;
      currentGame.playerName = playerName;
      currentGame.isHost = false;
      
      // Clear form inputs
      gameIdInput.value = '';
      playerNameInput.value = '';
      
      // Update URL with game state
      updateUrlWithGameState();
      
      // Show game lobby
      showGameLobby();
    } else {
      alert(result.error || 'Failed to join game');
    }
  } catch (error) {
    console.error('Error joining game:', error);
    alert('Failed to join game. Please try again.');
  }
}

/**
 * Update URL with current game state for persistence
 */
function updateUrlWithGameState() {
  if (currentGame.id && currentGame.playerId) {
    const params = new URLSearchParams();
    params.set('gameId', currentGame.id);
    params.set('playerId', currentGame.playerId);
    
    const newUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }
}

/**
 * Load game state from URL parameters
 */
function loadGameStateFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');
  const playerId = urlParams.get('playerId');
  
  if (gameId && playerId) {
    currentGame.id = gameId;
    currentGame.playerId = playerId;
    
    // Fetch player data from server to populate the rest
    fetchGameState().then((gameData) => {
      if (gameData && gameData.success) {
        // Update local state with server data
        const playerData = gameData.game.players?.find(/** @param {any} p */ (p) => p.id === playerId);
        if (playerData) {
          currentGame.playerName = playerData.name;
          currentGame.isHost = gameData.game.isHost;
          
          // Show appropriate screen based on game state
          if (gameData.game.started && !gameData.game.finished) {
            updateGamePlayingScreen(gameData.game);
            showScreen('gamePlaying');
          } else if (gameData.game.finished) {
            updateGameFinishedScreen(gameData.game);
            showScreen('gameFinished');
          } else {
            showGameLobby();
          }
        }
      }
    }).catch(() => {
      // If failed, clear state and show main menu
      clearGameState();
      showScreen('mainMenu');
      alert('Game no longer exists or player is invalid');
    });
    
    return true;
  }
  
  return false;
}

/**
 * Clear current game state and URL
 */
function clearGameState() {
  currentGame.id = null;
  currentGame.playerId = null;
  currentGame.playerName = null;
  currentGame.isHost = false;
  
  // Clear URL parameters
  window.history.replaceState({}, '', window.location.pathname);
}

/**
 * Leave the current game
 */
function leaveGame() {
  // Stop polling
  stopGameStatePolling();
  
  // Clear game state and URL
  clearGameState();
  
  // Return to main menu
  showScreen('mainMenu');
}

/**
 * Start the game (host only)
 */
async function startGame() {
  if (!currentGame.id || !currentGame.playerId || !currentGame.isHost) {
    alert('Only the host can start the game');
    return;
  }
  
  try {
    const response = await fetch('/api/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId: currentGame.id,
        playerId: currentGame.playerId
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Game started successfully, state polling will handle the UI transition
      console.log('Game started successfully');
    } else {
      alert(result.error || 'Failed to start game');
    }
  } catch (error) {
    console.error('Error starting game:', error);
    alert('Failed to start game. Please try again.');
  }
}

// Add a property to track if player elimination has been handled
let playerEliminationHandled = false;

/**
 * Eliminate target using the entered code
 */
async function eliminateTarget() {
  if (!currentGame.id || !currentGame.playerId) {
    alert('Game state is invalid');
    return;
  }
  
  const codeInput = /** @type {HTMLInputElement} */ (document.getElementById('assassinationCode'));
  if (!codeInput) {
    alert('Code input field not found');
    return;
  }
  
  const targetCode = codeInput.value.trim();
  if (!targetCode) {
    alert('Please enter the target\'s code');
    return;
  }
  
  try {
    const response = await fetch('/api/eliminate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId: currentGame.id,
        playerId: currentGame.playerId,
        targetCode: targetCode
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show success message
      codeInput.value = '';
      
      // Show notification of successful elimination
      const notification = document.createElement('div');
      notification.className = 'status';
      notification.innerHTML = `
        <p>🎯 Target eliminated successfully!</p>
        ${result.newTarget ? '<p>You have been assigned a new target.</p>' : ''}
        ${result.gameOver ? '<p>You are the last one standing! Game over.</p>' : ''}
      `;
      
      const gamePlayingScreen = document.getElementById('gamePlaying');
      if (gamePlayingScreen) {
        const firstChild = gamePlayingScreen.firstChild;
        gamePlayingScreen.insertBefore(notification, firstChild);
        
        // Auto-remove notification after 5 seconds
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.5s';
          setTimeout(() => notification.remove(), 500);
        }, 5000);
      }
      
      // Update game state through polling
      fetchGameState();
    } else {
      alert(result.error || 'Failed to eliminate target');
    }
  } catch (error) {
    console.error('Error eliminating target:', error);
    alert('Failed to eliminate target. Please try again.');
  }
}

/**
 * Check if player was eliminated and show death screen if needed
 * @param {any} gameData 
 */
function checkPlayerElimination(gameData) {
  const currentPlayer = gameData.players.find(/** @param {any} p */ (p) => p.id === currentGame.playerId);
  const isPlayerEliminated = currentPlayer && !currentPlayer.alive;
  
  // If player is eliminated and we haven't handled it yet, show death screen
  if (isPlayerEliminated && !playerEliminationHandled) {
    playerEliminationHandled = true;
    
    // Find the most likely killer (one of the alive players)
    // In a real implementation, the server would track this information
    const possibleKiller = gameData.players.find(/** @param {any} p */ (p) => p.alive && p.id !== currentGame.playerId);
    
    showDeathScreen(possibleKiller);
  }
}

/**
 * Show the death screen with information about the player's death
 * @param {any} killer 
 */
function showDeathScreen(killer) {
  const deathScreen = document.getElementById('deathScreen');
  if (!deathScreen) return;
  
  // Hide other screens
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.remove('active');
  });
  
  deathScreen.classList.add('active');
  
  // Show killer information if available
  const killerInfo = deathScreen.querySelector('.killer-info');
  if (killerInfo && killer) {
    killerInfo.innerHTML = `
      <h3>You were eliminated!</h3>
      <p>Your killer was: <strong>${killer.name}</strong></p>
    `;
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Handle URL parameters
  handleUrlParameters();
  
  // Add event listeners for form submission on Enter key
  const creatorNameInput = document.getElementById('creatorName');
  const gameIdInput = document.getElementById('gameId');
  const playerNameInput = document.getElementById('playerName');
  
  // Create game form Enter key handlers
  if (creatorNameInput) {
      creatorNameInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          createGame();
        }
    });
  }
  
  // Join game form Enter key handlers
  if (gameIdInput && playerNameInput) {
    [gameIdInput, playerNameInput].forEach(input => {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          joinGame();
        }
      });
    });
  }
  
  // Add global event listener for the assassinationCode input field
  document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const assassinationCodeInput = document.getElementById('assassinationCode');
      if (document.activeElement === assassinationCodeInput) {
        eliminateTarget();
      }
    }
  });
});

