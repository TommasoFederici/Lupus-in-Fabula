// assets/js/game.js
import { db, auth } from "./firebase.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const gameCode = params.get("gameCode");

// Riferimenti
const playerView = document.getElementById("player-view");
const narratorView = document.getElementById("narrator-view");
const roleCard = document.getElementById("role-card");
const toggleCardBtn = document.getElementById("toggle-card");

// Setup iniziale
onValue(ref(db, `games/${gameCode}`), snapshot => {
  if (!snapshot.exists()) return;
  const gameData = snapshot.val();
  const players = gameData.players || {};
  const state = gameData.state || {};

  const me = players[auth.currentUser.uid];
  if (!me) return;

  // Player normale
  if (me.role === "guest") {
    playerView.style.display = "block";
    narratorView.style.display = "none";
    roleCard.textContent = me.gameRole || "In attesa...";
  }

  // Narratore
  if (me.role === "host") {
    playerView.style.display = "none";
    narratorView.style.display = "block";
    renderNarratorTable(players, state);
  }
});

// Toggle carta ruolo
if (toggleCardBtn) {
  toggleCardBtn.addEventListener("click", () => {
    roleCard.classList.toggle("hidden");
  });
}

// --- Funzioni utili ---
function labelWrap(label, input) {
  const span = document.createElement("label");
  span.style.marginLeft = "10px";
  span.appendChild(document.createTextNode(label + " "));
  span.appendChild(input);
  return span;
}

function renderNarratorTable(players, gameState) {
  const container = document.getElementById("players-narrator");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(players).forEach(([uid, player]) => {
    const row = document.createElement("div");
    row.classList.add("narrator-row");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${player.name} (${player.gameRole || "?"})`;
    if (!player.isAlive) nameSpan.style.textDecoration = "line-through";
    row.appendChild(nameSpan);

    // Casella Ucciso (solo di notte, non per i lupi)
    if (gameState.phase === "night" && player.gameRole !== "lupo") {
      const killBox = document.createElement("input");
      killBox.type = "checkbox";
      killBox.checked = !!player.markedKilled;
      killBox.addEventListener("change", () => {
        update(ref(db, `games/${gameCode}/players/${uid}`), {
          markedKilled: killBox.checked
        });
      });
      row.appendChild(labelWrap("Ucciso", killBox));
    }

    // Casella Salvato (solo di notte)
    if (gameState.phase === "night") {
      const saveBox = document.createElement("input");
      saveBox.type = "checkbox";
      saveBox.checked = !!player.markedSaved;
      saveBox.addEventListener("change", () => {
        update(ref(db, `games/${gameCode}/players/${uid}`), {
          markedSaved: saveBox.checked
        });
      });
      row.appendChild(labelWrap("Salvato", saveBox));
    }

    // Casella Amanti (solo se il player è amante)
    if (gameState.phase === "night" && player.gameRole === "amante") {
      const loveBox = document.createElement("input");
      loveBox.type = "checkbox";
      loveBox.checked = !!player.isSleepingWith;
      loveBox.addEventListener("change", () => {
        update(ref(db, `games/${gameCode}/players/${uid}`), {
          isSleepingWith: loveBox.checked
        });
      });
      row.appendChild(labelWrap("Amanti", loveBox));
    }

    // Casella Muto (solo se il player non è muto)
    if (gameState.phase === "night" && player.gameRole !== "muto") {
      const muteBox = document.createElement("input");
      muteBox.type = "checkbox";
      muteBox.checked = !!player.mutato;
      muteBox.addEventListener("change", () => {
        update(ref(db, `games/${gameCode}/players/${uid}`), {
          mutato: muteBox.checked
        });
      });
      row.appendChild(labelWrap("Muto", muteBox));
    }

    // Mitomane (solo prima notte, se presente)
    if (gameState.phase === "night" && gameState.nightCount === 1 && player.gameRole === "mitomane") {
      const select = document.createElement("select");
      ["lupo", "veggente", "puttana", "amante", "muto"].forEach(role => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        update(ref(db, `games/${gameCode}/players/${uid}`), {
          copiedRole: select.value
        });
      });
      row.appendChild(labelWrap("Diventa", select));
    }

    // Tasti elimina/resuscita (solo di giorno)
    if (gameState.phase === "day") {
      const killBtn = document.createElement("button");
      killBtn.textContent = "Elimina";
      killBtn.addEventListener("click", () => {
        update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: false });
      });

      const resBtn = document.createElement("button");
      resBtn.textContent = "Resuscita";
      resBtn.addEventListener("click", () => {
        update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: true });
      });

      row.appendChild(killBtn);
      row.appendChild(resBtn);
    }

    container.appendChild(row);
  });
}
