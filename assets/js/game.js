// assets/js/game.js
import { db, auth } from "./firebase.js";
import {
  ref, onValue, get, update, push
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { ROLES, playerEsceNotte } from "./engine/roles.js";
import { processaNotte } from "./engine/nightEngine.js";
import { formatLogEntry } from "./engine/eventLog.js";
import * as ui from "./ui.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode  = urlParams.get("gameCode");
const gameRef   = ref(db, `games/${gameCode}`);

let currentUser       = null;
let isHost            = false;
let currentPlayerData = null;

// ── Wizard state (notte) ───────────────────────────────────────────────────
let wizardStep      = 0;
let wizardDone      = false;
let lastNightNumber = -1;
let lastGameData    = null;
let lastSkipFirst   = false;
let wizardRuoli     = [];

const ROLE_EMOJI = {
  "Lupo": "🐺", "Sciamano": "🔮", "Figlio del Lupo": "🌕",
  "Contadino": "🌾", "Veggente": "🔭", "Puttana": "🏠",
  "Investigatore": "🕵️", "Muto": "🤐", "Prete": "✝️",
  "Kamikaze": "💥", "Amante": "💘", "Mitomane": "🎭",
  "Folle": "🃏", "Corvo": "🐦‍⬛",
  "Miss Purple": "💜", "Ammaestratore": "🦁", "Boia": "🪓",
  "Indemoniato": "😈", "Illusionista": "🪄", "Bugiardo": "🤥",
  "Lupo Ciccione": "🍔", "Lupo Cieco": "🙈", "Lupo Mannaro": "🌕",
  "Genio": "🧞‍♂️", "Medium": "🕯️", "Angelo": "😇",
  "Giustiziere": "⚔️", "Massone": "🧱", "Mutaforma": "👽",
  "Simbionte": "🧬", "Parassita": "🦠", "Mucca Mannara": "🐮"
};
const FACTION_COLOR = {
  lupi: "#e05060", villaggio: "#40c0c0", neutrale: "#a080e0",
  mannari: "#d4884a", alieni: "#44c4c4", parassita: "#88cc44", solitari: "#cc8844"
};

// ── Safe mode: stack annulla ultima azione ─────────────────────────────────
// Ogni entry: { descrizione: string, applica: async () => void }
let undoStack = [];

function pushUndo(descrizione, applica) {
  undoStack.push({ descrizione, applica });
  updateUndoBtn();
}

function updateUndoBtn() {
  const btn = document.getElementById("undo-btn");
  if (!btn) return;
  const last = undoStack.at(-1);
  btn.disabled = undoStack.length === 0;
  btn.textContent = last
    ? `↩ Annulla: ${last.descrizione}`
    : "↩ Nessuna azione da annullare";
}

// ──────────────────────────────────────────────────────────────────────────────
let gameSetup = false;
auth.onAuthStateChanged(async (user) => {
  if (!user) { await ui.alert("Utente non autenticato.", { icon: "🔒" }); return; }
  if (gameSetup) return;
  gameSetup = true;
  currentUser = user;

  const snap = await get(ref(db, `games/${gameCode}/players/${user.uid}`));
  if (!snap.exists()) { await ui.alert("Non sei in questa partita.", { icon: "🚫" }); return; }

  currentPlayerData = snap.val();
  isHost = currentPlayerData.role === "host";

  onValue(ref(db, `games/${gameCode}/state/status`), (s) => {
    if (s.val() === "ended") window.location.href = `lobby?gameCode=${gameCode}`;
  });

  if (isHost) setupNarrator();
  else        setupPlayer();
});

// ══════════════════════════════════════════════════════════════════════════════
// PLAYER VIEW
// ══════════════════════════════════════════════════════════════════════════════
function setupPlayer() {
  document.getElementById("player-view").style.display = "block";

  const roleCard  = document.getElementById("role-card");
  const toggleBtn = document.getElementById("toggle-card");
  const statusEl  = document.getElementById("player-status");

  function showRole() {
    roleCard.textContent = currentPlayerData.gameRole ?? "???";
    roleCard.classList.add("revealed");
    toggleBtn.classList.add("holding");
  }
  function hideRole() {
    roleCard.textContent = "???";
    roleCard.classList.remove("revealed");
    toggleBtn.classList.remove("holding");
  }

  toggleBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    showRole();
  });
  toggleBtn.addEventListener("pointerup",     hideRole);
  toggleBtn.addEventListener("pointerleave",  hideRole);
  toggleBtn.addEventListener("pointercancel", hideRole);
  // Blocca il menu contestuale su mobile (long-press)
  toggleBtn.addEventListener("contextmenu", (e) => e.preventDefault());

  onValue(ref(db, `games/${gameCode}/players/${currentUser.uid}`), (snap) => {
    const p = snap.val();
    if (!p) return;
    currentPlayerData = p;

    const stati = [];
    if (!p.isAlive) stati.push("💀 Sei morto");
    if (p.isMuted)  stati.push("🤐 Sei silenziato oggi");

    statusEl.textContent   = stati.join(" · ");
    statusEl.style.display = stati.length ? "block" : "none";

    // nessun aggiornamento live necessario: il ruolo è visibile solo mentre si tiene premuto
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// NARRATOR VIEW
// ══════════════════════════════════════════════════════════════════════════════
function setupNarrator() {
  document.getElementById("narrator-view").style.display = "block";

  onValue(gameRef, (snap) => {
    const gameData = snap.val();
    if (!gameData) return;
    renderNarratorView(gameData);
  });

  document.getElementById("toggle-phase-btn").addEventListener("click", handlePhaseToggle);
  document.getElementById("end-game-btn").addEventListener("click", handleEndGame);
  document.getElementById("summary-close").addEventListener("click", closeSummaryModal);

  // Undo button
  const undoBtn = document.getElementById("undo-btn");
  undoBtn?.addEventListener("click", async () => {
    if (!undoStack.length) return;
    const { applica } = undoStack.pop();
    await applica();
    updateUndoBtn();
  });
  updateUndoBtn();

  // Copy log button (solo host)
  const copyLogBtn = document.getElementById("copy-log-btn");
  if (copyLogBtn) {
    copyLogBtn.style.display = isHost ? "inline-flex" : "none";
    copyLogBtn.addEventListener("click", copyLogToClipboard);
  }
}

function renderNarratorView(gameData) {
  lastGameData = gameData;

  const phase       = gameData.state?.phase        ?? "night";
  const nightNumber = gameData.state?.nightNumber   ?? 1;
  const skipFirst   = gameData.state?.skipFirstNight ?? false;

  // Reset wizard quando inizia una nuova notte
  if (nightNumber !== lastNightNumber) {
    wizardStep      = 0;
    wizardDone      = false;
    lastNightNumber = nightNumber;
  }

  document.getElementById("phase-indicator").textContent =
    phase === "night" ? `🌙 Notte ${nightNumber}` : `☀️ Giorno ${nightNumber - 1}`;

  document.getElementById("toggle-phase-btn").textContent =
    phase === "night" ? "☀️ Alba — Processa notte" : "🌙 Cala la notte";

  if (phase === "night") {
    document.getElementById("night-section").style.display = "block";
    document.getElementById("day-section").style.display   = "none";
    renderNightDashboard(gameData, skipFirst);
  } else {
    document.getElementById("night-section").style.display = "none";
    document.getElementById("day-section").style.display   = "block";
    renderDayTable(gameData);
    renderVoting(gameData);
  }

  renderEventLog(gameData.log ?? {}, gameData.players ?? {});
}

// ──────────────────────────────────────────────────────────────────────────────
// NIGHT WIZARD — un ruolo alla volta
// ──────────────────────────────────────────────────────────────────────────────
function renderNightDashboard(gameData, skipFirst) {
  lastSkipFirst = skipFirst;
  const container = document.getElementById("night-dashboard");
  container.innerHTML = "";

  const azioni        = gameData.nightActions ?? {};
  const players       = gameData.players      ?? {};
  const stato         = gameData.state        ?? {};
  const rolesDB       = gameData.roles        ?? {};
  const tempFeedback  = gameData.tempFeedback ?? {};
  const devMode       = stato.devMode ?? false;
  const nomiAttivi    = Object.keys(rolesDB).filter(n => (rolesDB[n]?.count ?? 0) > 0);
  const activePlayers = Object.entries(players).filter(([, p]) => p.role !== "host" && p.isAlive);

  const albaBtn = document.getElementById("toggle-phase-btn");

  const firstNightMode = skipFirst && (stato.nightNumber ?? 1) === 1;

  wizardRuoli = Object.values(ROLES)
    .filter(r => r.attivoNotte && nomiAttivi.includes(r.nome))
    .sort((a, b) => a.prioritaNotte - b.prioritaNotte);

  if (wizardRuoli.length === 0) {
    container.innerHTML = "<p class='empty-msg'>Nessun ruolo attivo questa notte.</p>";
    if (albaBtn) albaBtn.disabled = false;
    return;
  }

  if (albaBtn) albaBtn.disabled = firstNightMode ? false : !wizardDone;

  if (wizardDone) {
    renderNightRecap(container, gameData, activePlayers, players, azioni, tempFeedback);
    return;
  }

  if (firstNightMode) {
    container.insertAdjacentHTML("afterbegin",
      `<div class="skip-night-banner">🌙 Prima notte: <strong>silenzio assoluto</strong> — nessuna azione, solo presentazioni.</div>`
    );
  }

  if (wizardStep >= wizardRuoli.length) wizardStep = wizardRuoli.length - 1;

  const ruolo         = wizardRuoli[wizardStep];
  const total         = wizardRuoli.length;
  const roleColor     = FACTION_COLOR[ruolo.fazione] ?? "#e0a830";
  const emoji         = ROLE_EMOJI[ruolo.nome] ?? "•";
  const allPlayersWithRole = Object.entries(players).filter(([, p]) => p.gameRole === ruolo.nome && p.role !== "host");
  const aliveWithRole      = activePlayers.filter(([, p]) => p.gameRole === ruolo.nome);
  const powerUsed          = ruolo.flagUsato
    ? allPlayersWithRole.some(([uid]) => players[uid]?.[ruolo.flagUsato] === true)
    : false;
  const allDead            = allPlayersWithRole.length > 0 && aliveWithRole.length === 0;

  const giocatoriMap  = Object.fromEntries(activePlayers);
  const controlli     = ruolo.controlliNotte(giocatoriMap, azioni, stato, { allPlayers: players, rolesDB });
  const playersChips  = allPlayersWithRole
    .map(([, p]) => `<span class="wiz-chip${p.isAlive ? "" : " wiz-chip--dead"}">${p.isAlive ? "" : "☠ "}${p.name}</span>`)
    .join("");

  // ── Dots di progresso
  const dots = wizardRuoli.map((_, i) => {
    const cls = i < wizardStep ? "wiz-dot done" : i === wizardStep ? "wiz-dot active" : "wiz-dot";
    return `<span class="${cls}"></span>`;
  }).join("");

  const card = document.createElement("div");
  card.className = "wizard-card";
  card.innerHTML = `
    <div class="wiz-progress">
      <div class="wiz-dots">${dots}</div>
      <span class="wiz-step-lbl">Passo ${wizardStep + 1} / ${total}</span>
    </div>
    <div class="wiz-role-header">
      <span class="wiz-role-emoji">${emoji}</span>
      <h2 class="wiz-role-title" style="color:${roleColor}">${ruolo.nome.toUpperCase()}</h2>
    </div>
    ${playersChips
      ? `<div class="wiz-players-box">
           <span class="wiz-players-lbl">👁 Chiamali</span>
           <div class="wiz-chips">${playersChips}</div>
         </div>`
      : `<p class="wiz-no-players">Nessuno con questo ruolo in partita.</p>`}`;

  // ── Simplified card: prima notte, tutti morti, o potere già usato
  if (firstNightMode || allDead || powerUsed) {
    const msg = firstNightMode
      ? "🌙 Prima notte: nessuna azione — chiamalo e vai avanti."
      : allDead
        ? "💀 Questo ruolo non c'è più in gioco — chiamalo e vai avanti."
        : "⏸ Questo ruolo ha già usato il suo potere — chiamalo e vai avanti.";
    const infoP = document.createElement("p");
    infoP.className = "wiz-simplified-msg";
    infoP.textContent = msg;
    card.appendChild(infoP);

    const nav = document.createElement("div");
    nav.className = "wiz-nav";
    if (wizardStep > 0) {
      const backBtn = document.createElement("button");
      backBtn.className = "wiz-btn wiz-btn-back";
      backBtn.textContent = "← Indietro";
      backBtn.addEventListener("click", () => { wizardStep--; renderNightDashboard(lastGameData, skipFirst); });
      nav.appendChild(backBtn);
    }
    const nextBtn = document.createElement("button");
    nextBtn.className = "wiz-btn wiz-btn-next";
    nextBtn.textContent = wizardStep < total - 1 ? "Avanti →" : "✓ Completa notte →";
    nextBtn.addEventListener("click", () => {
      if (wizardStep < wizardRuoli.length - 1) { wizardStep++; } else { wizardDone = true; }
      renderNightDashboard(lastGameData, lastSkipFirst);
    });
    nav.appendChild(nextBtn);
    card.appendChild(nav);
    container.appendChild(card);
    return;
  }

  // ── Controlli azione
  const ctrlDiv = document.createElement("div");
  ctrlDiv.className = "wiz-controls";
  if (controlli?.length) {
    for (const ctrl of controlli) {
      ctrlDiv.appendChild(
        buildWizardControl(ctrl, activePlayers, azioni, rolesDB, ruolo, players, stato, tempFeedback)
      );
    }
  } else {
    ctrlDiv.innerHTML = "<p class='no-action'>Nessuna azione richiesta.</p>";
  }
  card.appendChild(ctrlDiv);

  // ── Bot random (dev mode)
  if (devMode && activePlayers.some(([, p]) => p.gameRole === ruolo.nome && p.isBot)) {
    const botBtn = document.createElement("button");
    botBtn.className = "btn-bot-random";
    botBtn.textContent = "🎲 Scelta Casuale Bot";
    botBtn.addEventListener("click", () => fillBotAction(ruolo, azioni, activePlayers, rolesDB, stato));
    card.appendChild(botBtn);
  }

  // ── Navigazione
  const nav = document.createElement("div");
  nav.className = "wiz-nav";

  if (wizardStep > 0) {
    const backBtn = document.createElement("button");
    backBtn.className = "wiz-btn wiz-btn-back";
    backBtn.textContent = "← Indietro";
    backBtn.addEventListener("click", () => {
      wizardStep--;
      renderNightDashboard(lastGameData, skipFirst);
    });
    nav.appendChild(backBtn);
  }

  const skipBtn = document.createElement("button");
  skipBtn.className = "wiz-btn wiz-btn-skip";
  skipBtn.textContent = "Salta";
  skipBtn.addEventListener("click", async () => {
    if (controlli?.length) {
      const upd = {};
      for (const ctrl of controlli) {
        ctrl.tipo === "checkbox-multi"
          ? await update(ref(db, `games/${gameCode}/nightActions/${ctrl.chiaveAzione}`), null)
          : (upd[ctrl.chiaveAzione] = null);
      }
      if (Object.keys(upd).length) await update(ref(db, `games/${gameCode}/nightActions`), upd);
    }
    await update(ref(db, `games/${gameCode}/tempFeedback`), { [ruolo.id]: null });
    if (wizardStep < wizardRuoli.length - 1) {
      wizardStep++;
    } else {
      wizardDone = true;
    }
    renderNightDashboard(lastGameData, lastSkipFirst);
  });
  nav.appendChild(skipBtn);

  const nextBtn = document.createElement("button");
  nextBtn.className = "wiz-btn wiz-btn-next";
  nextBtn.textContent = wizardStep < total - 1 ? "Avanti →" : "✓ Completa notte →";
  nextBtn.addEventListener("click", () => {
    if (wizardStep < wizardRuoli.length - 1) {
      wizardStep++;
    } else {
      wizardDone = true;
    }
    renderNightDashboard(lastGameData, lastSkipFirst);
  });
  nav.appendChild(nextBtn);

  card.appendChild(nav);
  container.appendChild(card);
}

// ── Night Recap ───────────────────────────────────────────────────────────────
function renderNightRecap(container, gameData, activePlayers, players, azioni, tempFeedback) {
  const rolesDB   = gameData.roles  ?? {};
  const stato     = gameData.state  ?? {};
  const nomiAttivi = Object.keys(rolesDB).filter(n => (rolesDB[n]?.count ?? 0) > 0);
  const ruoliNotte = Object.values(ROLES)
    .filter(r => r.attivoNotte && nomiAttivi.includes(r.nome))
    .sort((a, b) => a.prioritaNotte - b.prioritaNotte);

  // ── Calcola morti attesi ──────────────────────────────────────────────────
  const killed   = Object.keys(azioni.killed  ?? {}).filter(u => azioni.killed[u]);
  const savedUid = azioni.saved ?? null;
  const mortiAttesi = killed.filter(uid => uid !== savedUid);

  // Figlio del lupo: non muore, si trasforma
  const figlioUids = mortiAttesi.filter(uid => players[uid]?.gameRole === "Figlio del Lupo");
  const mortiReali = mortiAttesi.filter(uid => players[uid]?.gameRole !== "Figlio del Lupo");

  // ── Riga azione per ogni ruolo ────────────────────────────────────────────
  const actionRows = ruoliNotte.map(ruolo => {
    const emoji = ROLE_EMOJI[ruolo.nome] ?? "•";
    const color = FACTION_COLOR[ruolo.fazione] ?? "#e0a830";
    const controlli = ruolo.controlliNotte(Object.fromEntries(activePlayers), azioni, stato);
    let azioneText = "–";
    if (controlli?.length) {
      const ctrl = controlli[0];
      if (ctrl.tipo === "checkbox-multi") {
        const uids = Object.keys(azioni[ctrl.chiaveAzione] ?? {}).filter(k => azioni[ctrl.chiaveAzione][k]);
        azioneText = uids.length ? uids.map(uid => players[uid]?.name ?? uid).join(", ") : "Nessuno";
      } else if (ctrl.tipo === "radio") {
        const uid = azioni[ctrl.chiaveAzione];
        azioneText = uid ? (players[uid]?.name ?? uid) : "Nessuno";
      } else if (ctrl.tipo === "select-ruolo") {
        azioneText = azioni[ctrl.chiaveAzione] ?? "Nessuno";
      }
    }
    // Aggiungi feedback investigativo se presente
    const fb = tempFeedback?.[ruolo.id];
    let feedbackText = "";
    if (fb?.risultato) feedbackText = ` → <em>${fb.risultato === "lupo" ? "🐺 Lupo" : fb.risultato === "esce" ? "🚶 Esce" : fb.risultato === "innocente" ? "✅ Innocente" : "🏠 Resta"}</em>`;
    else if (fb?.roleName) feedbackText = ` → <em>🎭 ${fb.roleName}</em>`;

    return `<div class="recap-action-row">
      <span class="recap-role-name" style="color:${color}">${emoji} ${ruolo.nome}</span>
      <span class="recap-action-value">${azioneText}${feedbackText}</span>
    </div>`;
  }).join("");

  // ── Riepilogo esiti ───────────────────────────────────────────────────────
  let esiti = "";
  if (mortiReali.length === 0 && figlioUids.length === 0) {
    esiti = `<div class="recap-outcome-row recap-ok">🌙 Stanotte non è morto nessuno.</div>`;
  } else {
    mortiReali.forEach(uid => {
      esiti += `<div class="recap-outcome-row recap-death">💀 ${players[uid]?.name ?? uid} muore stanotte</div>`;
    });
    figlioUids.forEach(uid => {
      esiti += `<div class="recap-outcome-row recap-transform">🐺 ${players[uid]?.name ?? uid} si trasforma in Lupo</div>`;
    });
  }
  if (savedUid && killed.includes(savedUid)) {
    esiti += `<div class="recap-outcome-row recap-save">🏠 ${players[savedUid]?.name ?? savedUid} si salva (Puttana)</div>`;
  }

  // ── Costruisci DOM ────────────────────────────────────────────────────────
  const wrap = document.createElement("div");
  wrap.className = "recap-wrap";
  wrap.innerHTML = `
    <div class="recap-bar" id="recap-bar">
      <div class="recap-bar-header" id="recap-bar-toggle">
        <span class="recap-bar-title">✅ Tutti i ruoli completati</span>
        <span class="recap-bar-expand" id="recap-expand-icon">▼ Dettagli</span>
      </div>
      <div class="recap-full" id="recap-full" style="display:none">
        <div class="recap-section">
          <div class="recap-section-title">Azioni di stanotte</div>
          ${actionRows}
        </div>
        <div class="recap-section">
          <div class="recap-section-title">Esiti previsti</div>
          ${esiti}
        </div>
      </div>
    </div>
    <div class="recap-nav">
      <button class="wiz-btn wiz-btn-back" id="recap-back-btn">← Torna al wizard</button>
      <button class="wiz-btn wiz-btn-alba" id="recap-alba-btn">☀️ Vai all'Alba</button>
    </div>`;

  container.appendChild(wrap);

  // Toggle espandi/comprimi
  wrap.querySelector("#recap-bar-toggle").addEventListener("click", () => {
    const full = wrap.querySelector("#recap-full");
    const icon = wrap.querySelector("#recap-expand-icon");
    const open = full.style.display !== "none";
    full.style.display = open ? "none" : "block";
    icon.textContent = open ? "▼ Dettagli" : "▲ Chiudi";
  });

  // Torna al wizard
  wrap.querySelector("#recap-back-btn").addEventListener("click", () => {
    wizardDone = false;
    wizardStep = wizardRuoli.length - 1;
    renderNightDashboard(lastGameData, lastSkipFirst);
  });

  // Alba
  wrap.querySelector("#recap-alba-btn").addEventListener("click", handlePhaseToggle);
}

// ── Sentinel picker cancelled ─────────────────────────────────────────────────
const PICKER_CANCELLED = {};

// ── Player/role picker bottom sheet ──────────────────────────────────────────
function openPicker({ title, entries, multi, selectedKeys, optional }) {
  return new Promise(resolve => {
    const sheet      = document.getElementById("player-picker");
    const titleEl    = sheet.querySelector(".picker-title");
    const listEl     = sheet.querySelector(".picker-list");
    const confirmBtn = sheet.querySelector(".picker-confirm-btn");
    const closeBtn   = sheet.querySelector(".picker-close");
    const backdrop   = sheet.querySelector(".picker-backdrop");

    titleEl.textContent = title;
    const selected = new Set(Array.isArray(selectedKeys) ? selectedKeys : []);
    const allEntries = optional
      ? [{ id: "__none__", label: "Nessuno", isNone: true }, ...entries]
      : entries;

    function renderRows() {
      listEl.innerHTML = "";
      for (const entry of allEntries) {
        const isSel = selected.has(entry.id);
        const row   = document.createElement("div");
        row.className = "picker-row" + (isSel ? " selected" : "") + (entry.isNone ? " none-row" : "");
        row.innerHTML = `
          <span class="picker-row-check">${isSel ? "✓" : "○"}</span>
          <div class="picker-row-info">
            <span class="picker-row-name">${entry.label}</span>
            ${entry.sublabel ? `<span class="picker-row-sub">${entry.sublabel}</span>` : ""}
          </div>`;
        row.addEventListener("click", () => {
          if (multi) {
            if (entry.isNone) selected.clear();
            else if (isSel)   selected.delete(entry.id);
            else              selected.add(entry.id);
            renderRows();
          } else {
            closeSheet();
            resolve(entry.isNone ? null : entry.id);
          }
        });
        listEl.appendChild(row);
      }
    }

    confirmBtn.style.display = multi ? "block" : "none";
    confirmBtn.onclick = () => { closeSheet(); resolve(selected); };

    function closeSheet() {
      sheet.classList.add("closing");
      sheet.addEventListener("animationend", () => {
        sheet.style.display = "none";
        sheet.classList.remove("closing");
      }, { once: true });
    }
    const cancel = () => { closeSheet(); resolve(PICKER_CANCELLED); };
    closeBtn.onclick = cancel;
    backdrop.onclick = cancel;

    renderRows();
    sheet.style.display = "flex";
  });
}

// ── Wizard control ────────────────────────────────────────────────────────────
function buildWizardControl(ctrl, activePlayers, azioni, rolesDB, ruolo, players, stato, tempFeedback) {
  const wrapper = document.createElement("div");
  wrapper.className = "control-group";

  // Controlli speciali non-picker
  if (ctrl.tipo === "info") {
    wrapper.innerHTML = `<p class="ctrl-info-msg">🔒 ${ctrl.testo}</p>`;
    return wrapper;
  }
  if (ctrl.tipo === "info-auto") {
    wrapper.innerHTML = `<p class="ctrl-info-msg ctrl-info-auto">⚡ ${ctrl.testo}</p>`;
    return wrapper;
  }

  const labelEl = document.createElement("p");
  labelEl.className = "control-label";
  labelEl.textContent = ctrl.label;
  wrapper.appendChild(labelEl);

  // Se il controllo richiede giocatori morti, usa tutti i non-host
  const candidatePlayers = ctrl.includeDead
    ? Object.entries(players).filter(([, p]) => p.role !== "host")
    : activePlayers;

  const targets = ctrl.filtroTarget
    ? candidatePlayers.filter(([, p]) => ctrl.filtroTarget(p))
    : candidatePlayers;

  function currentDisplay() {
    if (ctrl.tipo === "checkbox-multi") {
      const keys = Object.keys(azioni[ctrl.chiaveAzione] ?? {}).filter(k => azioni[ctrl.chiaveAzione][k]);
      return keys.length ? keys.map(uid => players[uid]?.name ?? uid).join(", ") : null;
    }
    if (ctrl.tipo === "radio") {
      const uid = azioni[ctrl.chiaveAzione];
      return uid ? (players[uid]?.name ?? uid) : (ctrl.opzionale ? "Nessuno" : null);
    }
    if (ctrl.tipo === "select-ruolo") return azioni[ctrl.chiaveAzione] ?? null;
    return null;
  }

  // Bottone picker
  const selectBtn = document.createElement("button");
  selectBtn.className = "ctrl-select-btn";
  function refreshBtn() {
    const sel = currentDisplay();
    selectBtn.innerHTML = `
      <span class="${sel ? "btn-sel-value" : "btn-sel-empty"}">${sel ?? "Tocca per scegliere…"}</span>
      <span class="btn-sel-arrow">›</span>`;
  }
  refreshBtn();

  // Feedback box (persistente da tempFeedback Firebase)
  const feedbackDiv = document.createElement("div");
  feedbackDiv.className = "wiz-feedback";
  function showFeedback(res) {
    feedbackDiv.innerHTML = res
      ? `<div class="result-box result-${res.tipo}"><span class="res-icon">${res.icon ?? ""}</span>${res.text}</div>`
      : "";
  }
  showFeedback(getTempFeedbackResult(ruolo, ctrl, tempFeedback, players));

  selectBtn.addEventListener("click", async () => {
    let entries, multi;
    if (ctrl.tipo === "select-ruolo") {
      entries = Object.keys(rolesDB)
        .filter(n => n !== "Mitomane" && (rolesDB[n]?.count ?? 0) > 0)
        .map(nome => ({ id: nome, label: nome }));
      multi = false;
    } else {
      entries = targets.map(([uid, p]) => ({
        id: uid, label: p.name,
        sublabel: !p.isAlive ? "💀 Morto" : p.isBot ? "🤖 Bot" : null
      }));
      multi = ctrl.tipo === "checkbox-multi";
    }
    const currentKeys = ctrl.tipo === "checkbox-multi"
      ? Object.keys(azioni[ctrl.chiaveAzione] ?? {}).filter(k => azioni[ctrl.chiaveAzione][k])
      : azioni[ctrl.chiaveAzione] ? [azioni[ctrl.chiaveAzione]] : [];

    const picked = await openPicker({ title: ctrl.label, entries, multi, selectedKeys: currentKeys, optional: !!ctrl.opzionale });
    if (picked === PICKER_CANCELLED) return;

    const prev        = azioni[ctrl.chiaveAzione] ?? null;
    const singleValue = ctrl.tipo !== "checkbox-multi" ? (picked ?? null) : null;
    const liveResult  = singleValue !== null
      ? computeNightResultForValue(ruolo, ctrl, singleValue, players, azioni, stato)
      : null;

    if (ctrl.tipo === "checkbox-multi") {
      const newVal = {};
      if (picked instanceof Set) {
        picked.forEach(uid => { newVal[uid] = true; });
        currentKeys.forEach(uid => { if (!picked.has(uid)) newVal[uid] = null; });
      }
      await update(ref(db, `games/${gameCode}/nightActions/${ctrl.chiaveAzione}`), newVal);
      const names = picked instanceof Set && picked.size > 0
        ? [...picked].map(uid => activePlayers.find(([u]) => u === uid)?.[1]?.name ?? uid).join(", ")
        : "Nessuno";
      pushUndo(`${ctrl.label}: ${names}`, async () => {
        await update(ref(db, `games/${gameCode}/nightActions/${ctrl.chiaveAzione}`), prev ?? {});
        await update(ref(db, `games/${gameCode}/tempFeedback`), { [ruolo.id]: null });
        showFeedback(null); refreshBtn();
      });
    } else {
      await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: singleValue });
      const targetName = singleValue ? (players[singleValue]?.name ?? singleValue) : "Nessuno";
      pushUndo(`${ctrl.label} → ${targetName}`, async () => {
        await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: prev });
        await update(ref(db, `games/${gameCode}/tempFeedback`), { [ruolo.id]: null });
        showFeedback(null); refreshBtn();
      });
    }

    // Scrivi tempFeedback su Firebase per persistenza dopo reload
    if (liveResult) {
      const fbPayload = buildTempFeedbackPayload(ruolo, ctrl, singleValue, liveResult);
      if (fbPayload) await update(ref(db, `games/${gameCode}/tempFeedback`), { [ruolo.id]: fbPayload });
    }

    // Mostra feedback subito nel DOM (non aspetta il round-trip Firebase)
    showFeedback(liveResult);
    refreshBtn();
  });

  // Annulla azione
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "wiz-btn-cancel";
  cancelBtn.textContent = "✕ Annulla azione";
  cancelBtn.addEventListener("click", async () => {
    ctrl.tipo === "checkbox-multi"
      ? await update(ref(db, `games/${gameCode}/nightActions/${ctrl.chiaveAzione}`), null)
      : await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: null });
    await update(ref(db, `games/${gameCode}/tempFeedback`), { [ruolo.id]: null });
    showFeedback(null);
    refreshBtn();
  });

  wrapper.appendChild(selectBtn);
  wrapper.appendChild(feedbackDiv);
  wrapper.appendChild(cancelBtn);
  return wrapper;
}

