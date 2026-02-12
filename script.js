const BOARD_SIZE = 15;

const TRACK = [   
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

const PLAYERS = [
  {
    id: "green",
    name: "Green",
    startIndex: 39,
    startDir: "up",
    homeSlots: [
      [10, 2], [10, 4], [12, 2], [12, 4],
    ],
    homePath: [
      [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7],
    ],
  },
  {
    id: "yellow",
    name: "Yellow",
    startIndex: 0,
    startDir: "right",
    homeSlots: [
      [2, 2], [2, 4], [4, 2], [4, 4],
    ],
    homePath: [
      [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6],
    ],
  },
  {
    id: "blue",
    name: "Blue",
    startIndex: 13,
    startDir: "down",
    homeSlots: [
      [2, 10], [2, 12], [4, 10], [4, 12],
    ],
    homePath: [
      [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
    ],
  },
  {
    id: "red",
    name: "Red",
    startIndex: 26,
    startDir: "left",
    homeSlots: [
      [10, 10], [10, 12], [12, 10], [12, 12],
    ],
    homePath: [
      [7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8],
    ],
  },
];

const MODES = {
  hvh2: { players: ["red", "blue"] },
  hvai2: { players: ["red", "blue"], ai: ["blue"] },
  hvh3: { players: ["green", "yellow", "blue"] },
  hvh4: { players: ["green", "yellow", "blue", "red"] },
};

const state = {
  currentPlayerIndex: 0,
  diceValue: null,
  awaitingMove: false,
  tokens: [],
  activePlayerIds: [],
  aiPlayerIds: [],
  modeKey: "hvh4",
  statusText: "Ready.",
};

const boardEl = document.getElementById("board");
const rollBtn = document.getElementById("rollBtn");
const resetBtn = document.getElementById("resetBtn");
const diceEl = document.getElementById("dice");
const statusEl = document.getElementById("status");
const modeSelect = document.getElementById("modeSelect");
const startBtn = document.getElementById("startBtn");
const diceOverlay = document.getElementById("diceOverlay");
const dicePop = diceOverlay ? diceOverlay.querySelector(".dice-pop") : null;
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const onlineStatus = document.getElementById("onlineStatus");

const cellMap = new Map();
let socket = null;
let lastDiceShown = null;

const online = {
  enabled: false,
  roomCode: null,
  playerId: null,
  isHost: false,
};

init();

function init() {
  buildBoard();
  resetGame();
  rollBtn.addEventListener("click", onRoll);
  resetBtn.addEventListener("click", resetGame);
  startBtn.addEventListener("click", () => {
    state.modeKey = modeSelect.value;
    resetGame();
  });
  createRoomBtn.addEventListener("click", createRoom);
  joinRoomBtn.addEventListener("click", joinRoom);
  leaveRoomBtn.addEventListener("click", leaveRoom);
}

function buildBoard() {
  boardEl.innerHTML = "";
  cellMap.clear();

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;

      const key = `${r},${c}`;
      cellMap.set(key, cell);
      boardEl.appendChild(cell);
    }
  }

  paintBases();
  paintTrack();
  paintHomePaths();
  paintCenterCover();
}

function paintBases() {
  paintRect(1, 1, 5, 5, ["base", "yellow"]);
  paintRect(1, 9, 5, 5, ["base", "blue"]);
  paintRect(9, 9, 5, 5, ["base", "red"]);
  paintRect(9, 1, 5, 5, ["base", "green"]);
}

function paintRect(startRow, startCol, height, width, classes) {
  for (let r = startRow; r < startRow + height; r += 1) {
    for (let c = startCol; c < startCol + width; c += 1) {
      const cell = cellMap.get(`${r},${c}`);
      cell.classList.add(...classes);
    }
  }
}

function paintTrack() {
  TRACK.forEach(([r, c], index) => {
    const cell = cellMap.get(`${r},${c}`);
    cell.classList.add("track");
    if (SAFE_INDICES.includes(index)) {
      cell.classList.add("safe");
    }
  });

  PLAYERS.forEach((player) => {
    const [sr, sc] = TRACK[player.startIndex];
    const startCell = cellMap.get(`${sr},${sc}`);
    startCell.classList.add("start", player.id, `dir-${player.startDir}`);
  });
}

function paintHomePaths() {
  PLAYERS.forEach((player) => {
    player.homePath.forEach(([r, c]) => {
      const cell = cellMap.get(`${r},${c}`);
      cell.classList.add("home-path", player.id);
    });
  });
}

