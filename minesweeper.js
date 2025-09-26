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

function findGuessingCells(boardState, ROWS, COLS) {
  const guessingCells = new Set();
  let changed = true;

  // Create a deep copy of the board for internal deduction simulation
  const simulationBoard = deepCopyBoard(boardState);

  // Mark all currently revealed cells as 'revealed' in the simulation board
  // This is crucial for the solver to start with the known state
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (boardState[r][c].revealed) {
        simulationBoard[r][c].revealed = true;
      }
      if (boardState[r][c].flagged) {
        simulationBoard[r][c].flagged = true;
      }
    }
  }

  // Iteratively apply deductions
  while (changed) {
    changed = false;

    // Rule 1 & 2 (Basic Deductions)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = simulationBoard[r][c];
        if (cell.revealed && cell.count > 0) {
          // Only apply rules to revealed numbered cells
          const adjacent = getAdjacentCells(r, c);
          let unrevealedUnflaggedNeighbors = [];
          let flaggedNeighborsCount = 0;

          adjacent.forEach((n) => {
            const neighbor = simulationBoard[n.row][n.col];
            if (!neighbor.revealed && !neighbor.flagged) {
              unrevealedUnflaggedNeighbors.push(n);
            }
            if (neighbor.flagged) {
              flaggedNeighborsCount++;
            }
          });

          // Rule 1: If (cell.count - flaggedNeighborsCount) == unrevealedUnflaggedNeighbors.length,
          // then all unrevealedUnflaggedNeighbors must be mines.
          if (
            cell.count - flaggedNeighborsCount === unrevealedUnflaggedNeighbors.length &&
            unrevealedUnflaggedNeighbors.length > 0
          ) {
            unrevealedUnflaggedNeighbors.forEach((n) => {
              const neighbor = simulationBoard[n.row][n.col];
              if (!neighbor.flagged) {
                // Only flag if not already flagged
                neighbor.flagged = true;
                changed = true;
              }
            });
          }

          // Rule 2: If cell.count == flaggedNeighborsCount,
          // then all unrevealedUnflaggedNeighbors must be safe.
          if (cell.count === flaggedNeighborsCount && unrevealedUnflaggedNeighbors.length > 0) {
            unrevealedUnflaggedNeighbors.forEach((n) => {
              const neighbor = simulationBoard[n.row][n.col];
              if (!neighbor.revealed && !neighbor.flagged) {
                // Only reveal if not already revealed or flagged
                neighbor.revealed = true; // Mark as revealed for deduction purposes
                changed = true;
              }
            });
          }
        }
      }
    }

    // Subset Rule
    for (let r1 = 0; r1 < ROWS; r1++) {
      for (let c1 = 0; c1 < COLS; c1++) {
        const cell1 = simulationBoard[r1][c1];
        if (cell1.revealed && cell1.count > 0) {
          const neighbors1 = getAdjacentCells(r1, c1);
          const unrevealedUnflagged1 = neighbors1.filter(
            (n) =>
              !simulationBoard[n.row][n.col].revealed && !simulationBoard[n.row][n.col].flagged,
          );
          const flaggedCount1 = neighbors1.filter(
            (n) => simulationBoard[n.row][n.col].flagged,
          ).length;

          for (const { row: r2, col: c2 } of neighbors1) {
            // Check adjacent revealed cells
            const cell2 = simulationBoard[r2][c2];
            // Ensure cell2 is also revealed, numbered, and not the same cell as cell1
            if (cell2.revealed && cell2.count > 0 && !(r1 === r2 && c1 === c2)) {
              const neighbors2 = getAdjacentCells(r2, c2);
              const unrevealedUnflagged2 = neighbors2.filter(
                (n) =>
                  !simulationBoard[n.row][n.col].revealed && !simulationBoard[n.row][n.col].flagged,
              );
              const flaggedCount2 = neighbors2.filter(
                (n) => simulationBoard[n.row][n.col].flagged,
              ).length;

              const set1 = new Set(unrevealedUnflagged1.map((n) => `${n.row}-${n.col}`));
              const set2 = new Set(unrevealedUnflagged2.map((n) => `${n.row}-${n.col}`));

              // Check if set1 is a proper subset of set2
              const isSubset1of2 = [...set1].every((val) => set2.has(val));
              if (isSubset1of2 && set1.size < set2.size) {
                const minesRemaining1 = cell1.count - flaggedCount1;
                const minesRemaining2 = cell2.count - flaggedCount2;

                if (minesRemaining1 === minesRemaining2) {
                  // All cells in U2 but not in U1 are safe
                  const diff = unrevealedUnflagged2.filter((n) => !set1.has(`${n.row}-${n.col}`));
                  diff.forEach((n) => {
                    const neighbor = simulationBoard[n.row][n.col];
                    if (!neighbor.revealed) {
                      neighbor.revealed = true;
                      changed = true;
                    }
                  });
                } else if (minesRemaining2 - minesRemaining1 === set2.size - set1.size) {
                  // All cells in U2 but not in U1 are mines
                  const diff = unrevealedUnflagged2.filter((n) => !set1.has(`${n.row}-${n.col}`));
                  diff.forEach((n) => {
                    const neighbor = simulationBoard[n.row][n.col];
                    if (!neighbor.flagged) {
                      neighbor.flagged = true;
                      changed = true;
                    }
                  });
                }
              }

              // Check if set2 is a proper subset of set1
              const isSubset2of1 = [...set2].every((val) => set1.has(val));
              if (isSubset2of1 && set2.size < set1.size) {
                const minesRemaining1 = cell1.count - flaggedCount1;
                const minesRemaining2 = cell2.count - flaggedCount2;

                if (minesRemaining2 === minesRemaining1) {
                  // All cells in U1 but not in U2 are safe
                  const diff = unrevealedUnflagged1.filter((n) => !set2.has(`${n.row}-${n.col}`));
                  diff.forEach((n) => {
                    const neighbor = simulationBoard[n.row][n.col];
                    if (!neighbor.revealed) {
                      neighbor.revealed = true;
                      changed = true;
                    }
                  });
                } else if (minesRemaining1 - minesRemaining2 === set1.size - set2.size) {
                  // All cells in U1 but not in U2 are mines
                  const diff = unrevealedUnflagged1.filter((n) => !set2.has(`${n.row}-${n.col}`));
                  diff.forEach((n) => {
                    const neighbor = simulationBoard[n.row][n.col];
                    if (!neighbor.flagged) {
                      neighbor.flagged = true;
                      changed = true;
                    }
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // After all deductions, any remaining unrevealed, unflagged, non-mine cells are guessing cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = simulationBoard[r][c];
      if (!cell.revealed && !cell.flagged && !cell.mine) {
        guessingCells.add(`${r}-${c}`);
      }
    }
  }

  return Array.from(guessingCells).map((coord) => {
    const [r, c] = coord.split('-').map(Number);
    return { row: r, col: c };
  });
}
