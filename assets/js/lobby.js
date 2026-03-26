// assets/js/lobby.js
import { db, auth } from "./firebase.js";
import {
  ref, onValue, set, update, get, remove
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { ROLES } from "./engine/roles.js";
import { ROLE_DATA, CATEGORIES } from "./engine/roleData.js";
import * as ui from "./ui.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode  = urlParams.get("gameCode");

if (!gameCode) {
  window.location.href = "/";
}

const gameRef = ref(db, `games/${gameCode}`);

let currentUser = null;
let isHost      = false;

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${target}`)?.classList.add("active");
  });
});

// ── Wiki modal ────────────────────────────────────────────────────────────────
document.getElementById("wiki-close-btn").addEventListener("click", () => {
  document.getElementById("role-wiki-modal").style.display = "none";
});

function openRoleWiki(roleName) {
  const data = ROLE_DATA[roleName];
  if (!data) return;
  const cat = CATEGORIES.find(c => c.id === data.categoria);

  document.getElementById("wiki-emoji").textContent     = data.emoji;
  document.getElementById("wiki-role-name").textContent = roleName;

  const badge = document.getElementById("wiki-faction-badge");
  badge.textContent        = cat?.label ?? data.categoria;
  badge.style.background   = cat?.bg    ?? "#1a1a1a";
  badge.style.color        = cat?.color ?? "#ccc";
  badge.style.borderColor  = (cat?.color ?? "#ccc") + "60";

  const body = document.getElementById("wiki-modal-body");
  body.innerHTML = "";

  // ── Card: Informazioni Fazione
  const factionNames = { lupi: "Lupi", villaggio: "Villaggio", neutrale: "Neutrale" };
  const factionCard = _card(
    `<h3 class="wiki-card-title">ℹ️ Informazioni Fazione</h3>
     <div class="wiki-info-grid">
       <div class="wiki-info-row">
         <span class="wiki-info-label">Fazione reale</span>
         <span class="wiki-info-value" style="color:${cat?.color ?? '#fff'}">${factionNames[data.categoria] ?? data.categoria}</span>
       </div>
       <div class="wiki-info-row">
         <span class="wiki-info-label">Appare come</span>
         <span class="wiki-info-value">${data.fazioneApparente}</span>
       </div>
     </div>
     <p class="wiki-long-desc">${data.descrizioneLunga}</p>`,
    "wiki-card-faction",
    (cat?.color ?? "#888") + "45"
  );
  body.appendChild(factionCard);

  // ── Card: Meccaniche
  if (data.meccaniche.length > 0) {
    const mechCard = _card(
      `<h3 class="wiki-card-title">⚙️ Meccaniche di Gioco</h3>
       <ul class="wiki-list">${data.meccaniche.map(m => `<li>${m}</li>`).join("")}</ul>`,
      "wiki-card-mechanics",
      "rgba(80,120,200,0.35)"
    );
    body.appendChild(mechCard);
  }

  // ── Card: Abilità
  if (data.abilita.length > 0) {
    const abilitaHtml = data.abilita.map(a => `
      <div class="wiki-ability">
        <div class="wiki-ability-name">⚡ ${a.nome}</div>
        <div class="wiki-ability-desc">${a.desc}</div>
      </div>`).join("");
    const abilCard = _card(
      `<h3 class="wiki-card-title">⚡ Abilità</h3>${abilitaHtml}`,
      "wiki-card-abilities",
      "rgba(200,140,40,0.4)"
    );
    body.appendChild(abilCard);
  }

  document.getElementById("role-wiki-modal").style.display = "flex";
}

function _card(innerHTML, extraClass, borderColor) {
  const div = document.createElement("div");
  div.className = `wiki-card ${extraClass}`;
  div.style.borderColor = borderColor;
  div.innerHTML = innerHTML;
  return div;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  currentUser = user;
  setupLobby();
});

// ── Setup ─────────────────────────────────────────────────────────────────────
async function setupLobby() {
  onValue(gameRef, async (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;

    isHost = gameData.host === currentUser.uid;
    const devMode = gameData.state?.devMode ?? false;

    document.getElementById("game-code").textContent = gameCode;

    renderPlayers(gameData.players ?? {}, gameData.host, devMode);
    await loadRoles(gameData.roles ?? {});

    // Tab Opzioni visibile solo all'host
    const settingsTab = document.getElementById("tab-btn-settings");
    if (settingsTab) settingsTab.style.display = isHost ? "flex" : "none";

    if (isHost) {
      const skipChk = document.getElementById("skip-first-night");
      if (skipChk) skipChk.checked = gameData.state?.skipFirstNight ?? false;

      const devChk = document.getElementById("dev-mode");
      if (devChk) devChk.checked = devMode;

      const startBtn = document.getElementById("start-game-btn");
      startBtn.style.display = "block";
      if (!startBtn.dataset.listener) {
        startBtn.addEventListener("click", startGame);
        startBtn.dataset.listener = "1";
      }
    }

    const devSection = document.getElementById("dev-section");
    if (devSection) devSection.style.display = (isHost && devMode) ? "block" : "none";

    renderRoleCounts(gameData.roles ?? {});

    if (gameData.state?.status === "running") {
      window.location.href = `game?gameCode=${gameCode}`;
    }
  });

  document.getElementById("game-code-bar")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(gameCode).then(() => ui.toast("✓ Codice copiato!"));
  });

  document.getElementById("skip-first-night")?.addEventListener("change", (e) => {
    if (!isHost) return;
    update(ref(db, `games/${gameCode}/state`), { skipFirstNight: e.target.checked });
  });

  document.getElementById("dev-mode")?.addEventListener("change", (e) => {
    if (!isHost) return;
    update(ref(db, `games/${gameCode}/state`), { devMode: e.target.checked });
  });

  document.getElementById("add-bot-btn")?.addEventListener("click", addBot);
}

// ── Players ───────────────────────────────────────────────────────────────────
function renderPlayers(players, hostId, devMode) {
  const container = document.getElementById("players-list");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(players).forEach(([uid, p]) => {
    const div = document.createElement("div");
    div.className = "player-item";

    const nameSpan = document.createElement("span");
    let text = p.isBot ? `🤖 ${p.name}` : p.name;
    if (uid === currentUser.uid) text += " (Tu)";
    if (uid === hostId)          text += " ⭐";
    nameSpan.textContent = text;
    div.appendChild(nameSpan);

    if (isHost && p.isBot && devMode) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "✕";
      removeBtn.className = "btn-remove-bot";
      removeBtn.addEventListener("click", () => removeBot(uid));
      div.appendChild(removeBtn);
    }

    container.appendChild(div);
  });
}

async function addBot() {
  const snap    = await get(ref(db, `games/${gameCode}/players`));
  const players = snap.val() ?? {};
  const botCount = Object.values(players).filter(p => p.isBot).length;
  const botUid   = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  await set(ref(db, `games/${gameCode}/players/${botUid}`), {
    name: `Bot ${botCount + 1}`, role: "guest",
    isAlive: true, isBot: true, gameRole: null, isMuted: false
  });
}

async function removeBot(uid) {
  await remove(ref(db, `games/${gameCode}/players/${uid}`));
}

// ── Roles — grouped by category ───────────────────────────────────────────────
async function loadRoles(dbRoles) {
  const container = document.getElementById("roles-list");
  if (!container) return;
  container.innerHTML = "";

  // Mappa nome → oggetto role per lookup rapido
  const roleByName = {};
  for (const r of Object.values(ROLES)) roleByName[r.nome] = r;

  for (const cat of CATEGORIES) {
    // Ruoli di questa categoria
    const ruoliCat = Object.values(ROLES).filter(r => r.fazione === cat.id);
    if (ruoliCat.length === 0) continue;

    // Intestazione categoria
    const header = document.createElement("div");
    header.className = "role-category-header";
    header.innerHTML = `
      <span class="role-category-dot" style="background:${cat.color}"></span>
      <span class="role-category-label" style="color:${cat.color}">${cat.label}</span>`;
    container.appendChild(header);

    // Righe ruoli
    for (const ruolo of ruoliCat) {
      const wikiData = ROLE_DATA[ruolo.nome];
      const row = document.createElement("div");
      row.className = "role-row";
      row.dataset.faction = ruolo.fazione;

      // ── Riga superiore: emoji + nome + [ⓘ]
      const top = document.createElement("div");
      top.className = "role-row-top";

      const emoji = document.createElement("span");
      emoji.className = "role-row-emoji";
      emoji.textContent = wikiData?.emoji ?? "•";

      const name = document.createElement("span");
      name.className = "role-row-name";
      name.textContent = ruolo.nome;

      const infoBtn = document.createElement("button");
      infoBtn.className = "role-row-info-btn";
      infoBtn.title = "Scheda ruolo";
      infoBtn.textContent = "ⓘ";
      infoBtn.addEventListener("click", () => openRoleWiki(ruolo.nome));

      top.append(emoji, name, infoBtn);
      row.appendChild(top);

      // ── Riga inferiore: descrizione breve + contatore
      const bottom = document.createElement("div");
      bottom.className = "role-row-bottom";

      const desc = document.createElement("span");
      desc.className = "role-row-desc";
      desc.textContent = ruolo.descrizione;

      bottom.appendChild(desc);

      if (isHost) {
        const controls = document.createElement("div");
        controls.className = "role-row-controls";

        const minus = document.createElement("button");
        minus.textContent = "−";
        minus.className = "btn-count";
        minus.addEventListener("click", () => updateRole(ruolo.nome, -1));

        const countEl = document.createElement("span");
        countEl.id = `role-count-${ruolo.nome}`;
        countEl.className = "role-row-count";
        countEl.textContent = dbRoles[ruolo.nome]?.count ?? ruolo.defaultCount;

        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.className = "btn-count";
        plus.addEventListener("click", () => updateRole(ruolo.nome, +1));

        controls.append(minus, countEl, plus);
        bottom.appendChild(controls);

        // Inizializza Firebase se assente
        const roleRef = ref(db, `games/${gameCode}/roles/${ruolo.nome}`);
        const existing = await get(roleRef);
        if (!existing.exists()) {
          set(roleRef, { count: ruolo.defaultCount, description: ruolo.descrizione });
        }
      } else {
        const countEl = document.createElement("span");
        countEl.id = `role-count-${ruolo.nome}`;
        countEl.className = "role-row-count role-row-count--readonly";
        countEl.textContent = dbRoles[ruolo.nome]?.count ?? ruolo.defaultCount;
        bottom.appendChild(countEl);
      }

      row.appendChild(bottom);
      container.appendChild(row);
    }
  }

  updateRolesCounter();
}

function updateRole(roleName, delta) {
  const el = document.getElementById(`role-count-${roleName}`);
  let newCount = parseInt(el.textContent) + delta;
  if (newCount < 0) newCount = 0;
  el.textContent = newCount;
  update(ref(db, `games/${gameCode}/roles/${roleName}`), { count: newCount });
  updateRolesCounter();
}

function renderRoleCounts(dbRoles) {
  for (const [nome, data] of Object.entries(dbRoles)) {
    const el = document.getElementById(`role-count-${nome}`);
    if (el) el.textContent = data.count ?? 0;
  }
  updateRolesCounter();
}

function updateRolesCounter() {
  const counter = document.getElementById("roles-counter");
  if (!counter) return;
  let total = 0;
  Object.values(ROLES).forEach(r => {
    const el = document.getElementById(`role-count-${r.nome}`);
    if (el) total += parseInt(el.textContent) || 0;
  });
  counter.textContent = total > 0 ? `${total} ruoli assegnati` : "Nessun ruolo selezionato";
}

// ── Start game ────────────────────────────────────────────────────────────────
async function startGame() {
  const snapshot = await get(ref(db, `games/${gameCode}/players`));
  if (!snapshot.exists()) return;

  const players       = snapshot.val();
  const activePlayers = Object.keys(players).filter(uid => players[uid].role !== "host");

  const rolePool = [];
  for (const ruolo of Object.values(ROLES)) {
    const el    = document.getElementById(`role-count-${ruolo.nome}`);
    const count = el ? parseInt(el.textContent) : 0;
    for (let i = 0; i < count; i++) rolePool.push(ruolo.nome);
  }

  if (rolePool.length !== activePlayers.length) {
    await ui.alert(
      `Ruoli (${rolePool.length}) ≠ giocatori (${activePlayers.length}).\nAggiusta i contatori nel tab Ruoli.`,
      { icon: "⚖️" }
    );
    return;
  }

  for (let i = rolePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }

  const updates = {};
  activePlayers.forEach((uid, index) => {
    updates[`players/${uid}/gameRole`] = rolePool[index];
    updates[`players/${uid}/isAlive`]  = true;
    updates[`players/${uid}/isMuted`]  = false;
  });
  updates["state/status"]      = "running";
  updates["state/phase"]       = "night";
  updates["state/nightNumber"] = 1;

  await update(ref(db, `games/${gameCode}`), updates);
}