function paintCenterCover() {
  for (let r = 6; r <= 8; r += 1) {
    for (let c = 6; c <= 8; c += 1) {
      const cell = cellMap.get(`${r},${c}`);
      cell.classList.add("center-cover");
    }
  }
}

function resetGame() {
  applyMode(state.modeKey);
  state.tokens = [];
  state.activePlayerIds.forEach((playerId) => {
    const player = PLAYERS.find((p) => p.id === playerId);
    for (let i = 0; i < 4; i += 1) {
      state.tokens.push({
        id: `${player.id}-${i + 1}`,
        playerId: player.id,
        steps: -1,
        homeIndex: i,
      });
    }
  });
  state.currentPlayerIndex = 0;
  state.diceValue = null;
  state.awaitingMove = false;
  diceEl.textContent = "-";
  render();
  setStatus("Roll to begin.");
  maybeAutoAITurn();
  syncOnlineState();
}

function onRoll(options = {}) {
  if (online.enabled && !online.isHost && !options.force) {
    sendOnlineAction({ type: "roll" });
    setOnlineStatus("Sent roll");
    return;
  }
  if (!options.force && !isLocalTurnAllowed()) {
    return;
  }
  if (state.awaitingMove) {
    return;
  }
  const currentPlayer = getCurrentPlayer();
  const roll = 1 + Math.floor(Math.random() * 6);
  state.diceValue = roll;
  diceEl.textContent = String(roll);
  showDiceOverlay(roll);

  const movable = getMovableTokens(currentPlayer, roll);
  if (movable.length === 0) {
    setStatus(`${currentPlayer.name} rolled ${roll} and has no moves.`);
    advanceTurn();
    return;
  }

  state.awaitingMove = true;
  render();
  syncOnlineState();
  if (isAI(currentPlayer.id)) {
    setStatus(`${currentPlayer.name} rolled ${roll}.`);
  } else {
    setStatus(`${currentPlayer.name} rolled ${roll}. Choose a token.`);
  }
}

function getMovableTokens(player, roll) {
  return state.tokens.filter((token) => {
    if (token.playerId !== player.id) {
      return false;
    }
    if (token.steps === -1) {
      return roll === 6;
    }
    if (token.steps >= 57) {
      return false;
    }
    return token.steps + roll <= 57;
  });
}

function moveToken(token, options = {}) {
  if (online.enabled && !online.isHost && !options.force) {
    sendOnlineAction({ type: "move", tokenId: token.id });
    setOnlineStatus("Sent move");
    return;
  }
  const player = PLAYERS.find((p) => p.id === token.playerId);
  const roll = state.diceValue;

  if (token.steps === -1) {
    token.steps = 0;
  } else {
    token.steps += roll;
  }

  if (token.steps <= 51) {
    const targetIndex = (player.startIndex + token.steps) % TRACK.length;
    if (!SAFE_INDICES.includes(targetIndex)) {
      captureTokensAt(targetIndex, player.id);
    }
  }

  if (token.steps === 57) {
    setStatus(`${player.name} finished a token!`);
  }

  state.awaitingMove = false;
  render();
  syncOnlineState();

  if (roll === 6) {
    setStatus(`${player.name} rolled a 6. Extra turn!`);
    if (isAI(player.id)) {
      setTimeout(runAITurn, 600);
    }
  } else {
    advanceTurn();
  }
}

function captureTokensAt(trackIndex, playerId) {
  state.tokens.forEach((token) => {
    if (token.playerId === playerId) {
      return;
    }
    if (token.steps < 0 || token.steps >= 52) {
      return;
    }
    const tokenPlayer = PLAYERS.find((p) => p.id === token.playerId);
    const tokenIndex = (tokenPlayer.startIndex + token.steps) % TRACK.length;
    if (tokenIndex === trackIndex) {
      token.steps = -1;
    }
  });
}

function advanceTurn() {
  state.diceValue = null;
  diceEl.textContent = "-";
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.activePlayerIds.length;
  state.awaitingMove = false;
  render();
  const current = getCurrentPlayer();
  setStatus(`${current.name}'s turn. Roll the dice.`);
  syncOnlineState();
  maybeAutoAITurn();
}

