document.addEventListener('DOMContentLoaded', () => {
    const lobbyContainer = document.getElementById('lobby-container');
    const gameContainer = document.getElementById('game-container');
    const hostButton = document.getElementById('host-button');
    const joinButton = document.getElementById('join-button');
    const myPeerIdDisplay = document.getElementById('my-peer-id');
    const joinIdInput = document.getElementById('join-id-input');
    const copyIdButton = document.getElementById('copy-id-button');

    let myShortIdDisplay;
    let settingsButton;
    let settingsModal;
    let closeSettingsModal;
    let developerModeToggle;

    getElements();

    const username = `Player${Math.floor(Math.random() * 1000)}`;
    const peer = new Peer({ metadata: { username } });
    connections = {}; // Use object to map peerId to conn
    isHost = false;

    peer.on('open', id => {
        myPeerIdDisplay.textContent = id;
        const shortAlias = generateShortAlias();
        myShortIdDisplay.textContent = shortAlias;
        localStorage.setItem(shortAlias, id);
    });

    function generateShortAlias() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    peer.on('error', err => {
        console.error('PeerJS error:', err);
        alert(`An error occurred: ${err.message}`);
    });

    peer.on('connection', conn => {
        conn.on('open', () => {
            console.log(`Data connection to ${conn.peer} (${conn.metadata.username}) is open.`);
            connections[conn.peer] = conn;
            if (isHost) {
                conn.send({ type: 'state', state: getState() });
            } else {
                const shortAlias = prompt("Please enter the short alias provided by the host:");
                if (shortAlias) {
                    localStorage.setItem(shortAlias, conn.peer);
                }
            }
            setupConnectionListeners(conn);
        });

        conn.on('close', () => {
            console.log(`Connection to ${conn.peer} has closed.`);
            delete connections[conn.peer];
        });
    });

    hostButton.addEventListener('click', () => {
        isHost = true;
        lobbyContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        startGame();
    });

    joinButton.addEventListener('click', () => {
        let hostId = joinIdInput.value.trim();
        const mappedId = localStorage.getItem(hostId);
        if (mappedId) {
            hostId = mappedId;
        }
        localStorage.setItem('lastHostId', hostId);
        if (!hostId) { alert('Please enter a Host ID.'); return; }
        isHost = false;
        const conn = peer.connect(hostId, { metadata: { username } });
        conn.on('open', () => {
            connections[conn.peer] = conn;
            lobbyContainer.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            startGame();
            setupConnectionListeners(conn);
        });
        conn.on('error', err => { console.error(err); alert('Connection failed.'); });
    });

    copyIdButton.addEventListener('click', () => {
        const peerId = myPeerIdDisplay.textContent;
        if (peerId && peerId !== 'Waiting for server...') {
            navigator.clipboard.writeText(peerId).then(() => {
                copyIdButton.textContent = 'Copied!';
                setTimeout(() => { copyIdButton.textContent = 'Copy ID'; }, 2000);
            }).catch(err => {
                console.error('Failed to copy ID: ', err);
                alert('Failed to copy ID.');
            });
        }
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
        myShortIdDisplay = document.getElementById('my-short-id');
        settingsButton = document.getElementById('settings-button');
        settingsModal = document.getElementById('settings-modal');
        closeSettingsModal = document.getElementById('close-settings-modal');
        developerModeToggle = document.getElementById('developer-mode-toggle');
    }

    function startGame() {
        getElements();

        difficulties = {
            easy: { ROWS: 8, COLS: 8, MINES: 10 },
            medium: { ROWS: 10, COLS: 10, MINES: 15 },
            hard: { ROWS: 20, COLS: 20, MINES: 60 } // Made hard mode bigger for co-op
        };

        zoomSlider.addEventListener('input', () => handleZoom(zoomSlider, boardElement, COLS, ROWS));
        boardElement.addEventListener('click', (e) => handleCellClick(e));
        boardElement.addEventListener('contextmenu', (e) => handleCellRightClick(e));

        if (isHost) {
            difficultySelect.addEventListener('change', () => init(true));
            resetButton.addEventListener('click', () => init(true));
            modalResetButton.addEventListener('click', () => init(true));
            boardElement.addEventListener('mouseover', (e) => handleChordPreview(e));
            boardElement.addEventListener('mouseout', () => clearChordPreview());
            init(false);
        }

        if (!isHost) {
            boardElement.innerHTML = '<h2 style="color: white; text-align: center;">Connected! Waiting for host to sync game...</h2>';
            document.querySelector('.header__section--center').style.visibility = 'hidden';
            document.querySelector('.header__section--right .difficulty-selector').style.visibility = 'hidden';
        }
    }
});