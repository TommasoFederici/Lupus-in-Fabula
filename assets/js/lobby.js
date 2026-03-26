// assets/js/lobby.js
import { db, auth } from "./firebase.js";
import {
  ref, onValue, set, update, get, remove
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { ROLES } from "./engine/roles.js";
import * as ui from "./ui.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode  = urlParams.get("gameCode");

// Se non c'è codice in URL, torna alla home
if (!gameCode) {
  window.location.href = "/";
}

const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;
let isHost      = false;

// ──────────────────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  // Se non autenticato, torna al login
  if (!user) {
    window.location.href = "/";
    return;
  }
  currentUser = user;
  setupLobby();
});

async function setupLobby() {
  onValue(gameRef, async (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;

    isHost = gameData.host === currentUser.uid;

    const devMode = gameData.state?.devMode ?? false;

    document.getElementById("game-code").textContent = gameCode;
    renderPlayers(gameData.players ?? {}, gameData.host, devMode);
    await loadRoles(gameData.roles ?? {});

    // Sezione impostazioni host
    const settingsSection = document.getElementById("settings-section");
    if (settingsSection) settingsSection.style.display = isHost ? "block" : "none";

    // Sincronizza toggle
    if (isHost) {
      const skipChk = document.getElementById("skip-first-night");
      if (skipChk) skipChk.checked = gameData.state?.skipFirstNight ?? false;

      const devChk = document.getElementById("dev-mode");
      if (devChk) devChk.checked = devMode;
    }

    // Pannello Dev Mode
    const devSection = document.getElementById("dev-section");
    if (devSection) devSection.style.display = (isHost && devMode) ? "block" : "none";

    if (isHost) {
      const startBtn = document.getElementById("start-game-btn");
      startBtn.style.display = "block";
      if (!startBtn.dataset.listener) {
        startBtn.addEventListener("click", startGame);
        startBtn.dataset.listener = "1";
      }
    }

    renderRoleCounts(gameData.roles ?? {});

    if (gameData.state?.status === "running") {
      window.location.href = `game?gameCode=${gameCode}`;
    }
  });

  // Copia codice al click sulla barra
  document.getElementById("game-code-bar")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(gameCode).then(() => ui.toast("✓ Codice copiato!"));
  });

  // Toggle "Salta Prima Notte"
  document.getElementById("skip-first-night")?.addEventListener("change", (e) => {
    if (!isHost) return;
    update(ref(db, `games/${gameCode}/state`), { skipFirstNight: e.target.checked });
  });

  // Toggle "Modalità Sviluppatore"
  document.getElementById("dev-mode")?.addEventListener("change", (e) => {
    if (!isHost) return;
    update(ref(db, `games/${gameCode}/state`), { devMode: e.target.checked });
  });

  // Pulsante "+ Aggiungi Bot"
  document.getElementById("add-bot-btn")?.addEventListener("click", addBot);
}