function render() {
  clearTokens();
  const current = getCurrentPlayer();
  const allowInteraction = isLocalTurnAllowed();

  state.tokens.forEach((token) => {
    const player = PLAYERS.find((p) => p.id === token.playerId);
    let cell = null;

    if (token.steps === -1) {
      const [r, c] = player.homeSlots[token.homeIndex];
      cell = cellMap.get(`${r},${c}`);
    } else if (token.steps <= 51) {
      const trackIndex = (player.startIndex + token.steps) % TRACK.length;
      const [r, c] = TRACK[trackIndex];
      cell = cellMap.get(`${r},${c}`);
    } else {
      const [r, c] = player.homePath[token.steps - 52];
      cell = cellMap.get(`${r},${c}`);
    }

    const stack = getStack(cell);
    const tokenEl = document.createElement("div");
    tokenEl.className = `token ${player.id}`;
    tokenEl.dataset.tokenId = token.id;

    if (state.awaitingMove && current.id === token.playerId && allowInteraction) {
      const movable = getMovableTokens(current, state.diceValue);
      if (movable.some((t) => t.id === token.id)) {
        tokenEl.classList.add("movable");
        tokenEl.addEventListener("click", () => moveToken(token));
      }
    }

    stack.appendChild(tokenEl);
  });

  updateControls(current);
}

function clearTokens() {
  cellMap.forEach((cell) => {
    const existing = cell.querySelector(".stack");
    if (existing) {
      existing.remove();
    }
  });
}

function getStack(cell) {
  let stack = cell.querySelector(".stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "stack";
    cell.appendChild(stack);
  }
  return stack;
}

function setStatus(text) {
  statusEl.textContent = text;
  state.statusText = text;
}

function applyMode(modeKey) {
  const mode = MODES[modeKey] || MODES.hvh4;
  state.activePlayerIds = mode.players.slice();
  state.aiPlayerIds = mode.ai ? mode.ai.slice() : [];
}

function getCurrentPlayer() {
  const playerId = state.activePlayerIds[state.currentPlayerIndex];
  return PLAYERS.find((p) => p.id === playerId);
}

function isAI(playerId) {
  return state.aiPlayerIds.includes(playerId);
}

function updateControls(currentPlayer) {
  if (!currentPlayer) {
    rollBtn.disabled = true;
    return;
  }
  if (!isLocalTurnAllowed()) {
    rollBtn.disabled = true;
    return;
  }
  rollBtn.disabled = state.awaitingMove || isAI(currentPlayer.id);
}

function maybeAutoAITurn() {
  if (online.enabled) {
    updateControls(getCurrentPlayer());
    return;
  }
  const current = getCurrentPlayer();
  if (!current || !isAI(current.id)) {
    updateControls(current);
    return;
  }
  setStatus(`${current.name} (AI) is thinking...`);
  setTimeout(runAITurn, 600);
}

function isLocalTurnAllowed() {
  if (!online.enabled) {
    return true;
  }
  const current = getCurrentPlayer();
  return current && current.id === online.playerId;
}

function getSocket() {
  if (socket) {
    return socket;
  }
  if (typeof io === "undefined") {
    return null;
  }
  const url = window.LUDO_SERVER_URL || "";
  socket = io(url, { autoConnect: false });
  socket.on("connect", () => setOnlineStatus("Connected"));
  socket.on("disconnect", () => setOnlineStatus("Disconnected"));
  socket.on("room:joined", handleRoomJoined);
  socket.on("room:status", (payload) => {
    if (payload?.message) {
      setOnlineStatus(payload.message);
    }
  });
  socket.on("room:sync", () => {
    if (online.isHost) {
      syncOnlineState();
    }
  });
  socket.on("room:action", handleRemoteAction);
  socket.on("room:state", (payload) => {
    if (!payload || !payload.state) {
      return;
    }
    applyRemoteState(payload.state);
  });
  socket.on("room:error", (payload) => {
    setOnlineStatus(payload?.message || "Room error");
  });
  return socket;
}

function createRoom() {
  const sock = getSocket();
  if (!sock) {
    setOnlineStatus("Socket client not loaded");
    return;
  }
  sock.connect();
  sock.emit("room:create", { modeKey: "hvh2" });
}

function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) {
    setOnlineStatus("Enter room code");
    return;
  }
  const sock = getSocket();
  if (!sock) {
    setOnlineStatus("Socket client not loaded");
    return;
  }
  sock.connect();
  sock.emit("room:join", { code });
}

function leaveRoom() {
  if (socket && online.roomCode) {
    socket.emit("room:leave", { code: online.roomCode });
  }
  online.enabled = false;
  online.roomCode = null;
  online.playerId = null;
  online.isHost = false;
  setOnlineStatus("Offline");
  roomCodeDisplay.textContent = "Room: -";
}

