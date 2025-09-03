// assets/js/game.js
import { db, auth } from "./firebase.js";
import { ref, onValue, get, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");
const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;
let currentPlayerData = null;
let isHost = false;

auth.onAuthStateChanged(async (user) => {
  if (!user) return alert("Utente non autenticato!");
  currentUser = user;

  const snap = await get(ref(db, `games/${gameCode}/players/${user.uid}`));
  if (!snap.exists()) return alert("Non sei nella partita!");

  currentPlayerData = snap.val();
  isHost = currentPlayerData.role === "host";

  if (isHost) {
    document.getElementById("narrator-view").style.display = "block";
    setupNarrator();
  } else {
    document.getElementById("player-view").style.display = "block";
    setupPlayer();
  }
});

// ===============================
// 🔹 PLAYER SCREEN
function setupPlayer() {
  const cardContainer = document.getElementById("player-card-container");
  if (!cardContainer) return;

  const card = document.createElement("div");
  card.classList.add("player-card");
  card.textContent = "Ruolo: ???";
  let revealed = false;

  const toggleBtn = document.getElementById("toggle-card");
  toggleBtn.addEventListener("click", () => {
    revealed = !revealed;
    card.textContent = revealed ? `Ruolo: ${currentPlayerData.gameRole}` : "Ruolo: ???";
  });

  cardContainer.appendChild(card);
}

// ===============================
// 🔹 NARRATOR SCREEN
async function setupNarrator() {
  const togglePhaseBtn = document.getElementById("toggle-phase-btn");
  const tableContainer = document.getElementById("narrator-table-container");

  // Aggiorna fase
  onValue(ref(db, `games/${gameCode}/state`), async (snap) => {
    const state = snap.val() || {};
    const phase = state.phase || "night";
    togglePhaseBtn.textContent = phase === "night" ? "Passa al giorno" : "Passa alla notte";
    await renderNarratorTable(phase);
  });

  togglePhaseBtn.addEventListener("click", async () => {
    const snap = await get(ref(db, `games/${gameCode}/state`));
    const phase = snap.val()?.phase || "night";
    const newPhase = phase === "night" ? "day" : "night";

    await update(ref(db, `games/${gameCode}/state`), { phase: newPhase });

    if (phase === "night") await processNightResults();
  });
}

// ===============================
// 🔹 RENDER TABELLONE NARRATORE
async function renderNarratorTable(phase) {
  const tableContainer = document.getElementById("narrator-table-container");
  tableContainer.innerHTML = "";

  const playersSnap = await get(ref(db, `games/${gameCode}/players`));
  const players = playersSnap.val();
  const activePlayers = Object.entries(players).filter(([uid, p]) => p.role !== "host");

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

  // Rows
  activePlayers.forEach(([uid, p]) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = p.name;
    row.appendChild(nameCell);

    const roleCell = document.createElement("td");
    roleCell.textContent = p.gameRole;
    row.appendChild(roleCell);

    if (phase === "night") {
      ["killedByWolves", "savedByPuttana", "lovers", "muted"].forEach((action, i) => {
        const cell = document.createElement("td");
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.addEventListener("change", async () => {
          const nightRef = ref(db, `games/${gameCode}/nightActions`);
          const snap = await get(nightRef);
          let arr = snap.exists() ? snap.val()[action] : null;

          if (action === "savedByPuttana" || action === "muted") {
            await update(nightRef, { [action]: chk.checked ? uid : null });
          } else {
            arr = arr || [];
            arr = arr.filter(id => id !== uid);
            if (chk.checked) arr.push(uid);
            await update(nightRef, { [action]: arr });
          }
        });
        cell.appendChild(chk);
        row.appendChild(cell);
      });
    } else {
      const stateCell = document.createElement("td");
      stateCell.textContent = p.isAlive ? "Vivo" : "Morto";
      row.appendChild(stateCell);

      const actionCell = document.createElement("td");
      const btn = document.createElement("button");
      btn.textContent = p.isAlive ? "Elimina" : "Resuscita";
      btn.addEventListener("click", async () => {
        await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: !p.isAlive });
      });
      actionCell.appendChild(btn);
      row.appendChild(actionCell);
    }

    table.appendChild(row);
  });

  // Prima notte: Mitomane
  const stateSnap = await get(ref(db, `games/${gameCode}/state/nightNumber`));
  const nightNumber = stateSnap.exists() ? stateSnap.val() : 1;
  if (phase === "night" && nightNumber === 1) {
    const mitDiv = document.createElement("div");
    mitDiv.textContent = "Cambia ruolo Mitomane:";
    const select = document.createElement("select");
    activePlayers.forEach(([uid, p]) => {
      const opt = document.createElement("option");
      opt.value = uid;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
    select.addEventListener("change", async () => {
      await update(ref(db, `games/${gameCode}/nightActions`), { mitomaneChange: select.value });
    });
    mitDiv.appendChild(select);
    tableContainer.appendChild(mitDiv);
  }

  tableContainer.appendChild(table);
}

// ===============================
// 🔹 PROCESS NIGHT LOGIC
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
    if (uid === saved) return;
    const isLover = lovers.includes(uid);
    if (isLover) lovers.forEach(l => { updated[l] = false; });
    else updated[uid] = false;
  });

  for (let uid in updated) {
    await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: updated[uid] });
  }

  const nightSnap = await get(ref(db, `games/${gameCode}/state/nightNumber`));
  const nightNumber = nightSnap.exists() ? nightSnap.val() : 1;
  await update(ref(db, `games/${gameCode}/state`), { nightNumber: nightNumber + 1 });

  await update(ref(db, `games/${gameCode}/nightActions`), {});
}
