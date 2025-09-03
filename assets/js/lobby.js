// assets/js/lobby.js
import { db, auth } from "./firebase.js";
import {
  ref,
  onValue,
  update
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
  onValue(gameRef, async (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;

    // Determina se sei host
    isHost = gameData.host === currentUser.uid;

    // Mostra codice partita
    const codeEl = document.getElementById("game-code");
    if (codeEl) codeEl.textContent = `Codice partita: ${gameCode}`;

    // Mostra giocatori
    renderPlayers(gameData.players || {}, gameData.host);

    // Mostra ruoli
    renderRoles(gameData.roles || {});

    // 🔹 Carica ruoli dal JSON (serve qui perché ora sappiamo se sei host)
    await loadRoles();

    // Mostra bottone avvia partita solo all’host
    const startBtn = document.getElementById("start-game-btn");
    if (isHost && startBtn) {
      startBtn.style.display = "block";
      startBtn.onclick = startGame;
    } else if (startBtn) {
      startBtn.style.display = "none";
    }

    // Redirect automatico se il gioco è iniziato
    if (gameData.state?.status === "running") {
      window.location.href = `game.html?gameCode=${gameCode}`;
    }
  });
}

// ==================================================
// 🔹 Mostra i giocatori
function renderPlayers(players, hostId) {
  const container = document.getElementById("players-list");
  if (!container) return;

  container.innerHTML = "";
  Object.values(players).forEach((p) => {
    let text = p.name;
    if (p.uid === currentUser.uid) text += " (Tu)";
    if (p.uid === hostId) text += " ⭐ (Host)";

    const div = document.createElement("div");
    div.textContent = text;
    container.appendChild(div);
  });
}

// ==================================================
// 🔹 Carica e mostra i ruoli dal JSON
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
        minus.onclick = () => updateRole(role.name, -1);

        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.onclick = () => updateRole(role.name, 1);

        wrapper.appendChild(minus);
        wrapper.appendChild(plus);
      }

      container.appendChild(wrapper);

      // 🔹 Se è host, inizializza i ruoli nel DB (solo la prima volta)
      if (isHost) {
        update(ref(db, `games/${gameCode}/roles/${role.name}`), {
          count: role.defaultCount,
          description: role.description
        });
      }
    });
  } catch (err) {
    console.error("❌ Errore nel caricamento dei ruoli:", err);
  }
}

// ==================================================
// 🔹 Aggiorna i conteggi dei ruoli nel DB
function updateRole(roleName, delta) {
  const roleCountEl = document.getElementById(`role-count-${roleName}`);
  let newCount = parseInt(roleCountEl.textContent) + delta;
  if (newCount < 0) newCount = 0;
  roleCountEl.textContent = newCount;

  update(ref(db, `games/${gameCode}/roles/${roleName}`), { count: newCount });
}

// 🔹 Sincronizza i ruoli dal DB → UI
function renderRoles(dbRoles) {
  Object.keys(dbRoles).forEach((roleName) => {
    const el = document.getElementById(`role-count-${roleName}`);
    if (el) {
      el.textContent = dbRoles[roleName].count;
    }
  });
}

// ==================================================
// 🔹 Avvia la partita
function startGame() {
  update(ref(db, `games/${gameCode}/state`), {
    status: "running",
    phase: "night"
  });
}
