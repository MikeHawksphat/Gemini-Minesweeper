let isHost;
let connections;
let boardElement;
let minesCountElement;
let timerElement;
let difficultySelect;
let zoomSlider;
let modal;
let modalMessage;
let modalResetButton;
let resetButton;
let difficulties = {
  easy: { ROWS: 8, COLS: 8, MINES: 10 },
  medium: { ROWS: 10, COLS: 10, MINES: 15 },
  hard: { ROWS: 20, COLS: 20, MINES: 60 }, // Made hard mode bigger for co-op
};
let ROWS;
let COLS;
let MINES;
let board;
let minesLocation;
let flagsPlaced;
let timer;
let timeInterval;
let gameOver;
let isFirstClick;
let developerMode = false;

function deepCopyBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function toggleDeveloperMode() {
  developerMode = !developerMode;
  console.log(`Developer Mode: ${developerMode ? 'ON' : 'OFF'}`);
  renderBoard(boardElement, board, ROWS, COLS);
}

function broadcast(data) {
  if (!isHost) return;
  console.log(
    'Broadcasting to:',
    Object.values(connections).map((c) => c.peer),
  );
  Object.values(connections).forEach((conn) => {
    conn.send(data);
  });
}

function init() {
  if (!isHost) return;
  const { R, C, M } = setDifficulty(difficultySelect, difficulties);
  ROWS = R;
  COLS = C;
  MINES = M;
  modal.classList.remove('visible');
  boardElement.classList.remove('won', 'lost');
  isFirstClick = true;
  flagsPlaced = 0;
  board = Array.from({ length: ROWS }, () =>
    Array(COLS)
      .fill(null)
      .map(() => ({ mine: false, revealed: false, flagged: false, count: 0 })),
  );
  minesLocation = [];
  timer = 0;
  gameOver = false;
  renderBoard(boardElement, board, ROWS, COLS); // Render board first
  handleZoom(zoomSlider, boardElement, COLS, ROWS); // Then apply zoom
  minesCountElement.textContent = MINES - flagsPlaced;
  timerElement.textContent = timer;
  if (timeInterval) clearInterval(timeInterval);
  broadcast({ type: 'state', state: getState() });
}

function getState() {
  return {
    rows: ROWS,
    cols: COLS,
    mines: MINES,
    board: board,
    flagsPlaced: flagsPlaced,
    gameOver: gameOver,
    timer: timer,
    isFirstClick: isFirstClick,
  };
}

function processClick(row, col, playerName) {
  if (gameOver) return;
  const cell = board[row][col];
  if (cell.revealed) {
    const flags = getAdjacentCells(row, col).filter((c) => board[c.row][c.col].flagged).length;
    if (flags === cell.count) {
      getAdjacentCells(row, col).forEach((c) => {
        if (!board[c.row][c.col].flagged && !board[c.row][c.col].revealed) {
          processClick(c.row, c.col, playerName);
        }
      });
    }
    return;
  } else if (cell.flagged) {
    return;
  }
  if (isFirstClick) {
    isFirstClick = false;
    placeMines(row, col);
    calculateNumbers();
    const revealed = revealCell(row, col, []); // Reveal the first clicked cell and propagate
    broadcast({ type: 'reveal', cells: revealed }); // Broadcast the revealed cells
    timeInterval = setInterval(() => {
      timer++;
      timerElement.textContent = timer;
      broadcast({ type: 'timer', time: timer });
    }, 1000);
    renderBoard(boardElement, board, ROWS, COLS);
    checkWinCondition(); // Check win condition after first click reveal
    return;
  }
  if (cell.mine) {
    endGame(false, playerName);
  } else {
    const revealed = revealCell(row, col, []);
    broadcast({ type: 'reveal', cells: revealed });
    renderBoard(boardElement, board, ROWS, COLS);
    checkWinCondition();
  }
}

function processFlag(row, col) {
  if (gameOver || isFirstClick) return;
  const cell = board[row][col];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagsPlaced += cell.flagged ? 1 : -1;
  minesCountElement.textContent = MINES - flagsPlaced;
  updateCell(row, col, board, boardElement);
  broadcast({ type: 'flag', row, col, flagged: cell.flagged, flagsPlaced: flagsPlaced });
}

function endGame(win, loserName = 'Someone') {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timeInterval);

  if (!win) {
    minesLocation.forEach(([row, col]) => {
      if (!board[row][col].revealed) board[row][col].revealed = true;
    });
    broadcast({ type: 'state', state: getState() });
    broadcast({ type: 'gameOver', win: false, loserName: loserName });
  } else {
    broadcast({ type: 'gameOver', win: true });
  }

  renderEndGame(win, loserName, modalMessage, boardElement, modal);
}

function placeMines(firstClickRow, firstClickCol) {
  const excludedCells = new Set(
    getAdjacentCells(firstClickRow, firstClickCol).map((c) => `${c.row}-${c.col}`),
  );
  excludedCells.add(`${firstClickRow}-${firstClickCol}`);
  let minesPlacedCount = 0;
  while (minesPlacedCount < MINES) {
    const row = Math.floor(Math.random() * ROWS);
    const col = Math.floor(Math.random() * COLS);
    if (!board[row][col].mine && !excludedCells.has(`${row}-${col}`)) {
      board[row][col].mine = true;
      minesLocation.push([row, col]);
      minesPlacedCount++;
    }
  }
}

function calculateNumbers() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col].mine) continue;
      let count = getAdjacentCells(row, col).filter((c) => board[c.row][c.col].mine).length;
      board[row][col].count = count;
    }
  }
}

function revealCell(row, col, revealed) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return revealed;
  const cell = board[row][col];
  if (cell.revealed || cell.flagged) return revealed;
  cell.revealed = true;
  revealed.push({ row, col, cell });
  if (cell.count === 0 && !cell.mine) {
    getAdjacentCells(row, col).forEach((c) => revealCell(c.row, c.col, revealed));
  }
  return revealed;
}

function checkWinCondition() {
  let revealedCount = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col].revealed && !board[row][col].mine) {
        revealedCount++;
      }
    }
  }
  if (revealedCount === ROWS * COLS - MINES) {
    endGame(true, null);
  }
}

function getAdjacentCells(row, col) {
  const cells = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const newRow = row + i;
      const newCol = col + j;
      if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
        cells.push({ row: newRow, col: newCol });
      }
    }
  }
  return cells;
}
