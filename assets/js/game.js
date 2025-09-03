// assets/js/game.js
import { db, auth } from "./firebase.js";
import { ref, onValue, get, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");
const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;
let isHost = false;
let currentPlayerData = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) return alert("Utente non autenticato!");
  currentUser = user;

  const snap = await get(ref(db, `games/${gameCode}/players/${user.uid}`));
  if (!snap.exists()) return alert("Non sei nella partita!");

  currentPlayerData = snap.val();
  isHost = currentPlayerData.role === "host";

  // Listener globale per fine partita (redirect lobby)
  onValue(ref(db, `games/${gameCode}/state`), (snap) => {
    const state = snap.val();
    if (state?.status === "ended") {
      window.location.href = `lobby.html?gameCode=${gameCode}`;
    }
  });

  if (isHost) setupNarrator();
  else setupPlayer();
});

// ==================================================
// 🔹 PLAYER SCREEN
function setupPlayer() {
  document.getElementById("player-view").style.display = "block";

  const roleCard = document.getElementById("role-card");
  const toggleBtn = document.getElementById("toggle-card");

  let revealed = false;
  toggleBtn.addEventListener("click", () => {
    revealed = !revealed;
    roleCard.textContent = revealed ? `Ruolo: ${currentPlayerData.gameRole}` : "Ruolo: ???";
  });
}

// ==================================================
// 🔹 NARRATOR SCREEN
async function setupNarrator() {
  document.getElementById("narrator-view").style.display = "block";
  const togglePhaseBtn = document.getElementById("toggle-phase-btn");

  // Ascolta DB in tempo reale
  onValue(gameRef, async (snap) => {
    const gameData = snap.val();
    if (!gameData) return;

    const phase = gameData.state?.phase || "night";
    togglePhaseBtn.textContent = phase === "night" ? "Passa al giorno" : "Passa alla notte";

    await renderNarratorTable(phase, gameData);
  });

  togglePhaseBtn.addEventListener("click", async () => {
    const snap = await get(ref(db, `games/${gameCode}/state`));
    const phase = snap.val()?.phase || "night";
    const newPhase = phase === "night" ? "day" : "night";

    if (phase === "night") await processNightResults(); // aggiorna stato giocatori

    await update(ref(db, `games/${gameCode}/state`), { phase: newPhase });
  });
}

