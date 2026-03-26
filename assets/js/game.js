// assets/js/game.js
import { db, auth } from "./firebase.js";
import {
  ref, onValue, get, update, push
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { ROLES } from "./engine/roles.js";
import { processaNotte } from "./engine/nightEngine.js";
import { formatLogEntry } from "./engine/eventLog.js";
import * as ui from "./ui.js";

const urlParams = new URLSearchParams(window.location.search);
const gameCode  = urlParams.get("gameCode");
const gameRef   = ref(db, `games/${gameCode}`);

let currentUser       = null;
let isHost            = false;
let currentPlayerData = null;

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
auth.onAuthStateChanged(async (user) => {
  if (!user) { await ui.alert("Utente non autenticato.", { icon: "🔒" }); return; }
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

  let revealed = false;
  toggleBtn.addEventListener("click", () => {
    revealed = !revealed;
    roleCard.textContent = revealed ? currentPlayerData.gameRole : "???";
    roleCard.classList.toggle("revealed", revealed);
  });

  onValue(ref(db, `games/${gameCode}/players/${currentUser.uid}`), (snap) => {
    const p = snap.val();
    if (!p) return;
    currentPlayerData = p;

    const stati = [];
    if (!p.isAlive) stati.push("💀 Sei morto");
    if (p.isMuted)  stati.push("🤐 Sei silenziato oggi");

    statusEl.textContent   = stati.join(" · ");
    statusEl.style.display = stati.length ? "block" : "none";

    if (revealed) roleCard.textContent = p.gameRole;
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
}

function renderNarratorView(gameData) {
  const phase       = gameData.state?.phase        ?? "night";
  const nightNumber = gameData.state?.nightNumber   ?? 1;
  const skipFirst   = gameData.state?.skipFirstNight ?? false;

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
// NIGHT DASHBOARD
// ──────────────────────────────────────────────────────────────────────────────
function renderNightDashboard(gameData, skipFirst) {
  const container = document.getElementById("night-dashboard");
  container.innerHTML = "";

  const azioni        = gameData.nightActions ?? {};
  const players       = gameData.players      ?? {};
  const stato         = gameData.state        ?? {};
  const rolesDB       = gameData.roles        ?? {};
  const nomiAttivi    = Object.keys(rolesDB).filter(n => (rolesDB[n]?.count ?? 0) > 0);
  const activePlayers = Object.entries(players).filter(([, p]) => p.role !== "host" && p.isAlive);

  if (skipFirst && (stato.nightNumber ?? 1) === 1) {
    const banner = document.createElement("div");
    banner.className = "skip-night-banner";
    banner.innerHTML = "🌙 Prima notte: <strong>silenzio assoluto</strong>.<br>Premi <em>Alba</em> per proseguire.";
    container.appendChild(banner);
    return;
  }

  const ruoliNotte = Object.values(ROLES)
    .filter(r => r.attivoNotte && nomiAttivi.includes(r.nome))
    .sort((a, b) => a.prioritaNotte - b.prioritaNotte);

  if (ruoliNotte.length === 0) {
    container.innerHTML = "<p class='empty-msg'>Nessun ruolo attivo questa notte.</p>";
    return;
  }

  const devMode = gameData.state?.devMode ?? false;

  ruoliNotte.forEach((ruolo, i) => {
    const giocatoriMap = Object.fromEntries(activePlayers);
    const count        = activePlayers.filter(([, p]) => p.gameRole === ruolo.nome).length;
    const pendente     = isRolePendente(ruolo, azioni, activePlayers, stato);
    const botHasRole   = activePlayers.some(([, p]) => p.gameRole === ruolo.nome && p.isBot);

    const card = document.createElement("div");
    card.className = "dashboard-step";

    const header = document.createElement("div");
    header.className = "step-header";
    header.innerHTML = `
      <span class="step-number">${i + 1}</span>
      <span class="step-title">
        Chiama: <strong>${ruolo.nome}</strong>
        <span class="step-count">(${count} in gioco)</span>
        ${pendente ? '<span class="badge-pending">● Pendente</span>' : ''}
        ${devMode && botHasRole ? '<span class="badge-bot-role">🤖</span>' : ''}
      </span>
      <span class="step-toggle">▼</span>`;

    const body = document.createElement("div");
    body.className = "step-body";

    const controlli = ruolo.controlliNotte(giocatoriMap, azioni, stato);
    if (controlli?.length) {
      controlli.forEach(ctrl => {
        const el = buildControl(ctrl, activePlayers, azioni, rolesDB);
        if (el) body.appendChild(el);
      });
    } else {
      body.innerHTML = "<p class='no-action'>Nessuna azione richiesta.</p>";
    }

    // Pulsante "Scelta Casuale Bot" — visibile solo in dev mode se c'è un bot con questo ruolo
    if (devMode && botHasRole) {
      const botBtn = document.createElement("button");
      botBtn.className = "btn-bot-random";
      botBtn.textContent = "🎲 Scelta Casuale Bot";
      botBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fillBotAction(ruolo, azioni, activePlayers, rolesDB, stato);
      });
      body.appendChild(botBtn);
    }

    header.addEventListener("click", () => {
      const open = body.classList.toggle("open");
      header.querySelector(".step-toggle").textContent = open ? "▲" : "▼";
    });

    card.append(header, body);
    container.appendChild(card);
  });
}

// Un ruolo è "pendente" se ha almeno un controllo non-opzionale senza valore
function isRolePendente(ruolo, azioni, activePlayers, stato) {
  const giocatoriMap = Object.fromEntries(activePlayers);
  const controlli    = ruolo.controlliNotte(giocatoriMap, azioni, stato);
  if (!controlli?.length) return false;

  for (const ctrl of controlli) {
    if (ctrl.opzionale) continue;

    const targets = ctrl.filtroTarget
      ? activePlayers.filter(([, p]) => ctrl.filtroTarget(p))
      : activePlayers;
    if (targets.length === 0) continue;

    if (ctrl.tipo === "checkbox-multi") {
      if (!azioni[ctrl.chiaveAzione] || Object.keys(azioni[ctrl.chiaveAzione]).length === 0) return true;
    } else if (ctrl.tipo === "radio" || ctrl.tipo === "select-ruolo") {
      if (!azioni[ctrl.chiaveAzione]) return true;
    }
  }
  return false;
}

// Costruisce un controllo UI dal descrittore del ruolo
function buildControl(ctrl, activePlayers, azioni, rolesDB) {
  const wrapper = document.createElement("div");
  wrapper.className = "control-group";

  const labelEl = document.createElement("p");
  labelEl.className = "control-label";
  labelEl.textContent = ctrl.label + ":";
  wrapper.appendChild(labelEl);

  const targets = ctrl.filtroTarget
    ? activePlayers.filter(([, p]) => ctrl.filtroTarget(p))
    : activePlayers;

  if (ctrl.tipo === "checkbox-multi") {
    targets.forEach(([uid, p]) => {
      const row = document.createElement("label");
      row.className = "control-row";
      const chk = document.createElement("input");
      chk.type    = "checkbox";
      chk.checked = !!(azioni[ctrl.chiaveAzione]?.[uid]);

      chk.addEventListener("change", async () => {
        const prevValue = azioni[ctrl.chiaveAzione]?.[uid] ? true : null;
        await update(ref(db, `games/${gameCode}/nightActions/${ctrl.chiaveAzione}`), {
          [uid]: chk.checked ? true : null
        });
        pushUndo(`${ruoloLabel(ctrl.chiaveAzione)} → ${p.name}: ${chk.checked ? "✓" : "✗"}`, async () => {
          await update(ref(db, `games/${gameCode}/nightActions/${ctrl.chiaveAzione}`), { [uid]: prevValue });
        });
      });

      row.append(chk, ` ${p.name}`);
      wrapper.appendChild(row);
    });

  } else if (ctrl.tipo === "radio") {
    if (ctrl.opzionale) {
      const row   = document.createElement("label");
      row.className = "control-row";
      const radio = document.createElement("input");
      radio.type  = "radio";
      radio.name  = ctrl.chiaveAzione;
      radio.value = "__none__";
      radio.checked = !azioni[ctrl.chiaveAzione];
      radio.addEventListener("change", async () => {
        const prev = azioni[ctrl.chiaveAzione] ?? null;
        await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: null });
        pushUndo(`${ruoloLabel(ctrl.chiaveAzione)}: Nessuno`, async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: prev });
        });
      });
      row.append(radio, " Nessuno");
      wrapper.appendChild(row);
    }

    targets.forEach(([uid, p]) => {
      const row   = document.createElement("label");
      row.className = "control-row";
      const radio = document.createElement("input");
      radio.type  = "radio";
      radio.name  = ctrl.chiaveAzione;
      radio.value = uid;
      radio.checked = azioni[ctrl.chiaveAzione] === uid;
      radio.addEventListener("change", async () => {
        const prev = azioni[ctrl.chiaveAzione] ?? null;
        await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: uid });
        pushUndo(`${ruoloLabel(ctrl.chiaveAzione)} → ${p.name}`, async () => {
          await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: prev });
        });
      });
      row.append(radio, ` ${p.name}`);
      wrapper.appendChild(row);
    });

  } else if (ctrl.tipo === "select-ruolo") {
    const select = document.createElement("select");
    select.className = "role-select";
    const nomiRuoli = Object.keys(rolesDB)
      .filter(n => n !== "Mitomane" && (rolesDB[n]?.count ?? 0) > 0);
    nomiRuoli.forEach(nome => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      if (azioni[ctrl.chiaveAzione] === nome) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", async () => {
      const prev = azioni[ctrl.chiaveAzione] ?? null;
      await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: select.value });
      pushUndo(`Mitomane → ${select.value}`, async () => {
        await update(ref(db, `games/${gameCode}/nightActions`), { [ctrl.chiaveAzione]: prev });
      });
    });
    wrapper.appendChild(select);
  }

  return wrapper;
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

