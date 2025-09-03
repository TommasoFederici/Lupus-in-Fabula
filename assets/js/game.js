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

  // 🔄 Ascolta cambiamenti di stato e di giocatori → aggiorna tabella in tempo reale
  onValue(ref(db, `games/${gameCode}/state`), async (snap) => {
    const state = snap.val();
    const phase = state?.phase || "night";
    togglePhaseBtn.textContent = phase === "night" ? "Passa al giorno" : "Passa alla notte";
    await renderNarratorTable(phase);
  });

  onValue(ref(db, `games/${gameCode}/players`), async () => {
    const snap = await get(ref(db, `games/${gameCode}/state`));
    const phase = snap.exists() ? snap.val().phase : "night";
    await renderNarratorTable(phase);
  });

  togglePhaseBtn.addEventListener("click", async () => {
    const snap = await get(ref(db, `games/${gameCode}/state`));
    const phase = snap.val()?.phase || "night";
    const newPhase = phase === "night" ? "day" : "night";

    if (phase === "night") {
      await processNightResults();
    }

    // Reset muto a inizio giorno
    if (newPhase === "day") {
      const playersSnap = await get(ref(db, `games/${gameCode}/players`));
      const players = playersSnap.val();
      for (let uid in players) {
        await update(ref(db, `games/${gameCode}/players/${uid}`), { isMuted: false });
      }
      const actionsSnap = await get(ref(db, `games/${gameCode}/nightActions`));
      if (actionsSnap.exists() && actionsSnap.val().muted) {
        const mutedUid = actionsSnap.val().muted;
        await update(ref(db, `games/${gameCode}/players/${mutedUid}`), { isMuted: true });
      }
    }

    await update(ref(db, `games/${gameCode}/state`), { phase: newPhase });
  });
}

// ==================================================
// 🔹 RENDER TABELLONE NARRATORE
async function renderNarratorTable(phase) {
  const container = document.getElementById("players-narrator");
  container.innerHTML = "";

  const playersSnap = await get(ref(db, `games/${gameCode}/players`));
  const players = playersSnap.val();
  const activePlayers = Object.entries(players).filter(([uid, p]) => p.role !== "host");

  const rolesSnap = await get(ref(db, `games/${gameCode}/roles`));
  const roles = rolesSnap.exists() ? rolesSnap.val() : {};
  const roleNames = Object.keys(roles).filter(r => roles[r].count > 0);

  // Prima notte → Mitomane
  const stateSnap = await get(ref(db, `games/${gameCode}/state/nightNumber`));
  const nightNumber = stateSnap.exists() ? stateSnap.val() : 1;

  activePlayers.forEach(([uid, p]) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.gameRole})`;

    if (phase === "night") {
      // Casella Ucciso (tutti tranne i Lupi)
      if (roleNames.includes("Lupo") && p.gameRole !== "Lupo") {
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.addEventListener("change", async () => {
          const refArr = ref(db, `games/${gameCode}/nightActions/killed`);
          const snap = await get(refArr);
          let arr = snap.exists() ? snap.val() : [];
          arr = arr.filter(id => id !== uid);
          if (chk.checked) arr.push(uid);
          await update(ref(db, `games/${gameCode}/nightActions`), { killed: arr });
        });
        li.append(" | Ucciso ", chk);
      }

      // Casella Salvato (se c'è la Puttana)
      if (roleNames.includes("Puttana")) {
        const chk = document.createElement("input");
        chk.type = "radio";
        chk.name = "puttana";
        chk.addEventListener("change", async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { saved: uid });
        });
        li.append(" | Salvato ", chk);
      }

      // Casella Amanti (solo sui giocatori Amante)
      if (roleNames.includes("Amante") && p.gameRole === "Amante") {
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.addEventListener("change", async () => {
          const refArr = ref(db, `games/${gameCode}/nightActions/lovers`);
          const snap = await get(refArr);
          let arr = snap.exists() ? snap.val() : [];
          arr = arr.filter(id => id !== uid);
          if (chk.checked) arr.push(uid);
          await update(ref(db, `games/${gameCode}/nightActions`), { lovers: arr });
        });
        li.append(" | Amante ", chk);
      }

      // Casella Muto (se c’è il Muto e il player non è Muto)
      if (roleNames.includes("Muto") && p.gameRole !== "Muto") {
        const chk = document.createElement("input");
        chk.type = "radio";
        chk.name = "muto";
        chk.addEventListener("change", async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { muted: uid });
        });
        li.append(" | Muto ", chk);
      }

      // Mitomane prima notte
      if (nightNumber === 1 && p.gameRole === "Mitomane") {
        const select = document.createElement("select");
        roleNames.forEach(rn => {
          if (rn !== "Mitomane") {
            const opt = document.createElement("option");
            opt.value = rn;
            opt.textContent = rn;
            select.appendChild(opt);
          }
        });
        select.addEventListener("change", async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { mitomaneRole: select.value });
        });
        li.append(" | Nuovo ruolo: ", select);
      }

    } else {
      // Giorno: mostra stato e pulsante elimina/resuscita
      li.append(` | Stato: ${p.isAlive ? "Vivo" : "Morto"}`);
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

  // Aggiornamenti
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
