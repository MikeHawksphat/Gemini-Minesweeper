window.handleZoom = function (zoomSlider, boardElement, COLS, ROWS) {
  const cellSize = zoomSlider.value;
  document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
  boardElement.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
  boardElement.style.gridTemplateRows = `repeat(${ROWS}, var(--cell-size))`;
  zoomSlider.setAttribute('aria-valuenow', cellSize);
  zoomSlider.setAttribute('aria-valuetext', `Zoom level ${cellSize}`);
};

window.renderBoard = function (boardElement, board, ROWS, COLS) {
  boardElement.innerHTML = '';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellData = board[row][col];
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0'); // Make cells focusable
      cell.setAttribute('aria-label', `Cell row ${row + 1}, column ${col + 1}, unrevealed`);

      const cellInner = document.createElement('div');
      cellInner.classList.add('cell-inner');
      const cellFront = document.createElement('div');
      cellFront.classList.add('cell-front');
      const cellBack = document.createElement('div');
      cellBack.classList.add('cell-back');

      if (cellData.revealed) {
        cell.classList.add('revealed');
        let revealedAriaLabel = `Cell row ${row + 1}, column ${col + 1}`;
        if (cellData.mine) {
          revealedAriaLabel += ', mine revealed';
        } else if (cellData.count > 0) {
          revealedAriaLabel += `, revealed, ${cellData.count} mines nearby`;
        } else {
          revealedAriaLabel += ', revealed, no mines nearby';
        }
        cell.setAttribute('aria-label', revealedAriaLabel);

        if (cellData.mine) {
          cell.classList.add('mine');
          cellBack.innerHTML = '<i class="fas fa-bomb"></i>';
        } else if (cellData.count > 0) {
          cellBack.textContent = cellData.count;
          cellBack.classList.add('c' + cellData.count);
        }
      } else if (cellData.flagged) {
        cell.classList.add('flagged');
        cell.setAttribute('aria-label', `Cell row ${row + 1}, column ${col + 1}, flagged`);
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
    guessingCells.forEach((gCell) => {
      const cellElement = boardElement.querySelector(
        `[data-row="${gCell.row}"][data-col="${gCell.col}"]`,
      );
      if (cellElement) {
        cellElement.classList.add('developer-guess');
      }
    });
  }
};

window.renderEndGame = function (win, loserName, modalMessage, boardElement, modal) {
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
    const playAgainButton = document.getElementById('modal-reset-button');
    if (playAgainButton) {
      playAgainButton.focus();
    }
  }, modalDelay);
};

window.updateCell = function (row, col, board, boardElement) {
  const cellElement = boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (!cellElement) return;
  const cellData = board[row][col];
  const cellFront = cellElement.querySelector('.cell-front');
  cellElement.classList.toggle('flagged', cellData.flagged);
  let newAriaLabel = `Cell row ${row + 1}, column ${col + 1}`;
  if (cellData.revealed) {
    if (cellData.mine) {
      newAriaLabel += ', mine revealed';
    } else if (cellData.count > 0) {
      newAriaLabel += `, revealed, ${cellData.count} mines nearby`;
    } else {
      newAriaLabel += ', revealed, no mines nearby';
    }
  } else if (cellData.flagged) {
    newAriaLabel += ', flagged';
  } else {
    newAriaLabel += ', unrevealed';
  }
  cellElement.setAttribute('aria-label', newAriaLabel);

  if (cellData.flagged) {
    cellFront.innerHTML = '<i class="fas fa-flag"></i>';
  } else {
    cellFront.innerHTML = '';
  }
};

window.getCell = function (row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
  return board[row][col];
};

window.handleChordPreview = function (e) {
  const cellElement = e.target.closest('.cell');
  if (!cellElement) return;
  const row = parseInt(cellElement.dataset.row);
  const col = parseInt(cellElement.dataset.col);
  const cell = getCell(row, col);
  if (cell && cell.revealed && cell.count > 0) {
    const adjacentCells = getAdjacentCells(row, col);
    const flags = adjacentCells.filter((c) => getCell(c.row, c.col).flagged).length;
    if (flags === cell.count) {
      adjacentCells.forEach((c) => {
        const adjCell = getCell(c.row, c.col);
        if (adjCell && !adjCell.flagged && !adjCell.revealed) {
          boardElement
            .querySelector(`[data-row="${c.row}"][data-col="${c.col}"]`)
            .classList.add('preview');
        }
      });
    }
  }
};

window.clearChordPreview = function () {
  const previewCells = document.querySelectorAll('.preview');
  previewCells.forEach((cell) => cell.classList.remove('preview'));
};