// ── tempFeedback helpers ──────────────────────────────────────────────────────
function getTempFeedbackResult(ruolo, ctrl, tempFeedback, players) {
  const fb = tempFeedback?.[ruolo.id];
  if (!fb) return null;

  const n = (uid) => players[uid]?.name ?? uid;

  const investigaResult = (uid, ris) => ris === "lupo"
    ? { text: `${n(uid)} è un Lupo`,      tipo: "danger",  icon: "🐺" }
    : { text: `${n(uid)} è Innocente`,    tipo: "ok",      icon: "✅" };
  const spiaNotte = (uid, ris) => ris === "esce"
    ? { text: `${n(uid)} è uscito`,       tipo: "warning", icon: "🚶" }
    : { text: `${n(uid)} è restato`,      tipo: "ok",      icon: "🏠" };

  if (["Veggente","Mutaforma"].includes(ruolo.nome) && (ctrl.chiaveAzione === "investigated" || ctrl.chiaveAzione === "mutaformaSubTarget") && fb.risultato)
    return investigaResult(fb.targetUid, fb.risultato);
  if (["Investigatore","Mutaforma"].includes(ruolo.nome) && (ctrl.chiaveAzione === "watched" || ctrl.chiaveAzione === "mutaformaSubTarget") && fb.risultato)
    return spiaNotte(fb.targetUid, fb.risultato);
  if (["Medium","Mutaforma"].includes(ruolo.nome) && (ctrl.chiaveAzione === "mediumTarget" || ctrl.chiaveAzione === "mutaformaSubTarget") && fb.fazione)
    return { text: `${n(fb.targetUid)}: fazione ${fb.fazione}`, tipo: "info", icon: "🕯️" };
  if (["Mitomane","Simbionte","Genio"].includes(ruolo.nome) && fb.roleName)
    return { text: `Ruolo: ${fb.roleName}`, tipo: "info", icon: "🎭" };
  if (ruolo.nome === "Lupo Cieco" && fb.risultato)
    return fb.risultato === "si"
      ? { text: "Lupo nel trio rilevato",    tipo: "danger",  icon: "🐺" }
      : { text: "Nessun lupo nel trio",      tipo: "ok",      icon: "✅" };
  if (ruolo.nome === "Boia" && fb.risultato)
    return fb.risultato === "ok"
      ? { text: `${n(fb.targetUid)} → ✅ Indovinato`,  tipo: "danger",  icon: "🪓" }
      : { text: `Sbagliato — il Boia muore`, tipo: "warning", icon: "🪓" };
  if (ruolo.nome === "Bugiardo" && fb.ruoloScoperto)
    return { text: `${n(fb.targetUid)} era: ${fb.ruoloScoperto}`, tipo: "info", icon: "🤥" };
  if (ruolo.nome === "Miss Purple" && fb.conteggio !== undefined)
    return { text: `${fb.conteggio} lupo/i in gioco`, tipo: fb.conteggio > 0 ? "danger" : "ok", icon: "💜" };
  if (ruolo.nome === "Lupo Mannaro" && fb.risultato)
    return fb.risultato === "ok"
      ? { text: `${n(fb.targetUid)} → ✅ Caccia riuscita`, tipo: "danger", icon: "🌕" }
      : { text: `Ruolo sbagliato — caccia fallita`,        tipo: "info",   icon: "🌕" };
  return null;
}

