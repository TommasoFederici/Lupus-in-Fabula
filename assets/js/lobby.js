// assets/js/lobby.js
import { db, auth } from "./firebase.js";
import {
  ref,
  onValue,
  set,
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
    console.error("Nessun utente autenticato!");
  }
});

async function setupLobby() {
  // Ascolta i dati della partita
  onValue(gameRef, (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;

    isHost = gameData.host === currentUser.uid;

    renderPlayers(gameData.players || {});
    renderRoles(gameData.roles || {});

    // 🔹 Redirect automatico se il gioco è partito
    if (gameData.state?.status === "running") {
      window.location.href = `game.html?gameCode=${gameCode}`;
    }
  });

  // 🔹 Carica ruoli dal JSON (solo host può modificarli)
  await loadRoles();

  if (isHost) {
    const startBtn = document.getElementById("start-game-btn");
    if (startBtn) {
      startBtn.style.display = "block";
      startBtn.addEventListener("click", startGame);
    }
  }
}

// 🔹 Mostra i giocatori
function renderPlayers(players) {
  const container = document.getElementById("players-list");
  if (!container) return;

  container.innerHTML = "";
  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.textContent = p.name + (p.uid === currentUser.uid ? " (Tu)" : "");
    if (p.uid === Object.values(players)[0].uid) {
      div.textContent += " ⭐ (Host)";
    }
    container.appendChild(div);
  });
}

// 🔹 Carica e mostra i ruoli
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
      }

      container.appendChild(wrapper);
    });
  } catch (err) {
    console.error("Errore nel caricamento dei ruoli:", err);
  }
}

// 🔹 Aggiorna i conteggi dei ruoli nel DB
function updateRole(roleName, delta) {
  const roleCountEl = document.getElementById(`role-count-${roleName}`);
  let newCount = parseInt(roleCountEl.textContent) + delta;
  if (newCount < 0) newCount = 0;
  roleCountEl.textContent = newCount;

  update(ref(db, `games/${gameCode}/roles/${roleName}`), { count: newCount });
}

// 🔹 Sincronizza i ruoli
function renderRoles(dbRoles) {
  Object.keys(dbRoles).forEach((roleName) => {
    const el = document.getElementById(`role-count-${roleName}`);
    if (el) {
      el.textContent = dbRoles[roleName].count;
    }
  });
}

// 🔹 Avvia la partita
function startGame() {
  update(ref(db, `games/${gameCode}/state`), {
    status: "running",
    phase: "night"
  });
}