// ──────────────────────────────────────────────────────────────────────────────
function renderPlayers(players, hostId, devMode) {
  const container = document.getElementById("players-list");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(players).forEach(([uid, p]) => {
    const div = document.createElement("div");
    div.className = "player-item";

    const nameSpan = document.createElement("span");
    let text = p.isBot ? `🤖 ${p.name}` : p.name;
    if (uid === currentUser.uid) text += " (Tu)";
    if (uid === hostId)          text += " ⭐ Host";
    nameSpan.textContent = text;
    div.appendChild(nameSpan);

    // Pulsante rimozione bot visibile solo in dev mode all'host
    if (isHost && p.isBot && devMode) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "✕";
      removeBtn.className = "btn-remove-bot";
      removeBtn.title = "Rimuovi bot";
      removeBtn.addEventListener("click", () => removeBot(uid));
      div.appendChild(removeBtn);
    }

    container.appendChild(div);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
async function addBot() {
  const snap    = await get(ref(db, `games/${gameCode}/players`));
  const players = snap.val() ?? {};
  const botCount = Object.values(players).filter(p => p.isBot).length;
  const botName  = `Bot ${botCount + 1}`;
  const botUid   = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  await set(ref(db, `games/${gameCode}/players/${botUid}`), {
    name:    botName,
    role:    "guest",
    isAlive: true,
    isBot:   true,
    gameRole: null,
    isMuted: false
  });
}

async function removeBot(uid) {
  await remove(ref(db, `games/${gameCode}/players/${uid}`));
}

// ──────────────────────────────────────────────────────────────────────────────
async function loadRoles(dbRoles) {
  const container = document.getElementById("roles-list");
  if (!container) return;
  container.innerHTML = "";

  const allRoles = Object.values(ROLES);

  for (const ruolo of allRoles) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("role-item");

    const labelEl = document.createElement("span");
    labelEl.className = "role-name";
    labelEl.textContent = ruolo.nome;

    const desc = document.createElement("span");
    desc.className = "role-desc";
    desc.textContent = ruolo.descrizione;

    const countEl = document.createElement("span");
    countEl.id = `role-count-${ruolo.nome}`;
    countEl.className = "role-count";
    countEl.textContent = dbRoles[ruolo.nome]?.count ?? ruolo.defaultCount;

    wrapper.append(labelEl, desc, countEl);

    if (isHost) {
      const minus = document.createElement("button");
      minus.textContent = "−";
      minus.className = "btn-count";
      minus.addEventListener("click", () => updateRole(ruolo.nome, -1));

      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.className = "btn-count";
      plus.addEventListener("click", () => updateRole(ruolo.nome, +1));

      wrapper.append(minus, plus);

      const roleRef = ref(db, `games/${gameCode}/roles/${ruolo.nome}`);
      const existing = await get(roleRef);
      if (!existing.exists()) {
        set(roleRef, { count: ruolo.defaultCount, description: ruolo.descrizione });
      }
    }

    container.appendChild(wrapper);
  }
}

function updateRole(roleName, delta) {
  const el = document.getElementById(`role-count-${roleName}`);
  let newCount = parseInt(el.textContent) + delta;
  if (newCount < 0) newCount = 0;
  el.textContent = newCount;
  update(ref(db, `games/${gameCode}/roles/${roleName}`), { count: newCount });
}

function renderRoleCounts(dbRoles) {
  for (const [nome, data] of Object.entries(dbRoles)) {
    const el = document.getElementById(`role-count-${nome}`);
    if (el) el.textContent = data.count ?? 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
async function startGame() {
  const snapshot = await get(ref(db, `games/${gameCode}/players`));
  if (!snapshot.exists()) return;

  const players       = snapshot.val();
  const activePlayers = Object.keys(players).filter(uid => players[uid].role !== "host");

  const rolePool = [];
  for (const ruolo of Object.values(ROLES)) {
    const el    = document.getElementById(`role-count-${ruolo.nome}`);
    const count = el ? parseInt(el.textContent) : 0;
    for (let i = 0; i < count; i++) rolePool.push(ruolo.nome);
  }

  if (rolePool.length !== activePlayers.length) {
    await ui.alert(`Ruoli assegnati (${rolePool.length}) ≠ giocatori (${activePlayers.length}).\nAggiusta i contatori.`, { icon: "⚖️" });
    return;
  }

  // Shuffle Fisher-Yates
  for (let i = rolePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }

  const updates = {};
  activePlayers.forEach((uid, index) => {
    updates[`players/${uid}/gameRole`] = rolePool[index];
    updates[`players/${uid}/isAlive`]  = true;
    updates[`players/${uid}/isMuted`]  = false;
  });
  updates["state/status"]      = "running";
  updates["state/phase"]       = "night";
  updates["state/nightNumber"] = 1;

  await update(ref(db, `games/${gameCode}`), updates);
}
