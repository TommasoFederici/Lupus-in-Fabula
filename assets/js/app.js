import { db } from "./firebase.js";
import { ref, set, push } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Funzione per creare una nuova partita
function createNewGame() {
  // Genera un codice partita casuale di 5 caratteri
  const gameCode = Math.random().toString(36).substring(2, 7).toUpperCase();

  // Riferimento al nodo "games" nel DB
  const gameRef = ref(db, "games/" + gameCode);

  // Scrivi nel DB
  set(gameRef, {
    createdAt: Date.now(),
    status: "waiting",
    players: {}
  })
    .then(() => {
      alert(`Partita creata! Codice: ${gameCode}`);
    })
    .catch((error) => {
      console.error("Errore durante la creazione della partita:", error);
    });
}

document.getElementById("new-game").addEventListener("click", createNewGame);

document.getElementById("join-game").addEventListener("click", () => {
  alert("Qui metteremo la logica per unirsi a una partita esistente.");
});
