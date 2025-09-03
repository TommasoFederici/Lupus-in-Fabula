// assets/js/game.js
import { db, auth } from "./firebase.js";
import { ref, onValue, get, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");

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

// ==============================
// PLAYER VIEW
// ==============================
function setupPlayer() {
  const container = document.getElementById("player-view");
  if (!container) return;

  container.style.display = "block";
  const card = document.getElementById("role-card");
  const toggleBtn = document.getElementById("toggle-card");

  let revealed = false;
  card.textContent = "Ruolo: ???";

  toggleBtn.addEventListener("click", () => {
    revealed = !revealed;
    card.textContent = revealed ? `Ruolo: ${currentPlayerData.gameRole}` : "Ruolo: ???";
  });
}

// ==============================
// NARRATOR VIEW
// ==============================
async function setupNarrator() {
  const container = document.getElementById("narrator-view");
  if (!container) return;
  container.style.display = "block";

  const togglePhaseBtn = document.getElementById("toggle-phase-btn");

  // Listener globale sul DB per aggiornare tabella giocatori in tempo reale
  onValue(ref(db, `games/${gameCode}`), async (snap) => {
    const game = snap.val();
    const phase = game.state?.phase || "night";
    const nightNumber = game.state?.nightNumber || 1;

    togglePhaseBtn.textContent = phase === "night" ? "Passa al giorno" : "Passa alla notte";
    await renderNarratorTable(phase, game.players, nightNumber, game.roles);
  });

  togglePhaseBtn.addEventListener("click", async () => {
    const snap = await get(ref(db, `games/${gameCode}/state`));
    const phase = snap.val()?.phase || "night";
    const newPhase = phase === "night" ? "day" : "night";

    await update(ref(db, `games/${gameCode}/state`), { phase: newPhase });

    if (phase === "night") await processNightResults();
  });

  // End game button
  document.getElementById("end-game-btn")?.addEventListener("click", async () => {
    await update(ref(db, `games/${gameCode}/state`), { status: "waiting", phase: "night" });
    const playersSnap = await get(ref(db, `games/${gameCode}/players`));
    const players = playersSnap.val();
    for (let uid in players) {
      if (players[uid].role !== "host") {
        await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: true, gameRole: null });
      }
    }
  });
}

