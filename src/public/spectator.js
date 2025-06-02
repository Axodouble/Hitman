/**
 * Return to the game as a spectator after being eliminated
 */
function returnToGameAsSpectator() {
  // Set the spectator flag
  playerEliminationHandled = true;
  
  // Show the game playing screen
  showScreen('gamePlaying');
  
  // Fetch the latest game state
  fetchGameState();
}