function buildTempFeedbackPayload(ruolo, ctrl, singleValue, result) {
  if (ruolo.nome === "Veggente" && ctrl.chiaveAzione === "investigated")
    return { targetUid: singleValue, risultato: result.tipo === "danger" ? "lupo" : "innocente" };
  if (ruolo.nome === "Investigatore" && ctrl.chiaveAzione === "watched")
    return { targetUid: singleValue, risultato: result.tipo === "warning" ? "esce" : "resta" };
  if (["Mitomane","Simbionte","Genio"].includes(ruolo.nome))
    return { roleName: singleValue };
  if (ruolo.nome === "Medium" && ctrl.chiaveAzione === "mediumTarget")
    return { targetUid: singleValue, fazione: result.fazione };
  if (ruolo.nome === "Lupo Cieco" && ctrl.chiaveAzione === "ciecoTarget")
    return { risultato: result.tipo === "danger" ? "si" : "no" };
  if (ruolo.nome === "Boia" && ctrl.chiaveAzione === "boiaTarget")
    return { targetUid: singleValue, risultato: result.tipo === "danger" ? "ok" : "fail" };
  if (ruolo.nome === "Bugiardo" && ctrl.chiaveAzione === "bugiardoTarget")
    return { targetUid: singleValue, ruoloScoperto: result.ruoloScoperto };
  if (ruolo.nome === "Miss Purple")
    return { conteggio: result.conteggio };
  if (ruolo.nome === "Lupo Mannaro" && ctrl.chiaveAzione === "mannaro_target")
    return { targetUid: singleValue, risultato: result.tipo === "danger" ? "ok" : "fail" };
  if (ruolo.nome === "Mutaforma" && ctrl.chiaveAzione === "mutaformaSubTarget") {
    if (result.tipo === "danger" || result.tipo === "ok") {
      if (result.icon === "🐺" || result.icon === "✅") return { targetUid: singleValue, risultato: result.tipo === "danger" ? "lupo" : "innocente" };
      if (result.icon === "🚶" || result.icon === "🏠") return { targetUid: singleValue, risultato: result.tipo === "warning" ? "esce" : "resta" };
    }
    if (result.fazione) return { targetUid: singleValue, fazione: result.fazione };
  }
  return null;
}

