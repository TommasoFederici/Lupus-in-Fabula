// assets/js/lobby.js
import { db, auth } from "./firebase.js";
import {
  ref,
  onValue,
  set,
  update,
  get
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");
const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;
let isHost = false;
let roles = [];

// 🔹 Autenticazione anonima
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    console.log("✅ Accesso anonimo riuscito, uid:", user.uid);
    setupLobby();
  } else {
    console.error("❌ Nessun utente autenticato!");
  }
});

async function setupLobby() {
  // 🔹 Ascolta i dati della partita
  onValue(gameRef, (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;

    isHost = gameData.host === currentUser.uid;

    // Mostra codice partita
    const codeEl = document.getElementById("game-code");
    if (codeEl) codeEl.textContent = `Codice partita: ${gameCode}`;

    // Mostra lista giocatori
    renderPlayers(gameData.players || {}, gameData.host);

    // Mostra ruoli dal DB se esistono
    renderRoles(gameData.roles || {});

    // Redirect automatico se partita in corso
    if (gameData.state?.status === "running") {
      window.location.href = `game.html?gameCode=${gameCode}`;
    }
  });

  // 🔹 Carica ruoli dal JSON
  await loadRoles();

  // 🔹 Se sei host, mostra start button
  if (isHost) {
    const startBtn = document.getElementById("start-game-btn");
    if (startBtn) {
      startBtn.style.display = "block";
      startBtn.addEventListener("click", startGame);
    }
  }
}

// 🔹 Mostra giocatori
function renderPlayers(players, hostId) {
  const container = document.getElementById("players-list");
  if (!container) return;

  container.innerHTML = "";
  Object.entries(players).forEach(([uid, p]) => {
    let text = p.name;
    if (uid === currentUser.uid) text += " (Tu)";
    if (uid === hostId) text += " ⭐ (Host)";

    const div = document.createElement("div");
    div.textContent = text;
    container.appendChild(div);
  });
}

// 🔹 Carica ruoli da JSON
async function loadRoles() {
  try {
    const res = await fetch("assets/data/roles.json");
    roles = await res.json();

    const container = document.getElementById("roles-list");
    if (!container) return;
    container.innerHTML = "";

    roles.forEach((role) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("role-item");

      const label = document.createElement("span");
      label.textContent = `${role.name}: `;

      const count = document.createElement("span");
      count.id = `role-count-${role.name}`;
      count.textContent = role.defaultCount;

      wrapper.appendChild(label);
      wrapper.appendChild(count);

      if (isHost) {
        const minus = document.createElement("button");
        minus.textContent = "-";
        minus.addEventListener("click", () => updateRole(role.name, -1));

        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.addEventListener("click", () => updateRole(role.name, 1));

        wrapper.appendChild(minus);
        wrapper.appendChild(plus);

        // Inizializza nel DB solo la prima volta
        const roleRef = ref(db, `games/${gameCode}/roles/${role.name}`);
        get(roleRef).then(snapshot => {
          if (!snapshot.exists()) {
            set(roleRef, { count: role.defaultCount, description: role.description });
          }
        });
      }

      container.appendChild(wrapper);
    });
  } catch (err) {
    console.error("❌ Errore nel caricamento dei ruoli:", err);
  }
}

// 🔹 Aggiorna conteggi ruoli nel DB
function updateRole(roleName, delta) {
  const roleCountEl = document.getElementById(`role-count-${roleName}`);
  let newCount = parseInt(roleCountEl.textContent) + delta;
  if (newCount < 0) newCount = 0;
  roleCountEl.textContent = newCount;

  update(ref(db, `games/${gameCode}/roles/${roleName}`), { count: newCount });
}

// 🔹 Sincronizza ruoli dal DB
function renderRoles(dbRoles) {
  Object.keys(dbRoles).forEach((roleName) => {
    const el = document.getElementById(`role-count-${roleName}`);
    if (el) el.textContent = dbRoles[roleName].count;
  });
}

// 🔹 Avvia partita (solo host)
async function startGame() {
  const snapshot = await get(ref(db, `games/${gameCode}/players`));
  if (!snapshot.exists()) return;

  const players = snapshot.val();
  const activePlayers = Object.keys(players).filter(uid => players[uid].role !== "host"); // solo guest

  // Prendi lista ruoli selezionati
  const selectedRoles = roles.filter(role => {
    const countEl = document.getElementById(`role-count-${role.name}`);
    return parseInt(countEl.textContent) > 0;
  });

  // Controllo che numero ruoli = numero giocatori guest
  const totalRoles = selectedRoles.reduce((sum, r) => {
    const countEl = document.getElementById(`role-count-${r.name}`);
    return sum + parseInt(countEl.textContent);
  }, 0);

  if (totalRoles !== activePlayers.length) {
    return alert(`Numero ruoli (${totalRoles}) diverso dal numero di giocatori (${activePlayers.length})`);
  }

  // Assegna ruoli casuali ai guest
  let rolePool = [];
  selectedRoles.forEach(r => {
    const countEl = document.getElementById(`role-count-${r.name}`);
    for (let i = 0; i < parseInt(countEl.textContent); i++) rolePool.push(r.name);
  });

  // Shuffle rolePool
  rolePool = rolePool.sort(() => Math.random() - 0.5);

  // Aggiorna i guest con gameRole e isAlive
  activePlayers.forEach((uid, index) => {
    update(ref(db, `games/${gameCode}/players/${uid}`), {
      gameRole: rolePool[index],
      isAlive: true
    });
  });

  // Aggiorna stato partita
  update(ref(db, `games/${gameCode}/state`), {
    status: "running",
    phase: "night"
  });
}