window.handleCellRightClick = function (e) {
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
};

window.handleKeyboardNavigation = function (
  e,
  boardElement,
  ROWS,
  COLS,
  processClick,
  processFlag,
  isHost,
  connections,
  username,
  peer,
) {
  const activeElement = document.activeElement;
  let currentRow = -1;
  let currentCol = -1;

  if (activeElement && activeElement.classList.contains('cell')) {
    currentRow = parseInt(activeElement.dataset.row);
    currentCol = parseInt(activeElement.dataset.col);
  }

  let nextRow = currentRow;
  let nextCol = currentCol;

  switch (e.key) {
    case 'ArrowUp':
      nextRow = Math.max(0, currentRow - 1);
      break;
    case 'ArrowDown':
      nextRow = Math.min(ROWS - 1, currentRow + 1);
      break;
    case 'ArrowLeft':
      nextCol = Math.max(0, currentCol - 1);
      break;
    case 'ArrowRight':
      nextCol = Math.min(COLS - 1, currentCol + 1);
      break;
    case 'Enter':
    case ' ': // Spacebar
      if (currentRow !== -1 && currentCol !== -1) {
        e.preventDefault(); // Prevent scrolling
        if (isHost) {
          processClick(currentRow, currentCol, username, peer);
        } else {
          Object.values(connections)[0].send({ type: 'click', row: currentRow, col: currentCol });
        }
      }
      return;
    case 'f': // Flag/unflag with 'f' key
    case 'F':
      if (currentRow !== -1 && currentCol !== -1) {
        e.preventDefault();
        if (isHost) {
          processFlag(currentRow, currentCol);
        } else {
          Object.values(connections)[0].send({ type: 'flag', row: currentRow, col: currentCol });
        }
      }
      return;
    default:
      return;
  }

  if (nextRow !== currentRow || nextCol !== currentCol) {
    e.preventDefault(); // Prevent scrolling
    const nextCell = boardElement.querySelector(`[data-row="${nextRow}"][data-col="${nextCol}"]`);
    if (nextCell) {
      nextCell.focus();
    }
  }
};

window.setDifficulty = function (difficultySelect, difficulties) {
  const level = difficultySelect.value;
  if (level === 'custom') {
    const customRows = parseInt(document.getElementById('custom-rows').value);
    const customCols = parseInt(document.getElementById('custom-cols').value);
    const customMines = parseInt(document.getElementById('custom-mines').value);

    // Basic validation
    if (isNaN(customRows) || customRows < 5 || customRows > 50) return { R: 10, C: 10, M: 15 };
    if (isNaN(customCols) || customCols < 5 || customCols > 50) return { R: 10, C: 10, M: 15 };
    if (isNaN(customMines) || customMines < 1 || customMines >= customRows * customCols)
      return { R: 10, C: 10, M: 15 };

    return { R: customRows, C: customCols, M: customMines };
  } else {
    const config = difficulties[level];
    return { R: config.ROWS, C: config.COLS, M: config.MINES };
  }
};

window.toggleCustomDifficultyInputs = function (difficultySelect) {
  const customInputsDiv = document.getElementById('custom-difficulty-inputs');
  if (difficultySelect.value === 'custom') {
    customInputsDiv.classList.remove('hidden');
  } else {
    customInputsDiv.classList.add('hidden');
  }
};

window.loadState = function (state) {
  ROWS = state.rows;
  COLS = state.cols;
  MINES = state.mines;
  board = state.board;
  flagsPlaced = state.flagsPlaced;
  gameOver = state.gameOver;
  timer = state.timer;
  isFirstClick = state.isFirstClick;

  if (state.shortAlias) {
    localStorage.setItem(state.shortAlias, state.peerId);
  }

  // Make UI visible for guest
  document.querySelector('.header__section--center').style.visibility = 'visible';
  document.querySelector('.header__section--right .difficulty-selector').style.visibility =
    'visible';

  minesCountElement.textContent = MINES - flagsPlaced;
  timerElement.textContent = timer;
  handleZoom(zoomSlider, boardElement, COLS, ROWS);
  renderBoard(boardElement, board, ROWS, COLS);
};

window.handleCellClick = function (e, username, peer) {
  const cellElement = e.target.closest('.cell');
  if (!cellElement) return;
  const row = parseInt(cellElement.dataset.row);
  const col = parseInt(cellElement.dataset.col);
  if (isHost) {
    processClick(row, col, username, peer); // Host clicks are processed with a default name
  } else {
    Object.values(connections)[0].send({ type: 'click', row, col });
  }
};
