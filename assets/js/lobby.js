import { db, auth } from "./firebase.js";
import { ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get("gameCode");

const playersListSnapshot = {}; // manterremo l'oggetto giocatori

const gameCodeSpan = document.getElementById("game-code");
const playersList = document.getElementById("players-list");
const startButton = document.getElementById("start-game");

if (!gameCode) {
  alert("❌ Nessuna partita specificata");
} else {
  gameCodeSpan.textContent = gameCode;
  const gameRef = ref(db, "games/" + gameCode);

  // --- Lista giocatori live ---
  onValue(ref(db, `games/${gameCode}/players`), (snapshot) => {
    const players = snapshot.val() || {};
    playersListSnapshot = players;

    playersList.innerHTML = "";
    Object.values(players).forEach(player => {
      const li = document.createElement("li");
      li.textContent = `${player.name} (${player.role})`;
      playersList.appendChild(li);
    });
  });

  // --- Controllo host / guest ---
  let isHost = false;
  onValue(gameRef, async (snapshot) => {
    const data = snapshot.val();
    isHost = data.host === auth.currentUser.uid;
    startButton.disabled = !isHost;

    // Carica ruoli dal DB o dal JSON solo la prima volta
    if (!document.getElementById("roles-container")) {
      await loadRoles(isHost);
    }
  });

  startButton.addEventListener("click", async () => {
    if (!isHost) return;

    const countsEls = document.querySelectorAll(".count");
    const totalRoles = Array.from(countsEls).reduce((sum, el) => sum + parseInt(el.textContent), 0);
    const numPlayers = Object.keys(playersListSnapshot).length - 1;

    if (totalRoles !== numPlayers) {
      alert(`❌ Il numero totale di ruoli (${totalRoles}) non corrisponde ai giocatori (${numPlayers})`);
      return;
    }

    // Salva ruoli selezionati nel DB
    const rolesSelected = {};
    countsEls.forEach((el, idx) => {
      const c = parseInt(el.textContent);
      if (c > 0) rolesSelected[roles[idx].name] = c;
    });

    await set(ref(db, `games/${gameCode}/rolesSelected`), rolesSelected);
    alert("🚀 Partita avviata!");
    // Qui poi si reindirizza i giocatori alla schermata di gioco
  });
}

// --- Funzione per caricare ruoli e creare il pannello ---
async function loadRoles(isHost) {
  const response = await fetch("./assets/data/roles.json");
  roles = await response.json();

  const rolesContainer = document.createElement("div");
  rolesContainer.id = "roles-container";
  rolesContainer.innerHTML = "<h2>Impostazioni Ruoli</h2>";
  document.body.appendChild(rolesContainer);

  roles.forEach((role, index) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <strong>${role.name}</strong> - <span title="${role.description}">ℹ️</span>
      ${isHost ? `<button class="minus" data-index="${index}">-</button>` : ""}
      <span class="count" data-index="${index}">${role.defaultCount}</span>
      ${isHost ? `<button class="plus" data-index="${index}">+</button>` : ""}
    `;
    rolesContainer.appendChild(div);
  });

  if (isHost) {
    rolesContainer.addEventListener("click", (e) => {
      if (!e.target.dataset.index) return;
      const i = e.target.dataset.index;
      const countEl = rolesContainer.querySelector(`.count[data-index='${i}']`);
      let count = parseInt(countEl.textContent);

      if (e.target.classList.contains("plus")) {
        count++;
      } else if (e.target.classList.contains("minus") && count > 0) {
        count--;
      }
      countEl.textContent = count;
    });
  }
}