function ruoloLabel(chiaveAzione) {
  const map = {
    killed: "Bersaglio lupi", saved: "Salvato", visto: "Veggente",
    muted: "Silenziato", indagato: "Investigatore", sciamanoTarget: "Sciamano",
    lovers: "Amanti", mitomaneRole: "Mitomane"
  };
  return map[chiaveAzione] ?? chiaveAzione;
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
  await push(ref(db, `games/${gameCode}/log`), {
    tipo: "morte_giorno", uid, timestamp: Date.now()
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
  for (const e of evLog) await push(ref(db, `games/${gameCode}/log`), e);
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
function renderEventLog(log, giocatori) {
  const container = document.getElementById("event-log");
  const entries   = Object.values(log)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 50);

  if (entries.length === 0) {
    container.innerHTML = "<p class='empty-msg'>Nessun evento ancora.</p>";
    return;
  }

  container.innerHTML = entries.map(e => {
    const time = e.timestamp
      ? new Date(e.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
      : "--:--";
    return `<div class="log-entry"><span class="log-time">${time}</span> ${formatLogEntry(e, giocatori)}</div>`;
  }).join("");
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

  const updates = { nightActions: null, dayActions: null, "state/status": "ended" };
  for (const uid in players) {
    if (players[uid].role !== "host") {
      updates[`players/${uid}/isAlive`] = true;
      updates[`players/${uid}/isMuted`] = false;
    }
  }

  await update(ref(db, `games/${gameCode}`), updates);
}
