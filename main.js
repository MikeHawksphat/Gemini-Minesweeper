document.addEventListener('DOMContentLoaded', () => {
  const lobbyContainer = document.getElementById('lobby-container');
  const gameContainer = document.getElementById('game-container');
  const hostButton = document.getElementById('host-button');
  const joinButton = document.getElementById('join-button');
  const joinIdInput = document.getElementById('join-id-input');
  let usernameInput; // Changed from const to let

  let settingsButton;
  let settingsModal;
  let closeSettingsModal;
  let developerModeToggle;
  let chatMessages;
  let chatInput;
  let sendChatButton;

  getElements(); // Call getElements once at the start

  let username;
  if (usernameInput && usernameInput.value.trim()) {
    username = usernameInput.value.trim();
  } else {
    username = `Player${Math.floor(Math.random() * 1000)}`;
  }

  const peer = new Peer({ metadata: { username } });
  connections = {}; // Use object to map peerId to conn
  isHost = false;

  function generateShortAlias() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  peer.on('open', (id) => {
    console.log('My Peer ID:', id);
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    displayMessage(
      'System',
      `PeerJS connection error: ${err.message}. Please refresh and try again.`,
    );
    alert(`An error occurred: ${err.message}`);
  });

  peer.on('connection', (conn) => {
    conn.on('open', () => {
      console.log(`Data connection to ${conn.peer} (${conn.metadata.username}) is open.`);
      connections[conn.peer] = conn;
      if (isHost) {
        conn.send({ type: 'state', state: getState() });
      } else {
        // Guest stores the mapping for future use, but the host should send the alias
        // For now, keep prompt, but ideally host sends it.
        const shortAlias = prompt('Please enter the short alias provided by the host:');
        if (shortAlias) {
          localStorage.setItem(shortAlias, conn.peer);
        }
      }
      setupConnectionListeners(conn);
      displayMessage('System', `${conn.metadata.username} joined the game.`);
    });

    conn.on('close', () => {
      console.log(`Connection to ${conn.peer} has closed.`);
      displayMessage('System', `${connections[conn.peer].metadata.username} left the game.`);
      delete connections[conn.peer];
    });
  });

  hostButton.addEventListener('click', () => {
    isHost = true;
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    const shortAlias = generateShortAlias();
    localStorage.setItem(shortAlias, peer.id);
    startGame();
    displayMessage('System', `You are the host. Share your ID: ${peer.id} (Alias: ${shortAlias})`);
  });

  joinButton.addEventListener('click', () => {
    let hostId = joinIdInput.value.trim();
    const mappedId = localStorage.getItem(hostId);
    if (mappedId) {
      hostId = mappedId;
    }
    localStorage.setItem('lastHostId', hostId);
    if (!hostId) {
      alert('Please enter a Host ID.');
      return;
    }
    isHost = false;
    const conn = peer.connect(hostId, { metadata: { username } });
    conn.on('open', () => {
      connections[conn.peer] = conn;
      lobbyContainer.classList.add('hidden');
      gameContainer.classList.remove('hidden');
      startGame();
      setupConnectionListeners(conn);
      displayMessage('System', `Joined host: ${hostId}`);
    });
    conn.on('error', (err) => {
      console.error(err);
      displayMessage(
        'System',
        `Connection to host failed: ${err.message}. Please ensure the host has started their game.`,
      );
      alert('Connection failed.');
    });
  });

  settingsButton.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    settingsModal.setAttribute('aria-hidden', 'false');
    developerModeToggle.checked = developerMode;
  });

  closeSettingsModal.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    settingsModal.setAttribute('aria-hidden', 'true');
  });

  developerModeToggle.addEventListener('change', () => {
    toggleDeveloperMode();
  });

  sendChatButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
      console.log('main.js: Sending chat message:', message, 'from user:', username);
      displayMessage(username, message);
      window.sendChatMessage(message, username); // Use globally accessible function and pass username
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatButton.click();
    }
  });

  function displayMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to bottom
  }

  window.displayMessage = displayMessage; // Make it globally accessible

  function getElements() {
    boardElement = document.getElementById('game-board');
    minesCountElement = document.getElementById('mines-count');
    timerElement = document.getElementById('timer');
    resetButton = document.getElementById('reset-button');
    difficultySelect = document.getElementById('difficulty');
    zoomSlider = document.getElementById('zoom-slider');
    modal = document.getElementById('modal');
    modalMessage = document.getElementById('modal-message');
    modalResetButton = document.getElementById('modal-reset-button');
    settingsButton = document.getElementById('settings-button');
    settingsModal = document.getElementById('settings-modal');
    closeSettingsModal = document.getElementById('close-settings-modal');
    developerModeToggle = document.getElementById('developer-mode-toggle');
    chatMessages = document.getElementById('chat-messages');
    chatInput = document.getElementById('chat-input');
    sendChatButton = document.getElementById('send-chat-button');
    usernameInput = document.getElementById('username-input');
    // New custom difficulty elements
    customDifficultyInputsDiv = settingsModal.querySelector('#custom-difficulty-inputs');
    customRowsInput = settingsModal.querySelector('#custom-rows');
    customColsInput = settingsModal.querySelector('#custom-cols');
    customMinesInput = settingsModal.querySelector('#custom-mines');
  }

  function startGame() {
    difficulties = {
      easy: { ROWS: 8, COLS: 8, MINES: 10 },
      medium: { ROWS: 10, COLS: 10, MINES: 15 },
      hard: { ROWS: 20, COLS: 20, MINES: 60 }, // Made hard mode bigger for co-op
    };

    zoomSlider.addEventListener('input', () => handleZoom(zoomSlider, boardElement, COLS, ROWS));
    boardElement.addEventListener('click', (e) => handleCellClick(e));
    boardElement.addEventListener('contextmenu', (e) => handleCellRightClick(e));
    boardElement.addEventListener('keydown', (e) =>
      handleKeyboardNavigation(
        e,
        boardElement,
        ROWS,
        COLS,
        processClick,
        processFlag,
        isHost,
        connections,
      ),
    );

    if (isHost) {
      difficultySelect.addEventListener('change', () => {
        toggleCustomDifficultyInputs(difficultySelect);
        init(true);
      });
      resetButton.addEventListener('click', () => {
        resetButton.classList.add('spin-animation');
        setTimeout(() => {
          resetButton.classList.remove('spin-animation');
        }, 500); // Match animation duration
        init(true);
      });
      modalResetButton.addEventListener('click', () => {
        init(true);
        resetButton.focus(); // Return focus to the main reset button
      });
      boardElement.addEventListener('mouseover', (e) => handleChordPreview(e));
      boardElement.addEventListener('mouseout', () => clearChordPreview());
      // Add event listeners for custom difficulty inputs
      customRowsInput.addEventListener('input', () => init(true));
      customColsInput.addEventListener('input', () => init(true));
      customMinesInput.addEventListener('input', () => init(true));
      init(false);
    }

    toggleCustomDifficultyInputs(difficultySelect); // Call on initial load

    if (!isHost) {
      boardElement.innerHTML =
        '<h2 style="color: white; text-align: center;">Connected! Waiting for host to sync game...</h2>';
      document.querySelector('.header__section--center').style.visibility = 'hidden';
      document.querySelector('.header__section--right .difficulty-selector').style.visibility =
        'hidden';
    }
  }
});