// ── Night result (live, prima del round-trip Firebase) ────────────────────────
function computeNightResultForValue(ruolo, ctrl, newValue, players, azioni, stato) {
  if (!newValue) return null;
  const target = players[newValue];

  // Veggente / Mutaforma-come-Veggente
  if ((ruolo.nome === "Veggente" && ctrl.chiaveAzione === "investigated") ||
      (ruolo.nome === "Mutaforma" && ctrl.chiaveAzione === "mutaformaSubTarget" && players[azioni.mutaformaTarget]?.gameRole === "Veggente")) {
    if (!target) return null;
    const isSciamano = azioni["sciamanoTarget"] === newValue;
    const roleObj    = Object.values(ROLES).find(r => r.nome === target.gameRole);
    const baseFaz    = roleObj?.fazioneApparente ?? roleObj?.fazione ?? "villaggio";
    const isLupo     = isSciamano ? baseFaz !== "lupi" : baseFaz === "lupi";
    return isLupo
      ? { text: `${target.name} è un Lupo`,   tipo: "danger", icon: "🐺" }
      : { text: `${target.name} è Innocente`, tipo: "ok",     icon: "✅" };
  }

  // Investigatore / Mutaforma-come-Investigatore
  if ((ruolo.nome === "Investigatore" && ctrl.chiaveAzione === "watched") ||
      (ruolo.nome === "Mutaforma" && ctrl.chiaveAzione === "mutaformaSubTarget" && players[azioni.mutaformaTarget]?.gameRole === "Investigatore")) {
    if (!target) return null;
    const esce = playerEsceNotte(newValue, target, { saved: azioni["saved"] ?? null, lovers: azioni["lovers"] ?? {} }, stato ?? {});
    return esce
      ? { text: `${target.name} è uscito di casa`,   tipo: "warning", icon: "🚶" }
      : { text: `${target.name} è rimasto in casa`,  tipo: "ok",      icon: "🏠" };
  }

  // Medium / Mutaforma-come-Medium
  if ((ruolo.nome === "Medium" && ctrl.chiaveAzione === "mediumTarget") ||
      (ruolo.nome === "Mutaforma" && ctrl.chiaveAzione === "mutaformaSubTarget" && players[azioni.mutaformaTarget]?.gameRole === "Medium")) {
    if (!target) return null;
    const roleObj = Object.values(ROLES).find(r => r.nome === target.gameRole);
    const fazione = roleObj?.fazione ?? "villaggio";
    return { text: `${target.name}: fazione ${fazione}`, tipo: "info", icon: "🕯️", fazione };
  }

  // Lupo Cieco — il trio viene calcolato approssimativamente lato client
  if (ruolo.nome === "Lupo Cieco" && ctrl.chiaveAzione === "ciecoTarget") {
    const viviUids = Object.entries(players).filter(([, p]) => p.isAlive && p.role !== "host").map(([u]) => u);
    const idx = viviUids.indexOf(newValue);
    const trio = [
      viviUids[(idx - 1 + viviUids.length) % viviUids.length],
      newValue,
      viviUids[(idx + 1) % viviUids.length]
    ].filter((u, i, a) => a.indexOf(u) === i);
    const hasLupo = trio.some(u => {
      const r = Object.values(ROLES).find(rr => rr.nome === players[u]?.gameRole);
      return (r?.fazioneApparente ?? r?.fazione) === "lupi";
    });
    return hasLupo
      ? { text: "Lupo nel trio rilevato",  tipo: "danger", icon: "🙈" }
      : { text: "Nessun lupo nel trio",    tipo: "ok",     icon: "🙈" };
  }

  // Boia (feedback su boiaTarget dopo aver selezionato anche boiaRole)
  if (ruolo.nome === "Boia" && ctrl.chiaveAzione === "boiaTarget") {
    if (!target || !azioni.boiaRole) return null;
    const corretto = target.gameRole === azioni.boiaRole;
    return corretto
      ? { text: `${target.name} → ✅ Indovinato`,    tipo: "danger",  icon: "🪓" }
      : { text: `Sbagliato — il Boia muore`,          tipo: "warning", icon: "🪓" };
  }

  // Bugiardo
  if (ruolo.nome === "Bugiardo" && ctrl.chiaveAzione === "bugiardoTarget") {
    if (!target) return null;
    return { text: `${target.name} era: ${target.gameRole}`, tipo: "info", icon: "🤥", ruoloScoperto: target.gameRole };
  }

  // Lupo Mannaro (feedback su mannaro_target dopo aver selezionato mannaro_role)
  if (ruolo.nome === "Lupo Mannaro" && ctrl.chiaveAzione === "mannaro_target") {
    if (!target || !azioni.mannaro_role) return null;
    const corretto = target.gameRole === azioni.mannaro_role;
    return corretto
      ? { text: `${target.name} → ✅ Caccia riuscita`, tipo: "danger",  icon: "🌕" }
      : { text: `Ruolo sbagliato — caccia fallita`,     tipo: "info",    icon: "🌕" };
  }

  // Mitomane / Simbionte / Genio (select-ruolo)
  if (["Mitomane","Simbionte","Genio"].includes(ruolo.nome) && ctrl.tipo === "select-ruolo")
    return { text: `Ruolo: ${newValue}`, tipo: "info", icon: "🎭" };

  return null;
}