function handleRoomJoined(payload) {
  if (!payload || !payload.code || !payload.playerId) {
    return;
  }
  online.enabled = true;
  online.roomCode = payload.code;
  online.playerId = payload.playerId;
  online.isHost = payload.isHost;
  roomCodeDisplay.textContent = `Room: ${payload.code}`;
  setOnlineStatus(`Online as ${payload.playerId}`);
  state.modeKey = "hvh2";
  if (online.isHost) {
    resetGame();
    syncOnlineState();
  } else if (payload.state) {
    applyRemoteState(payload.state);
  }
}

function setOnlineStatus(text) {
  onlineStatus.textContent = text;
  onlineStatus.classList.add("online");
  onlineStatus.classList.remove("green", "red", "blue", "yellow");
  if (online.playerId) {
    onlineStatus.classList.add(online.playerId);
  }
}

function syncOnlineState() {
  if (!online.enabled || !socket || !socket.connected) {
    return;
  }
  if (!online.isHost) {
    return;
  }
  const snapshot = {
    modeKey: state.modeKey,
    currentPlayerIndex: state.currentPlayerIndex,
    diceValue: state.diceValue,
    awaitingMove: state.awaitingMove,
    statusText: state.statusText,
    tokens: state.tokens.map((t) => ({ ...t })),
    activePlayerIds: state.activePlayerIds.slice(),
    aiPlayerIds: state.aiPlayerIds.slice(),
  };
  socket.emit("room:state", { code: online.roomCode, state: snapshot });
}

function sendOnlineAction(action) {
  if (!online.enabled || !socket || !socket.connected) {
    return;
  }
  socket.emit("room:action", { code: online.roomCode, action });
}

function handleRemoteAction(payload) {
  if (!online.enabled || !online.isHost) {
    return;
  }
  if (!payload || !payload.action || !payload.playerId) {
    return;
  }
  const current = getCurrentPlayer();
  if (!current || current.id !== payload.playerId) {
    return;
  }
  const { type, tokenId } = payload.action;
  if (type === "roll") {
    onRoll({ force: true });
    return;
  }
  if (type === "move" && tokenId) {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token) {
      moveToken(token, { force: true });
    }
  }
}

function applyRemoteState(snapshot) {
  if (!snapshot) {
    return;
  }
  state.modeKey = snapshot.modeKey || state.modeKey;
  state.currentPlayerIndex = snapshot.currentPlayerIndex ?? state.currentPlayerIndex;
  state.diceValue = snapshot.diceValue ?? state.diceValue;
  state.awaitingMove = snapshot.awaitingMove ?? state.awaitingMove;
  state.statusText = snapshot.statusText ?? state.statusText;
  state.tokens = (snapshot.tokens || []).map((t) => ({ ...t }));
  state.activePlayerIds = snapshot.activePlayerIds || state.activePlayerIds;
  state.aiPlayerIds = snapshot.aiPlayerIds || state.aiPlayerIds;
  diceEl.textContent = state.diceValue ?? "-";
  statusEl.textContent = state.statusText || statusEl.textContent;
  if (typeof state.diceValue === "number" && state.diceValue !== lastDiceShown) {
    showDiceOverlay(state.diceValue);
  }
  render();
  updateControls(getCurrentPlayer());
}

function showDiceOverlay(value) {
  if (!diceOverlay || !dicePop) {
    return;
  }
  lastDiceShown = value;
  dicePop.className = "dice-pop";
  dicePop.classList.add(`show-${value}`);
  diceOverlay.classList.add("show");
  diceOverlay.setAttribute("aria-hidden", "false");
  clearTimeout(showDiceOverlay._t);
  showDiceOverlay._t = setTimeout(() => {
    diceOverlay.classList.remove("show");
    diceOverlay.setAttribute("aria-hidden", "true");
  }, 1000);
}

function runAITurn() {
  const current = getCurrentPlayer();
  if (!current || !isAI(current.id)) {
    return;
  }
  if (state.awaitingMove) {
    const movable = getMovableTokens(current, state.diceValue);
    const choice = movable[Math.floor(Math.random() * movable.length)];
    if (choice) {
      moveToken(choice);
    }
    return;
  }
  onRoll();
  if (state.awaitingMove) {
    const movable = getMovableTokens(current, state.diceValue);
    const choice = movable[Math.floor(Math.random() * movable.length)];
    if (choice) {
      setTimeout(() => moveToken(choice), 400);
    }
  }
}
