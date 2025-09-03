import { db, auth } from "./firebase.js";
import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");
const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;
let isHost = false;
let currentPlayer = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) return console.error("❌ Nessun utente autenticato!");
  currentUser = user;

  // Controlla ruolo e mostra la view corretta
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

  const showRole = () => {
    cardEl.textContent = currentPlayer.gameRole || "Non ancora assegnato";
  };

  const hideRole = () => {
    cardEl.textContent = "Ruolo";
  };

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

  // Mostra tutti i giocatori con ruoli
  onValue(ref(db, `games/${gameCode}/players`), (snapshot) => {
    const players = snapshot.val() || {};
    playersList.innerHTML = "";

    Object.entries(players).forEach(([uid, p]) => {
      const li = document.createElement("li");
      li.textContent = `${p.name} - Ruolo: ${p.gameRole || "non assegnato"} - Vivo: ${p.isAlive}`;
      playersList.appendChild(li);
    });
  });

  dayBtn.addEventListener("click", () => update(ref(db, `games/${gameCode}/state`), { phase: "day" }));
  nightBtn.addEventListener("click", () => update(ref(db, `games/${gameCode}/state`), { phase: "night" }));

  endBtn.addEventListener("click", async () => {
    // Logica per decidere vincitori → aggiorna il database se vuoi
    await update(ref(db, `games/${gameCode}/state`), { status: "ended" });

    // Torna alla lobby
    window.location.href = `lobby.html?gameCode=${gameCode}`;
  });
}
