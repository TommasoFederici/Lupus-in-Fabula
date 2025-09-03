import { db, auth } from "./firebase.js";
import { ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");
const gameArea = document.getElementById("game-area");

if (!gameCode) {
  alert("❌ Nessuna partita trovata");
}

const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;

auth.onAuthStateChanged((user) => {
  if (!user) return;
  currentUser = user;

  onValue(gameRef, (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;

    const isHost = gameData.host === currentUser.uid;
    renderGame(gameData, isHost);
  });
});

function renderGame(gameData, isHost) {
  gameArea.innerHTML = "";

  // --- se narratore ---
  if (isHost) {
    const phase = gameData.state?.phase || "night";

    const phaseControls = document.createElement("div");
    phaseControls.innerHTML = `
      <h2>Controllo Narratore</h2>
      <p>Fase attuale: <strong>${phase.toUpperCase()}</strong></p>
      <button id="toggle-phase">Passa a ${phase === "night" ? "Giorno" : "Notte"}</button>
      <button id="end-game">Termina Partita</button>
    `;
    gameArea.appendChild(phaseControls);

    document.getElementById("toggle-phase").onclick = () => {
      update(ref(db, `games/${gameCode}/state`), {
        phase: phase === "night" ? "day" : "night"
      });
    };

    document.getElementById("end-game").onclick = () => {
      const winners = prompt("Chi ha vinto? (lupi/civili/folle)");
      update(ref(db, `games/${gameCode}/state`), {
        status: "ended",
        winners: winners
      });
    };

    // Lista giocatori con ruoli
    const list = document.createElement("ul");
    Object.entries(gameData.players).forEach(([uid, player]) => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${player.name} - ${player.role} ${player.alive ? "✅" : "☠️"}
        <button data-uid="${uid}" class="kill-btn">Elimina</button>
        <button data-uid="${uid}" class="revive-btn">Resuscita</button>
      `;
      list.appendChild(li);
    });
    gameArea.appendChild(list);

    gameArea.addEventListener("click", (e) => {
      if (e.target.classList.contains("kill-btn")) {
        update(ref(db, `games/${gameCode}/players/${e.target.dataset.uid}`), { alive: false });
      }
      if (e.target.classList.contains("revive-btn")) {
        update(ref(db, `games/${gameCode}/players/${e.target.dataset.uid}`), { alive: true });
      }
    });

  } else {
    // --- se giocatore ---
    const player = gameData.players[currentUser.uid];
    if (!player) return;

    if (gameData.state?.status === "ended") {
      gameArea.innerHTML = `
        <h2>Partita terminata</h2>
        <p>Vincitori: ${gameData.state.winners}</p>
        <button onclick="window.location.href='lobby.html?gameCode=${gameCode}'">Torna alla lobby</button>
      `;
      return;
    }

    const card = document.createElement("div");
    card.innerHTML = `
      <h2>Carta Giocatore</h2>
      <div id="card" style="width:200px;height:300px;border:1px solid black;display:flex;align-items:center;justify-content:center;">
        Coperta
      </div>
      <button id="toggle-card">Mostra / Nascondi</button>
    `;
    gameArea.appendChild(card);

    let visible = false;
    document.getElementById("toggle-card").onclick = () => {
      visible = !visible;
      document.getElementById("card").textContent = visible ? player.role : "Coperta";
    };

    // La carta si gira automaticamente all'inizio per 3 secondi
    document.getElementById("card").textContent = player.role;
    setTimeout(() => {
      if (!visible) document.getElementById("card").textContent = "Coperta";
    }, 3000);
  }
}
