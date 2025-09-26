function setupConnectionListeners(conn, peer) {
  conn.on('data', (data) => {
    console.log('conn.on(data): Received data:', data, 'from peer:', conn.peer);
    if (data.type === 'chat') {
      console.log(
        'conn.on(data): Processing chat message from:',
        data.senderUsername,
        'message:',
        data.message,
      );
      window.displayMessage(data.senderUsername, data.message);
      return; // Process chat and then return, as it's a standalone message type
    }

    // Now handle game state updates, which depend on whether it's a host or guest
    if (isHost) {
      const playerName = conn.metadata.username;
      if (data.type === 'click') {
        processClick(data.row, data.col, playerName, peer);
      } else if (data.type === 'flag') {
        processFlag(data.row, data.col);
      }
    } else {
      // This client is a guest
      if (data.type === 'state') {
        window.loadState(data.state);
      } else if (data.type === 'reveal') {
        data.cells.forEach(({ row, col, cell }) => {
          board[row][col] = cell;
        });
        renderBoard(boardElement, board, ROWS, COLS);
      } else if (data.type === 'flag') {
        board[data.row][data.col].flagged = data.flagged;
        flagsPlaced = data.flagsPlaced;
        minesCountElement.textContent = MINES - flagsPlaced;
        updateCell(data.row, data.col, board, boardElement);
      } else if (data.type === 'timer') {
        timer = data.time;
        timerElement.textContent = data.time;
      } else if (data.type === 'gameOver') {
        gameOver = true;
        renderEndGame(data.win, data.loserName, modalMessage, boardElement, modal);
      }
    }
  });
}

// Make sendChatMessage globally accessible
window.sendChatMessage = function (message, senderUsername) {
  console.log(
    'sendChatMessage: Attempting to send message:',
    message,
    'from user:',
    senderUsername,
  );
  console.log(
    'sendChatMessage: Current connections:',
    Object.values(connections).map((c) => c.peer),
  );
  Object.values(connections).forEach((conn) => {
    conn.send({ type: 'chat', message: message, senderUsername: senderUsername }); // Include senderUsername
  });
};
