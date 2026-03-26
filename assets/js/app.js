// assets/js/app.js
import { db, auth } from "./firebase.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import * as ui from "./ui.js";

// Aspetta che Firebase abbia stabilito lo stato di auth (evita race condition)
function requireAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      if (user) resolve(user);
      else reject(new Error("Non autenticato"));
    });
    setTimeout(() => reject(new Error("Auth timeout")), 6000);
  });
}

// --- Creazione nuova partita ---
document.getElementById("new-game").addEventListener("click", async () => {
  const playerName = await ui.prompt("Come ti chiami?", {
    icon: "🐺",
    title: "Nuova Partita",
    placeholder: "Il tuo nome…"
  });
  if (!playerName) return;

  let user;
  try { user = await requireAuth(); }
  catch { await ui.alert("Accesso anonimo non riuscito. Ricarica la pagina.", { icon: "🔒" }); return; }

  const gameCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  const gameRef  = ref(db, "games/" + gameCode);

  try {
    await set(gameRef, {
      host: user.uid,
      state: { status: "waiting" },
      players: {
        [user.uid]: {
          name:    playerName,
          role:    "host",
          isAlive: true,
          gameRole: null,
          isMuted: false
        }
      }
    });

    window.location.href = `lobby?gameCode=${gameCode}`;

  } catch (err) {
    console.error(err);
    await ui.alert("Errore nella creazione della partita.", { icon: "❌" });
  }
});

// --- Unirsi a partita esistente ---
document.getElementById("join-game").addEventListener("click", async () => {
  const playerName = await ui.prompt("Come ti chiami?", {
    icon: "🐺",
    title: "Unisciti a una Partita",
    placeholder: "Il tuo nome…"
  });
  if (!playerName) return;

  const rawCode = await ui.prompt("Inserisci il codice della partita:", {
    icon: "🔑",
    placeholder: "Es. AB3XZ"
  });
  if (!rawCode) return;

  let user;
  try { user = await requireAuth(); }
  catch { await ui.alert("Accesso anonimo non riuscito. Ricarica la pagina.", { icon: "🔒" }); return; }

  const gameCode = rawCode.toUpperCase();
  const gameRef  = ref(db, "games/" + gameCode);

  try {
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) {
      await ui.alert("Partita non trovata.", { icon: "🔍" });
      return;
    }

    const gameData = snapshot.val();
    if (gameData.state?.status !== "waiting") {
      await ui.alert("Questa partita è già iniziata o terminata.", { icon: "🚫" });
      return;
    }

    const playerRef = ref(db, `games/${gameCode}/players/${user.uid}`);
    await set(playerRef, {
      uid:     user.uid,
      name:    playerName,
      role:    "guest",
      isAlive: true,
      gameRole: null,
      isMuted: false
    });

    window.location.href = `lobby?gameCode=${gameCode}`;

  } catch (err) {
    console.error(err);
    await ui.alert("Errore nell'unirsi alla partita.", { icon: "❌" });
  }
});
