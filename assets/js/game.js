import { db, auth } from "./firebase.js";
import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");
const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;
let isHost = false;
let currentPlayer = null;
let playersData = {};

// 🔹 Autenticazione
auth.onAuthStateChanged(async (user) => {
  if (!user) return console.error("❌ Nessun utente autenticato!");
  currentUser = user;

  const snapshot = await get(ref(db, `games/${gameCode}/players/${currentUser.uid}`));
  if (!snapshot.exists()) return alert("Giocatore non trovato!");
  currentPlayer = snapshot.val();
  isHost = currentPlayer.role === "host";

  if (isHost) {
    document.getElementById("narrator-view").style.display = "block";
    setupNarrator();
  } else {
    document.getElementById("player-view").style.display = "block";
    setupPlayer();
  }
});

// ==================================================
// 🔹 Player view
function setupPlayer() {
  const cardEl = document.getElementById("role-card");
  const toggleBtn = document.getElementById("toggle-card");

  const showRole = () => cardEl.textContent = currentPlayer.gameRole || "Non ancora assegnato";
  const hideRole = () => cardEl.textContent = "Ruolo";

  toggleBtn.addEventListener("click", () => {
    cardEl.textContent === "Ruolo" ? showRole() : hideRole();
  });

  showRole();
}

// ==================================================
// 🔹 Narrator view
async function setupNarrator() {
  const playersList = document.getElementById("players-narrator");
  const dayBtn = document.getElementById("day-btn");
  const nightBtn = document.getElementById("night-btn");
  const endBtn = document.getElementById("end-game-btn");

  // 🔹 Ascolta i giocatori
  onValue(ref(db, `games/${gameCode}/players`), (snapshot) => {
    playersData = snapshot.val() || {};
    renderPlayersList();
  });

  dayBtn.addEventListener("click", () => {
    update(ref(db, `games/${gameCode}/state`), { phase: "day" });
    applyNightActions(); // Applica azioni della notte appena finita
  });

  nightBtn.addEventListener("click", () => update(ref(db, `games/${gameCode}/state`), { phase: "night" }));

  endBtn.addEventListener("click", async () => {
    await update(ref(db, `games/${gameCode}/state`), { status: "ended" });
    window.location.href = `lobby.html?gameCode=${gameCode}`;
  });
}

// 🔹 Mostra lista giocatori nel narratore
function renderPlayersList() {
  const listEl = document.getElementById("players-narrator");
  listEl.innerHTML = "";

  Object.entries(playersData).forEach(([uid, p]) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} - Ruolo: ${p.gameRole || "Non assegnato"} - Vivo: ${p.isAlive}`;
    if (p.role !== "host") {
      li.dataset.uid = uid;
      li.addEventListener("click", () => toggleTarget(li));
    }
    listEl.appendChild(li);
  });
}

// ==================================================
// 🔹 Gestione selezione target (per Lupi, Puttana, Muto, Amanti)
const nightTargets = {
  wolves: [],
  puttana: null,
  muto: null,
  amanti: {}
};

function toggleTarget(li) {
  const uid = li.dataset.uid;
  const phase = document.getElementById("night-btn").disabled ? "day" : "night";
  if (phase !== "night") return;

  // 🔹 Esempio: aggiunge/ritira dai target dei lupi
  if (nightTargets.wolves.includes(uid)) {
    nightTargets.wolves = nightTargets.wolves.filter(x => x !== uid);
    li.style.background = "";
  } else {
    nightTargets.wolves.push(uid);
    li.style.background = "red";
  }
}

// ==================================================
// 🔹 Applica le azioni della notte
async function applyNightActions() {
  let updates = {};

  // 🔹 Prima determinare chi muore
  let toKill = new Set(nightTargets.wolves);

  // 🔹 Gestione amanti
  Object.values(playersData).forEach(p => {
    if (p.gameRole === "Amante") {
      const lover = nightTargets.amanti[p.uid];
      if (lover && toKill.has(lover)) {
        toKill.add(p.uid); // L'amante muore se dorme con la vittima dei lupi
      }
    }
  });

  // 🔹 Gestione Puttana
  if (nightTargets.puttana) {
    toKill.delete(nightTargets.puttana); // Puttana salva
  }

  // 🔹 Gestione Muto
  if (nightTargets.muto) {
    // eventualmente aggiornare lo stato di silenziato del player
  }

  // 🔹 Aggiorna isAlive nel DB
  Object.keys(playersData).forEach(uid => {
    if (toKill.has(uid)) updates[`players/${uid}/isAlive`] = false;
  });

  await update(ref(db, `games/${gameCode}`), updates);

  // Reset targets per la notte successiva
  nightTargets.wolves = [];
  nightTargets.puttana = null;
  nightTargets.muto = null;
  nightTargets.amanti = {};
}
