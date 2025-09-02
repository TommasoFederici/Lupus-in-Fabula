import { db, auth } from "./firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Prendi gameCode dall'URL
const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");

const gameCodeSpan = document.getElementById("game-code");
const playersList = document.getElementById("players-list");
const startButton = document.getElementById("start-game");

if (!gameCode) {
  alert("❌ Nessuna partita specificata");
} else {
  gameCodeSpan.textContent = gameCode;

  const gameRef = ref(db, "games/" + gameCode);

  // Aggiornamento live dei giocatori
  onValue(ref(db, `games/${gameCode}/players`), (snapshot) => {
    const players = snapshot.val();
    playersList.innerHTML = "";

    if (players) {
      Object.values(players).forEach(player => {
        const li = document.createElement("li");
        li.textContent = `${player.name} (${player.role})`;
        playersList.appendChild(li);
      });
    }
  });

  // Solo l'host può iniziare la partita
  onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    if (data.host === auth.currentUser.uid) {
      startButton.disabled = false;
    } else {
      startButton.disabled = true;
    }
  });

  startButton.addEventListener("click", async () => {
    alert("🚀 Partita iniziata! (qui aggiungeremo logica di gioco)");
    // Qui poi aggiorneremo lo status della partita
  });
}
