function handleZoom(zoomSlider, boardElement, COLS, ROWS) {
  const cellSize = zoomSlider.value;
  document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
  boardElement.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
  boardElement.style.gridTemplateRows = `repeat(${ROWS}, var(--cell-size))`;
  zoomSlider.setAttribute('aria-valuenow', cellSize);
  zoomSlider.setAttribute('aria-valuetext', `Zoom level ${cellSize}`);
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
    const playAgainButton = document.getElementById('modal-reset-button');
    if (playAgainButton) {
      playAgainButton.focus();
    }
  }, modalDelay);
}

function updateCell(row, col, board, boardElement) {
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
}

function toggleCustomDifficultyInputs(difficultySelect) {
  const customInputsDiv = document.getElementById('custom-difficulty-inputs');
  if (difficultySelect.value === 'custom') {
    customInputsDiv.classList.remove('hidden');
  } else {
    customInputsDiv.classList.add('hidden');
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

window.handleZoom = handleZoom;
window.renderBoard = renderBoard;
window.renderEndGame = renderEndGame;
window.updateCell = updateCell;
window.getCell = getCell;
window.handleChordPreview = handleChordPreview;
window.clearChordPreview = clearChordPreview;
window.handleCellRightClick = handleCellRightClick;
window.handleKeyboardNavigation = handleKeyboardNavigation;
window.setDifficulty = setDifficulty;
window.toggleCustomDifficultyInputs = toggleCustomDifficultyInputs;
window.loadState = loadState;
window.handleCellClick = handleCellClick;


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