// Riempie casualmente le azioni notturne di un ruolo assegnato a un bot.
// Chiamata dal pulsante "🎲 Scelta Casuale Bot" nella dashboard.
async function fillBotAction(ruolo, azioni, activePlayers, rolesDB, stato) {
  const giocatoriMap = Object.fromEntries(activePlayers);
  const controlli    = ruolo.controlliNotte(giocatoriMap, azioni, stato);
  if (!controlli) return;

  for (const ctrl of controlli) {
    const targets = ctrl.filtroTarget
      ? activePlayers.filter(([, p]) => ctrl.filtroTarget(p))
      : activePlayers;
    if (targets.length === 0) continue;

    const pick = targets[Math.floor(Math.random() * targets.length)];

    if (ctrl.tipo === "checkbox-multi") {
      await update(ref(db, `games/${gameCode}/nightActions/${ctrl.chiaveAzione}`), {
        [pick[0]]: true
      });
    } else if (ctrl.tipo === "radio") {
      await update(ref(db, `games/${gameCode}/nightActions`), {
        [ctrl.chiaveAzione]: pick[0]
      });
    } else if (ctrl.tipo === "select-ruolo") {
      const nomiRuoli = Object.keys(rolesDB)
        .filter(n => n !== "Mitomane" && (rolesDB[n]?.count ?? 0) > 0);
      if (nomiRuoli.length > 0) {
        const randomRole = nomiRuoli[Math.floor(Math.random() * nomiRuoli.length)];
        await update(ref(db, `games/${gameCode}/nightActions`), {
          [ctrl.chiaveAzione]: randomRole
        });
      }
    }
  }
}


