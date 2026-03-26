// assets/js/app.js
import { db, auth } from "./firebase.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import * as ui from "./ui.js";

// ── Partite salvate in localStorage ───────────────────────────────────────────
const LS_KEY = "lif_games";

function getSavedGames() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? []; }
  catch { return []; }
}

function saveGame(gameCode, name) {
  const games = getSavedGames().filter(g => g.gameCode !== gameCode);
  games.unshift({ gameCode, name });
  localStorage.setItem(LS_KEY, JSON.stringify(games.slice(0, 10)));
}

function removeGame(gameCode) {
  const games = getSavedGames().filter(g => g.gameCode !== gameCode);
  localStorage.setItem(LS_KEY, JSON.stringify(games));
}

// ── Render partite attive sulla home ──────────────────────────────────────────
async function renderActiveGames() {
  const saved = getSavedGames();
  const section = document.getElementById("active-games");
  const list    = document.getElementById("active-games-list");
  if (!section || !list || saved.length === 0) return;

  let user;
  try { user = await requireAuth(); } catch { return; }

  section.style.display = "block";
  list.innerHTML = "";

  for (const { gameCode, name } of saved) {
    const snap = await get(ref(db, `games/${gameCode}`));

    if (!snap.exists()) {
      removeGame(gameCode);
      continue;
    }

    const gameData = snap.val();
    const status   = gameData.state?.status ?? "waiting";
    const inGame   = !!gameData.players?.[user.uid];

    if (!inGame) {
      removeGame(gameCode);
      continue;
    }

    if (status === "closed") {
      removeGame(gameCode);
      continue;
    }

    const statusLabel = { waiting: "In lobby", running: "In corso", ended: "Terminata" }[status] ?? status;
    const statusClass = { waiting: "status--waiting", running: "status--running", ended: "status--ended" }[status] ?? "";
    const isHost      = gameData.players[user.uid]?.role === "host";
    const dest        = status === "running" ? `game?gameCode=${gameCode}` : `lobby?gameCode=${gameCode}`;

    const row = document.createElement("div");
    row.className = "active-game-row";
    row.innerHTML = `
      <span class="active-game-code">${gameCode}</span>
      <div class="active-game-info">
        <strong>${name}</strong>
        ${isHost ? "Narratore" : "Giocatore"} · <span class="active-game-status ${statusClass}">${statusLabel}</span>
      </div>
      <button class="btn-rejoin">Rientra</button>
      <button class="btn-remove-game" title="Rimuovi">✕</button>`;

    row.querySelector(".btn-rejoin").addEventListener("click", () => {
      window.location.href = dest;
    });
    row.querySelector(".btn-remove-game").addEventListener("click", () => {
      removeGame(gameCode);
      row.remove();
      if (list.children.length === 0) section.style.display = "none";
    });

    list.appendChild(row);
  }

  if (list.children.length === 0) section.style.display = "none";
}

// Aspetta che Firebase completi il login anonimo.
// Su un nuovo dispositivo onAuthStateChanged spara null prima che signInAnonymously
// completi: ignoriamo i null e aspettiamo il vero user (con timeout di sicurezza).
function requireAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) return; // sessione non ancora pronta, continua ad aspettare
      unsub();
      resolve(user);
    });
    setTimeout(() => { unsub(); reject(new Error("Auth timeout")); }, 10000);
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

    saveGame(gameCode, playerName);
    window.location.href = `lobby?gameCode=${gameCode}`;

  } catch (err) {
    console.error(err);
    await ui.alert("Errore nella creazione della partita.", { icon: "❌" });
  }
});

// --- Unirsi a partita esistente ---
document.getElementById("join-game").addEventListener("click", async () => {
  const rawCode = await ui.prompt("Inserisci il codice della partita:", {
    icon: "🔑",
    title: "Unisciti a una Partita",
    placeholder: "Es. AB3XZ"
  });
  if (!rawCode) return;

  let user;
  try { user = await requireAuth(); }
  catch { await ui.alert("Accesso anonimo non riuscito. Ricarica la pagina.", { icon: "🔒" }); return; }

  const gameCode = rawCode.trim().toUpperCase();
  const gameRef  = ref(db, "games/" + gameCode);

  let snapshot;
  try { snapshot = await get(gameRef); }
  catch (err) { await ui.alert("Errore di connessione.", { icon: "❌" }); return; }

  if (!snapshot.exists()) {
    await ui.alert("Partita non trovata.", { icon: "🔍" });
    return;
  }

  const gameData = snapshot.val();
  if (gameData.state?.status === "running") {
    await ui.alert("Questa partita è già in corso.", { icon: "🚫" });
    return;
  }

  // Già dentro? Rientra direttamente
  if (gameData.players?.[user.uid]) {
    saveGame(gameCode, gameData.players[user.uid].name);
    window.location.href = `lobby?gameCode=${gameCode}`;
    return;
  }

  // Tutti i nomi già presi, incluso il narratore
  const existingNames = Object.values(gameData.players ?? {})
    .map(p => p.name.trim().toLowerCase());

  const playerName = await ui.prompt("Come ti chiami?", {
    icon: "🐺",
    placeholder: "Il tuo nome…",
    validate: (v) => {
      if (!v) return null;
      if (existingNames.includes(v.toLowerCase())) return `"${v}" è già in uso — scegli un altro nome.`;
      return null;
    }
  });
  if (!playerName) return;

  try {
    await set(ref(db, `games/${gameCode}/players/${user.uid}`), {
      uid:     user.uid,
      name:    playerName,
      role:    "guest",
      isAlive: true,
      gameRole: null,
      isMuted: false
    });

    saveGame(gameCode, playerName);
    window.location.href = `lobby?gameCode=${gameCode}`;

  } catch (err) {
    console.error(err);
    await ui.alert("Errore nell'unirsi alla partita.", { icon: "❌" });
  }
});

// ── Mostra partite salvate all'avvio ──────────────────────────────────────────
renderActiveGames();
