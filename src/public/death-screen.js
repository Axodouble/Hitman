// Death screen functionality

/**
 * Show the death screen when player is eliminated
 * @param {any} killerData Information about the player who eliminated the current player
 */
function showDeathScreen(killerData) {
  // Populate killer info if available
  const killerInfo = document.getElementById('killerInfo');
  if (killerInfo) {
    if (killerData && killerData.name) {
      killerInfo.innerHTML = `
        <h3>Your assassin was:</h3>
        <p>${killerData.name}</p>
      `;
    } else {
      killerInfo.innerHTML = `
        <p>Your assassin's identity remains a mystery...</p>
      `;
    }
  }
  
  // Show the death screen
  showScreen('deathScreen');
}

/**
 * Return to the game as a spectator
 */
function returnToGameAsSpectator() {
  showScreen('gamePlaying');
  
  // Update UI to indicate spectator mode
  const targetInfo = document.querySelector('#gamePlaying #targetInfo');
  if (targetInfo) {
    targetInfo.innerHTML = `
      <h3>👁️ Spectator Mode</h3>
      <p>You've been eliminated, but you can still watch the game unfold.</p>
    `;
  }
  
  // Hide code input section for spectators
  const codeInput = document.querySelector('#gamePlaying .code-input');
  if (codeInput) {
    codeInput.style.display = 'none';
  }
}

// Modify the updateGamePlayingScreen function to check for player elimination
const originalUpdateGamePlayingScreen = updateGamePlayingScreen;
updateGamePlayingScreen = function(gameData) {
  // Check if player is eliminated
  const currentPlayer = gameData.players.find(/** @param {any} p */ (p) => p.id === currentGame.playerId);
  const isPlayerEliminated = currentPlayer && !currentPlayer.alive;
  
  // Call the original function
  originalUpdateGamePlayingScreen(gameData);
  
  // If player is eliminated, update UI accordingly
  if (isPlayerEliminated) {
    // If this is the first time detecting elimination, show death screen
    if (!window.playerEliminatedShown) {
      window.playerEliminatedShown = true;
      
      // Find the killer (any player whose target is this player)
      const killer = gameData.players.find(/** @param {any} p */ (p) => 
        p.alive && gameData.players.find(/** @param {any} tp */ (tp) => 
          tp.id === currentGame.playerId && !tp.alive
        )
      );
      
      showDeathScreen(killer);
      return; // Don't proceed with normal UI updates
    }
    
    // For subsequent updates after player has seen death screen
    const targetInfo = document.querySelector('#gamePlaying #targetInfo');
    if (targetInfo) {
      targetInfo.innerHTML = `
        <h3>👁️ Spectator Mode</h3>
        <p>You've been eliminated, but you can still watch the game unfold.</p>
      `;
    }
    
    // Hide code input section for spectators
    const codeInput = document.querySelector('#gamePlaying .code-input');
    if (codeInput) {
      codeInput.style.display = 'none';
    }
  }
};