// ==============================
// RENDER NARRATOR TABLE
// ==============================
async function renderNarratorTable(phase, players, nightNumber, roles) {
  const tableContainer = document.getElementById("players-narrator");
  if (!tableContainer) return;
  tableContainer.innerHTML = "";

  const activePlayers = Object.entries(players).filter(([uid, p]) => p.role !== "host");

  // Table
  const table = document.createElement("table");
  table.classList.add("narrator-table");

  // Header
  const header = document.createElement("tr");
  const headers = ["Giocatore", "Ruolo"];
  if (phase === "night") headers.push("Lupo", "Puttana", "Amanti", "Muto");
  else headers.push("Stato", "Elimina/Resuscita");

  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    header.appendChild(th);
  });
  table.appendChild(header);

  activePlayers.forEach(([uid, p]) => {
    const row = document.createElement("tr");

    // Nome
    const nameCell = document.createElement("td");
    nameCell.textContent = p.name;
    row.appendChild(nameCell);

    // Ruolo
    const roleCell = document.createElement("td");
    roleCell.textContent = p.gameRole || "-";
    row.appendChild(roleCell);

    if (phase === "night") {
      // Checkbox per Lupo
      const wolfCell = document.createElement("td");
      const wolfChk = document.createElement("input");
      wolfChk.type = "checkbox";
      wolfChk.checked = false;
      wolfChk.addEventListener("change", async () => {
        const refNight = ref(db, `games/${gameCode}/nightActions/killedByWolves`);
        const snap = await get(refNight);
        let arr = snap.exists() ? snap.val() : [];
        arr = arr.filter(id => id !== uid);
        if (wolfChk.checked) arr.push(uid);
        await update(ref(db, `games/${gameCode}/nightActions`), { killedByWolves: arr });
      });
      wolfCell.appendChild(wolfChk);
      row.appendChild(wolfCell);

      // Checkbox Puttana
      const puttanaCell = document.createElement("td");
      const puttanaChk = document.createElement("input");
      puttanaChk.type = "checkbox";
      puttanaChk.addEventListener("change", async () => {
        await update(ref(db, `games/${gameCode}/nightActions`), { savedByPuttana: puttanaChk.checked ? uid : null });
      });
      puttanaCell.appendChild(puttanaChk);
      row.appendChild(puttanaCell);

      // Checkbox Amanti
      const loversCell = document.createElement("td");
      const loversChk = document.createElement("input");
      loversChk.type = "checkbox";
      loversChk.addEventListener("change", async () => {
        const refNight = ref(db, `games/${gameCode}/nightActions/lovers`);
        const snap = await get(refNight);
        let arr = snap.exists() ? snap.val() : [];
        arr = arr.filter(id => id !== uid);
        if (loversChk.checked) arr.push(uid);
        await update(ref(db, `games/${gameCode}/nightActions`), { lovers: arr });
      });
      loversCell.appendChild(loversChk);
      row.appendChild(loversCell);

      // Checkbox Muto
      const mutoCell = document.createElement("td");
      const mutoChk = document.createElement("input");
      mutoChk.type = "checkbox";
      mutoChk.addEventListener("change", async () => {
        await update(ref(db, `games/${gameCode}/nightActions`), { muted: mutoChk.checked ? uid : null });
      });
      mutoCell.appendChild(mutoChk);
      row.appendChild(mutoCell);
    } else {
      // Giorno: stato + elimina/resuscita
      const stateCell = document.createElement("td");
      stateCell.textContent = p.isAlive ? "Vivo" : "Morto";
      row.appendChild(stateCell);

      const actionCell = document.createElement("td");
      const btn = document.createElement("button");

      function updateBtnText() {
        btn.textContent = p.isAlive ? "Elimina" : "Resuscita";
      }
      updateBtnText();

      btn.addEventListener("click", async () => {
        p.isAlive = !p.isAlive;
        await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: p.isAlive });
        updateBtnText();
      });

      actionCell.appendChild(btn);
      row.appendChild(actionCell);
    }

    table.appendChild(row);
  });

  tableContainer.appendChild(table);

  // =======================
  // Prima notte: Mitomane
  // =======================
  if (phase === "night" && nightNumber === 1) {
    const mitomane = activePlayers.find(([uid, p]) => p.gameRole === "Mitomane");
    if (mitomane) {
      const mitDiv = document.createElement("div");
      mitDiv.textContent = "Mitomane: scegli ruolo da copiare:";
      const select = document.createElement("select");

      roles.forEach(r => {
        const countEl = document.getElementById(`role-count-${r.name}`);
        if (countEl && parseInt(countEl.textContent) > 0) {
          const opt = document.createElement("option");
          opt.value = r.name;
          opt.textContent = r.name;
          select.appendChild(opt);
        }
      });

      select.addEventListener("change", async () => {
        await update(ref(db, `games/${gameCode}/nightActions`), { mitomaneChange: select.value });
      });

      mitDiv.appendChild(select);
      tableContainer.appendChild(mitDiv);
    }
  }
}

// ==============================
// PROCESS NIGHT
// ==============================
async function processNightResults() {
  const actionsSnap = await get(ref(db, `games/${gameCode}/nightActions`));
  const actions = actionsSnap.exists() ? actionsSnap.val() : {};

  const playersSnap = await get(ref(db, `games/${gameCode}/players`));
  const players = playersSnap.val();
  const updated = {};

  const killed = actions.killedByWolves || [];
  const saved = actions.savedByPuttana || null;
  const lovers = actions.lovers || [];

  killed.forEach(uid => {
    if (uid === saved) return; // salvato
    const isLover = lovers.includes(uid);
    if (isLover) lovers.forEach(l => { updated[l] = false; });
    else updated[uid] = false;
  });

  // Cambia ruolo Mitomane se necessario
  if (actions.mitomaneChange) {
    const mitUid = Object.entries(players).find(([uid, p]) => p.gameRole === "Mitomane")[0];
    await update(ref(db, `games/${gameCode}/players/${mitUid}`), { gameRole: actions.mitomaneChange });
  }

  for (let uid in updated) {
    await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: updated[uid] });
  }

  const nightSnap = await get(ref(db, `games/${gameCode}/state/nightNumber`));
  const nightNumber = nightSnap.exists() ? nightSnap.val() : 1;
  await update(ref(db, `games/${gameCode}/state`), { nightNumber: nightNumber + 1 });

  // Pulizia azioni notte
  await update(ref(db, `games/${gameCode}/nightActions`), {});
}
