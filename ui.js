function handleZoom(zoomSlider, boardElement, COLS, ROWS) {
    const cellSize = zoomSlider.value;
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    boardElement.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
    boardElement.style.gridTemplateRows = `repeat(${ROWS}, var(--cell-size))`;
}

function renderBoard(boardElement, board, ROWS, COLS) {
    boardElement.innerHTML = '';
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cellData = board[row][col];
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            if (developerMode) {
                if (cellData.mine) {
                    cell.classList.add('developer-mine');
                }
            }
            const cellInner = document.createElement('div');
            cellInner.classList.add('cell-inner');
            const cellFront = document.createElement('div');
            cellFront.classList.add('cell-front');
            const cellBack = document.createElement('div');
            cellBack.classList.add('cell-back');

            // Apply guessing scenario highlight after all cells are created
            // This needs to be done after the board is fully rendered or in a separate pass
            // For now, we'll collect them and apply after the loop
            // This is a temporary placeholder, the actual application will be outside the loop
            // and will require a global list of guessing cells from minesweeper.js

            if (cellData.revealed) {
                cell.classList.add('revealed');
                if (cellData.mine) {
                    cell.classList.add('mine');
                    cellBack.innerHTML = '<i class="fas fa-bomb"></i>';
                } else if (cellData.count > 0) {
                    cellBack.textContent = cellData.count;
                    cellBack.classList.add('c' + cellData.count);
                }
            } else if (cellData.flagged) {
                cell.classList.add('flagged');
                cellFront.innerHTML = '<i class="fas fa-flag"></i>';
            }
            cellInner.appendChild(cellFront);
            cellInner.appendChild(cellBack);
            cell.appendChild(cellInner);
            boardElement.appendChild(cell);
        }
    }

    // After all cells are created, apply guessing scenario highlights if developerMode is on
    if (developerMode) {
        const guessingCells = findGuessingCells(board, ROWS, COLS);
        guessingCells.forEach(gCell => {
            const cellElement = boardElement.querySelector(`[data-row="${gCell.row}"][data-col="${gCell.col}"]`);
            if (cellElement) {
                cellElement.classList.add('developer-guess');
            }
        });
    }
}

function renderEndGame(win, loserName, modalMessage, boardElement, modal) {
    let modalDelay = 1500;
    if (win) {
        modalMessage.textContent = 'You Win!';
        boardElement.classList.add('won');
    } else {
        modalMessage.textContent = `${loserName} clicked a mine! Game Over.`;
        boardElement.classList.add('lost');
        renderBoard(boardElement, board, ROWS, COLS);
    }
    setTimeout(() => {
        modal.classList.add('visible');
    }, modalDelay);
}

function updateCell(row, col, board, boardElement) {
    const cellElement = boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cellElement) return;
    const cellData = board[row][col];
    const cellFront = cellElement.querySelector('.cell-front');
    cellElement.classList.toggle('flagged', cellData.flagged);
    if (cellData.flagged) {
        cellFront.innerHTML = '<i class="fas fa-flag"></i>';
    } else {
        cellFront.innerHTML = '';
    }
}

function getCell(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return board[row][col];
}

function handleChordPreview(e) {
    const cellElement = e.target.closest('.cell');
    if (!cellElement) return;
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);
    const cell = getCell(row, col);
    if (cell && cell.revealed && cell.count > 0) {
        const adjacentCells = getAdjacentCells(row, col);
        const flags = adjacentCells.filter(c => getCell(c.row, c.col).flagged).length;
        if (flags === cell.count) {
            adjacentCells.forEach(c => {
                const adjCell = getCell(c.row, c.col);
                if (adjCell && !adjCell.flagged && !adjCell.revealed) {
                    boardElement.querySelector(`[data-row="${c.row}"][data-col="${c.col}"]`).classList.add('preview');
                }
            });
        }
    }
}

function clearChordPreview() {
    const previewCells = document.querySelectorAll('.preview');
    previewCells.forEach(cell => cell.classList.remove('preview'));
}

function setDifficulty(difficultySelect, difficulties) {
    const level = difficultySelect.value;
    const config = difficulties[level];
    return { R: config.ROWS, C: config.COLS, M: config.MINES };
}

function loadState(state) {
    ROWS = state.rows;
    COLS = state.cols;
    MINES = state.mines;
    board = state.board;
    flagsPlaced = state.flagsPlaced;
    gameOver = state.gameOver;
    timer = state.timer;
    isFirstClick = state.isFirstClick;

    // Make UI visible for guest
    document.querySelector('.header__section--center').style.visibility = 'visible';
    document.querySelector('.header__section--right .difficulty-selector').style.visibility = 'visible';

    minesCountElement.textContent = MINES - flagsPlaced;
    timerElement.textContent = timer;
    handleZoom(zoomSlider, boardElement, COLS, ROWS);
    renderBoard(boardElement, board, ROWS, COLS);
}

function handleCellClick(e) {
    const cellElement = e.target.closest('.cell');
    if (!cellElement) return;
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);
    if (isHost) {
        processClick(row, col, 'Host'); // Host clicks are processed with a default name
    } else {
        Object.values(connections)[0].send({ type: 'click', row, col });
    }
}

function handleCellRightClick(e) {
    e.preventDefault();
    const cellElement = e.target.closest('.cell');
    if (!cellElement) return;
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);
    if (isHost) {
        processFlag(row, col);
    } else {
        Object.values(connections)[0].send({ type: 'flag', row, col });
    }
}