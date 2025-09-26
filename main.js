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

  let peer;

  hostButton.addEventListener('click', () => {
    const gameId = document.getElementById('create-game-id-input').value.trim();
    if (!gameId) {
      alert('Please enter a Game ID.');
      return;
    }

    isHost = true;
    connections = {};
    peer = new Peer(gameId, { metadata: { username } });

    peer.on('open', (id) => {
      console.log('My Peer ID is: ' + id);
      lobbyContainer.classList.add('hidden');
      gameContainer.classList.remove('hidden');
      startGame();
      displayMessage('System', `Game created with ID: ${id}`);
    });

    peer.on('connection', (conn) => {
      console.log(`Data connection to ${conn.peer} (${conn.metadata.username}) is open.`);
      connections[conn.peer] = conn;
      conn.on('open', () => {
        if (isHost) {
          conn.send({ type: 'state', state: getState() });
        }
        setupConnectionListeners(conn);
        displayMessage('System', `${conn.metadata.username} joined the game.`);
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      displayMessage(
        'System',
        `PeerJS connection error: ${err.message}. Please refresh and try again.`,
      );
      alert(`An error occurred: ${err.message}`);
    });
  });

  joinButton.addEventListener('click', () => {
    const gameId = document.getElementById('join-game-id-input').value.trim();
    if (!gameId) {
      alert('Please enter a Game ID.');
      return;
    }

    isHost = false;
    connections = {};
    peer = new Peer({ metadata: { username } });

    peer.on('open', () => {
      const conn = peer.connect(gameId, { metadata: { username } });

      conn.on('open', () => {
        console.log(`Data connection to ${conn.peer} (${conn.metadata.username}) is open.`);
        connections[conn.peer] = conn;
        lobbyContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        startGame();
        setupConnectionListeners(conn);
        displayMessage('System', `Joined game: ${gameId}`);
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
    zoomSlider.addEventListener('input', () => handleZoom(zoomSlider, boardElement, COLS, ROWS));
    boardElement.addEventListener('click', (e) => handleCellClick(e, username));
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
        username,
      ),
    );

    if (isHost) {
      difficultySelect.addEventListener('change', () => {
        toggleCustomDifficultyInputs(difficultySelect);
        init();
      });
      resetButton.addEventListener('click', () => {
        resetButton.classList.add('spin-animation');
        setTimeout(() => {
          resetButton.classList.remove('spin-animation');
        }, 500); // Match animation duration
        init();
      });
      modalResetButton.addEventListener('click', () => {
        init();
        resetButton.focus(); // Return focus to the main reset button
      });
      boardElement.addEventListener('mouseover', (e) => handleChordPreview(e));
      boardElement.addEventListener('mouseout', () => clearChordPreview());
      // Add event listeners for custom difficulty inputs
      customRowsInput.addEventListener('input', () => init());
      customColsInput.addEventListener('input', () => init());
      customMinesInput.addEventListener('input', () => init());
      init();
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