// ──────────────────────────────────────────────────────────────────────────────
// DAY TABLE — eliminazione/resurrezione rapida
// ──────────────────────────────────────────────────────────────────────────────
function renderDayTable(gameData) {
  const container  = document.getElementById("day-players");
  container.innerHTML = "";

  const players    = gameData.players ?? {};
  const allPlayers = Object.entries(players).filter(([, p]) => p.role !== "host");

  allPlayers.forEach(([uid, p]) => {
    const row = document.createElement("div");
    row.className = `player-row${p.isAlive ? "" : " dead"}`;

    const info = document.createElement("span");
    info.className = "player-info";
    info.innerHTML = `<strong>${p.name}</strong> <span class="role-tag">${p.gameRole ?? "?"}</span>`;
    if (p.isBot)    info.innerHTML += ` <span class="badge badge-bot">🤖 Bot</span>`;
    if (p.isMuted)  info.innerHTML += ` <span class="badge badge-muted">🤐 Silenz.</span>`;
    if (!p.isAlive) info.innerHTML += ` <span class="badge badge-dead">💀 Morto</span>`;

    const killBtn = document.createElement("button");
    killBtn.className = `quick-btn ${p.isAlive ? "btn-kill" : "btn-revive"}`;
    killBtn.textContent = p.isAlive ? "Elimina" : "Resuscita";
    killBtn.addEventListener("click", async () => {
      const willDie = p.isAlive;
      const upd = { isAlive: !p.isAlive };
      if (willDie) upd.isMuted = false;
      await update(ref(db, `games/${gameCode}/players/${uid}`), upd);
      if (willDie) await handlePassiveEffects({ tipo: "morte_giorno", uid, votanti: [] }, players);
    });

    row.append(info, killBtn);
    container.appendChild(row);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// VOTAZIONE — sezione giorno
// ──────────────────────────────────────────────────────────────────────────────
function renderVoting(gameData) {
  const container = document.getElementById("voting-section");
  if (!container) return;
  container.innerHTML = "";

  const players    = gameData.players    ?? {};
  const rolesDB    = gameData.roles      ?? {};
  const dayActions = gameData.dayActions ?? {};
  const votes      = dayActions.votes    ?? {};
  const corvoTarget = dayActions.corvoTarget ?? null;

  const alivePlayers = Object.entries(players)
    .filter(([, p]) => p.role !== "host" && p.isAlive);

  if (alivePlayers.length === 0) {
    container.innerHTML = "<p class='empty-msg'>Nessun giocatore vivo.</p>";
    return;
  }

  const hasCorvo = (rolesDB["Corvo"]?.count ?? 0) > 0;

  // Calcola totali e condannato
  const totali = {};
  for (const [uid] of alivePlayers) {
    totali[uid] = (votes[uid] ?? 0) + (hasCorvo && corvoTarget === uid ? 1 : 0);
  }
  const condannato = getCondannato(totali);

  // Header sezione
  const title = document.createElement("h3");
  title.textContent = "⚖️ Votazione";
  container.appendChild(title);

  // Riga per ogni giocatore
  alivePlayers.forEach(([uid, p]) => {
    const row = document.createElement("div");
    row.className = `vote-row${condannato === uid ? " condannato" : ""}`;

    const info = document.createElement("span");
    info.className = "vote-player";
    info.innerHTML = `<strong>${p.name}</strong> <span class="role-tag">${p.gameRole ?? "?"}</span>`;
    if (condannato === uid) info.innerHTML += ` <span class="badge badge-condannato">🔥 Condannato</span>`;

    const voteCount = document.createElement("span");
    voteCount.className = "vote-count";
    const base  = votes[uid] ?? 0;
    const bonus = hasCorvo && corvoTarget === uid ? 1 : 0;
    voteCount.textContent = bonus ? `${base + bonus} (${base}+1🪶)` : `${base}`;

    const minus = document.createElement("button");
    minus.className = "quick-btn btn-vote-minus";
    minus.textContent = "−";
    minus.disabled = base <= 0;
    minus.addEventListener("click", async () => {
      await update(ref(db, `games/${gameCode}/dayActions/votes`), { [uid]: Math.max(0, base - 1) });
    });

    const plus = document.createElement("button");
    plus.className = "quick-btn btn-vote-plus";
    plus.textContent = "+";
    plus.addEventListener("click", async () => {
      await update(ref(db, `games/${gameCode}/dayActions/votes`), { [uid]: base + 1 });
    });

    row.append(info, minus, voteCount, plus);

    // Voto Corvo
    if (hasCorvo) {
      const corvoLabel = document.createElement("label");
      corvoLabel.className = "corvo-label";
      const corvoChk = document.createElement("input");
      corvoChk.type    = "radio";
      corvoChk.name    = "corvoTarget";
      corvoChk.checked = corvoTarget === uid;
      corvoChk.addEventListener("change", async () => {
        await update(ref(db, `games/${gameCode}/dayActions`), { corvoTarget: uid });
      });
      corvoLabel.append(corvoChk, " 🪶");
      row.appendChild(corvoLabel);
    }

    container.appendChild(row);
  });

  // Pulsante Manda al Rogo
  const rogoBtn = document.createElement("button");
  rogoBtn.id = "rogo-btn";
  rogoBtn.className = "btn-rogo";
  rogoBtn.textContent = condannato
    ? `🔥 Manda al Rogo: ${players[condannato]?.name}`
    : "🔥 Manda al Rogo";
  rogoBtn.disabled = !condannato;
  rogoBtn.addEventListener("click", () => condannato && handleMandaAlRogo(condannato, players));
  container.appendChild(rogoBtn);

  // Reset voti
  const resetBtn = document.createElement("button");
  resetBtn.className = "quick-btn btn-reset-votes";
  resetBtn.textContent = "Azzera voti";
  resetBtn.addEventListener("click", async () => {
    await update(ref(db, `games/${gameCode}/dayActions`), { votes: null, corvoTarget: null });
  });
  container.appendChild(resetBtn);
}

// Restituisce l'uid del condannato, null se parità o tutti a 0
function getCondannato(totali) {
  let max = 0, winner = null, parita = false;
  for (const [uid, count] of Object.entries(totali)) {
    if (count > max) { max = count; winner = uid; parita = false; }
    else if (count === max && max > 0) { parita = true; }
  }
  return parita ? null : winner;
}

async function handleMandaAlRogo(uid, players) {
  if (!await ui.confirm(`Mandare al rogo ${players[uid]?.name}?`, {
    icon: "🔥", confirmLabel: "Al Rogo!", danger: true
  })) return;

  await update(ref(db, `games/${gameCode}/players/${uid}`), { isAlive: false, isMuted: false });
  const _giorno = (lastGameData?.state?.nightNumber ?? 2) - 1;
  await push(ref(db, `games/${gameCode}/log`), {
    tipo: "morte_giorno", uid, giorno: _giorno, timestamp: Date.now()
  });

  // Effetti passivi (Kamikaze, Folle...)
  await handlePassiveEffects({ tipo: "morte_giorno", uid, votanti: [] }, players);

  // Azzera voti
  await update(ref(db, `games/${gameCode}/dayActions`), { votes: null, corvoTarget: null });
}

// ──────────────────────────────────────────────────────────────────────────────
// EFFETTI PASSIVI
// ──────────────────────────────────────────────────────────────────────────────
async function handlePassiveEffects(evento, giocatori) {
  const fbUpdates = {};
  const evLog     = [];

  for (const ruolo of Object.values(ROLES)) {
    const { aggiornamenti, logEventi: ev } = ruolo.effettoPassivo(evento, giocatori, {});
    for (const { uid, campi } of aggiornamenti) {
      for (const [k, v] of Object.entries(campi)) {
        fbUpdates[`games/${gameCode}/players/${uid}/${k}`] = v;
      }
    }
    evLog.push(...ev);
  }

  if (Object.keys(fbUpdates).length) await update(ref(db), fbUpdates);
  const _giornoPassivo = (lastGameData?.state?.nightNumber ?? 2) - 1;
  for (const e of evLog) await push(ref(db, `games/${gameCode}/log`), { ...e, giorno: _giornoPassivo });
}

// ──────────────────────────────────────────────────────────────────────────────
// PHASE TOGGLE
// ──────────────────────────────────────────────────────────────────────────────
async function handlePhaseToggle() {
  const btn = document.getElementById("toggle-phase-btn");
  btn.disabled = true;

  const snap  = await get(ref(db, `games/${gameCode}/state`));
  const stato = snap.val() ?? {};
  const phase = stato.phase ?? "night";

  if (phase === "night") {
    const riepilogo = await processaNotte(gameCode);
    // Svuota undo stack a inizio giorno
    undoStack = [];
    updateUndoBtn();
    showSummaryModal(riepilogo);
  } else {
    // Reset isMuted e voti a inizio notte
    const pSnap   = await get(ref(db, `games/${gameCode}/players`));
    const players = pSnap.val() ?? {};
    const muteReset = {};
    for (const uid in players) {
      if (players[uid].isMuted) muteReset[`games/${gameCode}/players/${uid}/isMuted`] = false;
    }
    if (Object.keys(muteReset).length) await update(ref(db), muteReset);
    await update(ref(db, `games/${gameCode}/dayActions`), { votes: null, corvoTarget: null });
  }

  const newPhase = phase === "night" ? "day" : "night";
  await update(ref(db, `games/${gameCode}/state`), { phase: newPhase });

  btn.disabled = false;
}

// ──────────────────────────────────────────────────────────────────────────────
// SUMMARY MODAL — con classi CSS per colorazione
// ──────────────────────────────────────────────────────────────────────────────
function showSummaryModal(righe) {
  const modal   = document.getElementById("summary-modal");
  const content = document.getElementById("summary-content");
  const box     = document.getElementById("summary-box");

  content.innerHTML = righe.map(({ testo, tipo }) =>
    `<p class="summary-line summary-${tipo}">${testo}</p>`
  ).join("");

  modal.style.display = "flex";
  // Rimuove e riaggiunge la classe per far ripartire l'animazione
  box.classList.remove("animate-in");
  requestAnimationFrame(() => box.classList.add("animate-in"));
}

function closeSummaryModal() {
  const modal = document.getElementById("summary-modal");
  const box   = document.getElementById("summary-box");
  box.classList.add("animate-out");
  box.addEventListener("animationend", () => {
    modal.style.display = "none";
    box.classList.remove("animate-out");
  }, { once: true });
}

// ──────────────────────────────────────────────────────────────────────────────
// EVENT LOG
// ──────────────────────────────────────────────────────────────────────────────
// ── Colori per tipo evento ─────────────────────────────────────────────────
const LOG_TIPO_COLOR = {
  morte_notte:                    "#c84050",
  attacco_lupo:                   "#c84050",
  boia_esecuzione:                "#c84050",
  giustiziere_esecuzione:         "#d05060",
  mannaro_caccia:                 "#d4884a",
  morte_giorno:                   "#e07030",
  kamikaze_vendetta:              "#e0a030",
  amante_muore:                   "#d060a0",
  figlio_diventa_lupo:            "#b070d0",
  mitomane_copia:                 "#a080c0",
  puttana_salvataggio_effettivo:  "#40b880",
  angelo_resurrezione:            "#40b880",
  veggente_risposta:              "#4080e0",
  investigatore_risposta:         "#4080e0",
  medium_risposta:                "#7070c0",
  missPurple_risposta:            "#a060c0",
  lupoCieco_risposta:             "#c04060",
  bugiardo_risposta:              "#c06080",
  sciamano_maledizione:           "#8060c0",
  muto_silenzia:                  "#806080",
  parassita_infetta:              "#88cc44",
  folle_vince:                    "#a0c040",
  bloccato_da_illusionista:       "#6080a0",
};

function _inferPhase(e) {
  if (e.notte  != null) return { tipo: "notte",  numero: e.notte };
  if (e.giorno != null) return { tipo: "giorno", numero: e.giorno };
  const dayTypes = ["morte_giorno", "kamikaze_vendetta", "folle_vince"];
  return dayTypes.includes(e.tipo)
    ? { tipo: "giorno", numero: 0 }
    : { tipo: "notte",  numero: 0 };
}

function _phaseScore(fase) {
  // Notte N = N*2-1, Giorno N = N*2  → sort descending = most recent first
  return fase.numero * 2 + (fase.tipo === "giorno" ? 0 : -1);
}

function _phaseKey(fase) { return `${fase.tipo}:${fase.numero}`; }

function renderEventLog(log, giocatori) {
  const container = document.getElementById("event-log");
  const allEvents = Object.values(log);

  if (allEvents.length === 0) {
    container.innerHTML = "<p class='empty-msg'>Nessun evento ancora.</p>";
    return;
  }

  // Raggruppa per fase
  const phaseMap = new Map();
  for (const e of allEvents) {
    const fase = _inferPhase(e);
    const key  = _phaseKey(fase);
    if (!phaseMap.has(key)) phaseMap.set(key, { fase, events: [] });
    phaseMap.get(key).events.push(e);
  }

  // Ordina fasi: più recente in cima
  const phases = [...phaseMap.values()]
    .sort((a, b) => _phaseScore(b.fase) - _phaseScore(a.fase));

  container.innerHTML = phases.map(({ fase, events }) => {
    const label = fase.tipo === "notte"
      ? `🌙 Notte ${fase.numero}`
      : `☀️ Giorno ${fase.numero}`;
    const color = fase.tipo === "notte" ? "#8080c0" : "#c0a040";

    // All'interno della fase: ordine cronologico inverso (più recente in cima)
    const sorted = [...events].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    const rows = sorted.map(e => {
      const time    = e.timestamp
        ? new Date(e.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        : "--:--";
      const entryColor = LOG_TIPO_COLOR[e.tipo] ?? "var(--text-sec)";
      return `<div class="log-entry" style="border-left-color:${entryColor}">
        <span class="log-time">${time}</span>
        <span style="color:${entryColor}">${formatLogEntry(e, giocatori)}</span>
      </div>`;
    }).join("");

    return `<div class="log-phase">
      <div class="log-phase-header" style="color:${color}">${label}</div>
      ${rows}
    </div>`;
  }).join("");
}

// ── Copia Log per WhatsApp ────────────────────────────────────────────────────
async function copyLogToClipboard() {
  const log       = lastGameData?.log     ?? {};
  const giocatori = lastGameData?.players ?? {};
  const allEvents = Object.values(log);

  if (allEvents.length === 0) {
    ui.toast("Nessun evento da copiare.");
    return;
  }

  const phaseMap = new Map();
  for (const e of allEvents) {
    const fase = _inferPhase(e);
    const key  = _phaseKey(fase);
    if (!phaseMap.has(key)) phaseMap.set(key, { fase, events: [] });
    phaseMap.get(key).events.push(e);
  }

  const phases = [...phaseMap.values()]
    .sort((a, b) => _phaseScore(b.fase) - _phaseScore(a.fase));

  const lines = ["*🐺 LUPUS IN FABULA - LOG PARTITA 🐺*", ""];

  for (const { fase, events } of phases) {
    const label = fase.tipo === "notte" ? `*🌙 NOTTE ${fase.numero}*` : `*☀️ GIORNO ${fase.numero}*`;
    lines.push(label);
    const sorted = [...events].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    for (const e of sorted) {
      lines.push(`- ${formatLogEntry(e, giocatori)}`);
    }
    lines.push("");
  }

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    ui.toast("✓ Log copiato!");
  } catch {
    ui.toast("Errore durante la copia.");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// END GAME
// ──────────────────────────────────────────────────────────────────────────────
async function handleEndGame() {
  if (!await ui.confirm("Terminare la partita e tornare alla lobby?", {
    icon: "🏚️", confirmLabel: "Termina"
  })) return;

  const pSnap   = await get(ref(db, `games/${gameCode}/players`));
  const players = pSnap.val() ?? {};

  const updates = { nightActions: null, dayActions: null, tempFeedback: null, log: null, "state/status": "ended" };
  for (const uid in players) {
    if (players[uid].role !== "host") {
      updates[`players/${uid}/isAlive`] = true;
      updates[`players/${uid}/isMuted`] = false;
    }
  }

  await update(ref(db, `games/${gameCode}`), updates);
}
