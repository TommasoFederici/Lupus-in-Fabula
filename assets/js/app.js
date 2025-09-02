// assets/js/app.js
import { db, auth } from "./firebase.js";
import { ref, set, push, get, child } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// --- Creazione nuova partita ---
document.getElementById("new-game").addEventListener("click", async () => {
  const playerName = prompt("Inserisci il tuo nome:");
  if (!playerName) return alert("Devi inserire un nome!");

  // Codice partita casuale 5 caratteri
  const gameCode = Math.random().toString(36).substring(2, 7).toUpperCase();

  // Riferimento alla nuova partita
  const gameRef = ref(db, "games/" + gameCode);

  try {
    await set(gameRef, {
      host: auth.currentUser.uid,
      status: "waiting",
      players: {
        [auth.currentUser.uid]: { name: playerName }
      }
    });
    alert(`✅ Partita creata! Codice: ${gameCode}`);
  } catch (err) {
    console.error(err);
    alert("❌ Errore nella creazione della partita");
  }
});

// --- Join a partita esistente ---
document.getElementById("join-game").addEventListener("click", async () => {
  const playerName = prompt("Inserisci il tuo nome:");
  if (!playerName) return alert("Devi inserire un nome!");

  const gameCode = prompt("Inserisci il codice della partita:");
  if (!gameCode) return;

  const gameRef = ref(db, "games/" + gameCode.toUpperCase());

  try {
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) {
      alert("❌ Partita non trovata!");
      return;
    }

    // Aggiungi giocatore
    const playerRef = ref(db, `games/${gameCode.toUpperCase()}/players/${auth.currentUser.uid}`);
    await set(playerRef, { name: playerName });

    alert("✅ Sei entrato nella partita!");
  } catch (err) {
    console.error(err);
    alert("❌ Errore nell'unirsi alla partita");
  }
});
