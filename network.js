function setupConnectionListeners(conn) {
    conn.on('data', data => {
        if (isHost) {
            const playerName = conn.metadata.username;
            if (data.type === 'click') {
                processClick(data.row, data.col, playerName);
            } else if (data.type === 'flag') {
                processFlag(data.row, data.col);
            }
        } else {
            if (data.type === 'state') {
                loadState(data.state);
            } else if (data.type === 'reveal') {
                data.cells.forEach(({ row, col, cell }) => { board[row][col] = cell; });
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