// ==================================================
// 🔹 RENDER TABELLONE NARRATORE
async function renderNarratorTable(phase, gameData) {
  const container = document.getElementById("players-narrator");
  container.innerHTML = "";

  const players = gameData.players || {};
  let activePlayers = Object.entries(players).filter(([uid, p]) => p.role !== "host");

  if (phase === "night") {
    // rimuove i giocatori morti dalla view di notte
    activePlayers = activePlayers.filter(([uid, p]) => p.isAlive);
  }

  const roles = Object.keys(gameData.roles || {}).filter(r => gameData.roles[r].count > 0);
  const nightNumber = gameData.state?.nightNumber || 1;

  activePlayers.forEach(([uid, p]) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.gameRole})`;

    if (phase === "night") {
      // Casella Ucciso (tutti tranne Lupi)
      if (roles.includes("Lupo") && p.gameRole !== "Lupo") {
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = (gameData.nightActions?.killed || []).includes(uid);
        chk.addEventListener("change", async () => {
          let arr = gameData.nightActions?.killed || [];
          arr = arr.filter(id => id !== uid);
          if (chk.checked) arr.push(uid);
          await update(ref(db, `games/${gameCode}/nightActions`), { killed: arr });
        });
        li.append(" | Ucciso ", chk);
      }

      // Casella Salvato (solo se c'è la Puttana)
      if (roles.includes("Puttana")) {
        const chk = document.createElement("input");
        chk.type = "radio";
        chk.name = "puttana";
        chk.checked = gameData.nightActions?.saved === uid;
        chk.addEventListener("change", async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { saved: uid });
        });
        li.append(" | Salvato ", chk);
      }

      // Casella Amanti (solo se il player è Amante)
      if (roles.includes("Amante") && p.gameRole === "Amante") {
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = (gameData.nightActions?.lovers || []).includes(uid);
        chk.addEventListener("change", async () => {
          let arr = gameData.nightActions?.lovers || [];
          arr = arr.filter(id => id !== uid);
          if (chk.checked) arr.push(uid);
          await update(ref(db, `games/${gameCode}/nightActions`), { lovers: arr });
        });
        li.append(" | Amante ", chk);
      }

      // Casella Muto
      if (roles.includes("Muto") && p.gameRole !== "Muto") {
        const chk = document.createElement("input");
        chk.type = "radio";
        chk.name = "muto";
        chk.checked = gameData.nightActions?.muted === uid;
        chk.addEventListener("change", async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { muted: uid });
        });
        li.append(" | Muto ", chk);
      }

      // Mitomane prima notte
      if (nightNumber === 1 && p.gameRole === "Mitomane") {
        const select = document.createElement("select");
        roles.filter(rn => rn !== "Mitomane").forEach(rn => {
          const opt = document.createElement("option");
          opt.value = rn;
          opt.textContent = rn;
          if (gameData.nightActions?.mitomaneRole === rn) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { mitomaneRole: select.value });
        });
        li.append(" | Nuovo ruolo: ", select);
      }
    } else {
      // Giorno: stato vivo/morto + tasto elimina/resuscita
      const stateSpan = document.createElement("span");
      stateSpan.textContent = ` | Stato: ${p.isAlive ? "Vivo" : "Morto"}`;
      li.append(stateSpan);

      const btn = document.createElement("button");
      btn.textContent = p.isAlive ? "Elimina" : "Resuscita";
      btn.addEventListener("click", async () => {
        await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: !p.isAlive });
      });
      li.append(" ", btn);
    }

    container.appendChild(li);
  });
}

// ==================================================
// 🔹 PROCESS NIGHT LOGIC
async function processNightResults() {
  const actionsSnap = await get(ref(db, `games/${gameCode}/nightActions`));
  const actions = actionsSnap.exists() ? actionsSnap.val() : {};

  const playersSnap = await get(ref(db, `games/${gameCode}/players`));
  const players = playersSnap.val();

  const killed = actions.killed || [];
  const saved = actions.saved || null;
  const lovers = actions.lovers || [];
  const muted = actions.muted || null;

  // Aggiorna lo stato dei giocatori
  for (let uid of killed) {
    if (uid === saved) continue;
    if (lovers.includes(uid)) {
      for (let l of lovers) {
        await update(ref(db, `games/${gameCode}/players/${l}`), { isAlive: false });
      }
    } else {
      await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: false });
    }
  }

  // Gestione Muto
  if (muted) {
    await update(ref(db, `games/${gameCode}/players/${muted}`), { isMuted: true });
  }

  // Mitomane (prima notte)
  const stateSnap = await get(ref(db, `games/${gameCode}/state/nightNumber`));
  const nightNumber = stateSnap.exists() ? stateSnap.val() : 1;
  if (nightNumber === 1 && actions.mitomaneRole) {
    const mitUid = Object.keys(players).find(uid => players[uid].gameRole === "Mitomane");
    if (mitUid) {
      await update(ref(db, `games/${gameCode}/players/${mitUid}`), { gameRole: actions.mitomaneRole });
    }
  }

  // Incrementa numero notti
  await update(ref(db, `games/${gameCode}/state`), { nightNumber: nightNumber + 1 });

  // Pulizia azioni notte
  await update(ref(db, `games/${gameCode}/nightActions`), {});
}

// ==================================================
// 🔹 TERMINA PARTITA
document.getElementById("end-game-btn").addEventListener("click", async () => {
  await update(ref(db, `games/${gameCode}/state`), { status: "ended" });
});
