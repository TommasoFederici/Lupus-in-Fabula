// assets/js/engine/nightEngine.js
// Pipeline di risoluzione della notte.
//
// Ordine di risoluzione:
//   0. Pre-pass Lupo Ciccione  — marca i vicini con _ciccione
//   1. Raccolta intent          — ogni ruolo chiama processaNotte() per prioritaNotte
//                                 (l'Illusionista blocca i ruoli successivi se targeting)
//   2. Salvataggio Puttana      — cancella _morteNottePending sul bersaglio ospitato
//   3. Trasformazione Figlio    — Figlio del Lupo → Lupo invece di morire
//   4. Immunità Mannari         — Lupo Mannaro e Mucca Mannara non muoiono per mano lupi
//   5. Applicazione morti
//   6. Aggiornamento infected   — segna i giocatori infettati dal Parassita
//   7. Catena Amanti
//   8. Check win conditions
//   9. Pulizia flag temporanei
//  10. Scrittura Firebase
//  11. Log eventi

import { db } from "../firebase.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { ROLES, checkWinConditions, calcSpettroProb, countWolves } from "./roles.js";
import { logEventi } from "./eventLog.js";

export async function processaNotte(gameCode) {
  const [actionsSnap, playersSnap, stateSnap, rolesSnap] = await Promise.all([
    get(ref(db, `games/${gameCode}/nightActions`)),
    get(ref(db, `games/${gameCode}/players`)),
    get(ref(db, `games/${gameCode}/state`)),
    get(ref(db, `games/${gameCode}/roles`))
  ]);

  const azioni    = actionsSnap.exists()  ? actionsSnap.val()  : {};
  const giocatori = playersSnap.val()     ?? {};
  const stato     = stateSnap.val()       ?? {};
  const rolesDB   = rolesSnap.exists()    ? rolesSnap.val()    : {};

  // Stato locale mutabile
  const sl = {};
  for (const uid in giocatori) sl[uid] = { ...giocatori[uid] };

  const nomiAttivi = Object.keys(rolesDB).filter(n => (rolesDB[n]?.count ?? 0) > 0);
  const ruoliNotte = Object.values(ROLES)
    .filter(r => r.attivoNotte && nomiAttivi.includes(r.nome))
    .filter(r => !r.isGhostRole || !!stato.spettro) // Spettro agisce solo dopo la prima morte
    .sort((a, b) => a.prioritaNotte - b.prioritaNotte);

  const tuttiLog = [];

  // ── 0. Pre-pass Lupo Ciccione ────────────────────────────────────────────
  const viviList = Object.keys(sl).filter(uid => sl[uid].isAlive && sl[uid].role !== "host");
  for (const uid of viviList) {
    if (sl[uid].gameRole === "Lupo Ciccione") {
      const idx   = viviList.indexOf(uid);
      const left  = viviList[(idx - 1 + viviList.length) % viviList.length];
      const right = viviList[(idx + 1) % viviList.length];
      if (left  !== uid) sl[left]._ciccione  = true;
      if (right !== uid) sl[right]._ciccione = true;
    }
  }

  // ── 1. Raccolta intent ───────────────────────────────────────────────────
  for (const ruolo of ruoliNotte) {
    // Blocco Illusionista: se tutti i giocatori con questo ruolo sono bloccati, salta
    const roleUids  = Object.keys(sl).filter(u => sl[u].gameRole === ruolo.nome && sl[u].isAlive);
    const tuttiBloccati = roleUids.length > 0 && roleUids.every(u => sl[u]._bloccato);
    if (tuttiBloccati) {
      tuttiLog.push({ tipo: "bloccato_da_illusionista", ruolo: ruolo.nome, notte: stato.nightNumber, timestamp: Date.now() });
      continue;
    }

    const { aggiornamenti, logEventi: ev } = ruolo.processaNotte(azioni, sl, stato);
    for (const { uid, campi } of aggiornamenti) {
      sl[uid] = { ...sl[uid], ...campi };
    }
    tuttiLog.push(...ev);
  }

  // ── 2. Salvataggio Puttana ───────────────────────────────────────────────
  const savedUid = azioni.saved ?? null;
  if (savedUid && sl[savedUid]?._morteNottePending) {
    sl[savedUid]._morteNottePending = false;
    tuttiLog.push({ tipo: "puttana_salvataggio_effettivo", bersaglio: savedUid, notte: stato.nightNumber, timestamp: Date.now() });
  }

  // ── 3. Trasformazione Figlio del Lupo ────────────────────────────────────
  for (const uid in sl) {
    if (sl[uid]._morteNottePending && giocatori[uid]?.gameRole === "Figlio del Lupo") {
      sl[uid]._morteNottePending = false;
      sl[uid].gameRole = "Lupo";
      tuttiLog.push({ tipo: "figlio_diventa_lupo", uid, notte: stato.nightNumber, timestamp: Date.now() });
    }
  }

  // ── 4. Immunità Mannari (non muoiono per mano dei lupi) ──────────────────
  const killedByWolves = azioni.killed ? [azioni.killed] : [];
  for (const uid of killedByWolves) {
    if (["Lupo Mannaro", "Mucca Mannara"].includes(giocatori[uid]?.gameRole)) {
      sl[uid]._morteNottePending = false;
    }
  }
  // Giustiziere ignora le protezioni (_nonBloccabile) — già gestito dall'ordine di priorità

  // ── 5. Applicazione morti ─────────────────────────────────────────────────
  const mortiNotte = [];
  for (const uid in sl) {
    if (sl[uid]._morteNottePending) {
      sl[uid].isAlive = false;
      sl[uid]._morteNottePending = false;
      mortiNotte.push(uid);
      tuttiLog.push({ tipo: "morte_notte", uid, notte: stato.nightNumber, timestamp: Date.now() });
    }
  }

  // ── 5.5. Assegna Spettro (probabilistico) ───────────────────────────────────
  let newSpettroUid  = null;
  let newSpettroDeaths = stato.spettroDeaths ?? 0;
  if (stato.spettroEnabled && !stato.spettro && mortiNotte.length > 0) {
    const nonHost = Object.values(giocatori).filter(p => p.role !== "host");
    const N = nonHost.length;
    const W = countWolves(giocatori);
    for (const uid of mortiNotte) {
      const prob = calcSpettroProb(newSpettroDeaths, N, W);
      if (Math.random() < prob) {
        newSpettroUid = uid;
        tuttiLog.push({ tipo: "spettro_assegnato", uid, notte: stato.nightNumber, timestamp: Date.now() });
        break;
      }
      newSpettroDeaths++;
    }
  }

  // ── 6. Aggiornamento infected ────────────────────────────────────────────
  const infettatiNotte = Object.keys(sl).filter(u => sl[u]._infected && !giocatori[u]?._infected);
  // Merge con infected già in stato
  const infectedMap = { ...(stato.infected ?? {}) };
  for (const uid of infettatiNotte) infectedMap[uid] = true;

  // ── 7. Catena Amanti ──────────────────────────────────────────────────────
  const lovers = Object.keys(azioni.lovers || {});
  if (lovers.length > 0) {
    const mortoAmante = mortiNotte.find(uid => lovers.includes(uid));
    if (mortoAmante) {
      for (const lUid of lovers) {
        if (sl[lUid]?.isAlive) {
          sl[lUid].isAlive = false;
          tuttiLog.push({ tipo: "amante_muore", uid: lUid, perColpaDi: mortoAmante, notte: stato.nightNumber, timestamp: Date.now() });
        }
      }
    }
  }

  // ── 8. Check win conditions ───────────────────────────────────────────────
  // Ricostruisci players da sl per il check
  const playersPerCheck = {};
  for (const uid in sl) playersPerCheck[uid] = { ...giocatori[uid], ...sl[uid] };
  const vincitore = checkWinConditions(playersPerCheck, { ...stato, infected: infectedMap });
  if (vincitore) {
    tuttiLog.push({ tipo: "vittoria", vincitore, notte: stato.nightNumber, timestamp: Date.now() });
  }

  // ── 9. Pulizia flag temporanei ────────────────────────────────────────────
  for (const uid in sl) {
    delete sl[uid]._morteNottePending;
    delete sl[uid]._sciamanoInsinuato;
    delete sl[uid]._ciccione;
    delete sl[uid]._bloccato;
    delete sl[uid]._infected; // spostato in stato.infected
    delete sl[uid]._nonBloccabile;
  }

  // ── 10. Scrittura Firebase ────────────────────────────────────────────────
  const updates = {};
  for (const uid in sl) {
    const orig = giocatori[uid];
    const curr = sl[uid];
    for (const key of Object.keys(curr)) {
      if (key.startsWith("_")) continue;
      if (orig[key] !== curr[key]) {
        updates[`players/${uid}/${key}`] = curr[key];
      }
    }
  }
  updates["state/nightNumber"] = (stato.nightNumber ?? 1) + 1;
  updates["state/infected"]    = Object.keys(infectedMap).length > 0 ? infectedMap : null;
  if (vincitore) updates["state/winner"] = vincitore;
  if (newSpettroUid) {
    updates["state/spettro"]               = newSpettroUid;
    updates["state/spettroNights"]         = 0;
    updates["roles/Spettro del Villaggio"] = { count: 1 };
  } else if (stato.spettroEnabled && !stato.spettro) {
    updates["state/spettroDeaths"] = newSpettroDeaths;
  }
  if (stato.spettro && !newSpettroUid) {
    // Probabilità: 30% seconda notte (prima attivazione), +10% ogni notte fino a 100%
    const nights = stato.spettroNights ?? 0;
    const prob   = Math.min(1.0, 0.3 + 0.1 * nights);
    const target = azioni.spettroTarget ?? null;
    const attiva = target && Math.random() < prob;
    updates["state/spettroBoost"]    = attiva ? target : null;
    updates["state/spettroLastPick"] = target;
    updates["state/spettroNights"]   = nights + 1;
    if (attiva) {
      tuttiLog.push({ tipo: "spettro_boost", bersaglio: target, notte: stato.nightNumber, timestamp: Date.now() });
    } else {
      tuttiLog.push({ tipo: "spettro_no_boost", notte: stato.nightNumber, timestamp: Date.now() });
    }
  }
  updates["nightActions"]      = null;
  updates["tempFeedback"]      = null;

  await update(ref(db, `games/${gameCode}`), updates);

  // ── 11. Log ───────────────────────────────────────────────────────────────
  await logEventi(gameCode, tuttiLog);

  return buildRiepilogo(mortiNotte, giocatori, tuttiLog, vincitore);
}

// ── Riepilogo testuale per il modal "Alba" ────────────────────────────────────
function buildRiepilogo(mortiUids, giocatori, eventi, vincitore) {
  const nome  = (uid) => giocatori[uid]?.name ?? uid;
  const righe = [];

  const nomiMorti = mortiUids.map(nome);
  righe.push(nomiMorti.length > 0
    ? { testo: `Stanotte sono morti: ${nomiMorti.join(", ")}`, tipo: "morte" }
    : { testo: "Stanotte non è morto nessuno.", tipo: "ok" }
  );

  const spettro = eventi.find(e => e.tipo === "spettro_assegnato");
  if (spettro) righe.push({ testo: `👻 ${nome(spettro.uid)} è diventato lo Spettro del Villaggio!`, tipo: "trasforma" });

  const spettroBoost = eventi.find(e => e.tipo === "spettro_boost");
  if (spettroBoost) righe.push({ testo: `👻 Lo Spettro: il voto di ${nome(spettroBoost.bersaglio)} vale doppio oggi`, tipo: "info" });
  const spettroNo = eventi.find(e => e.tipo === "spettro_no_boost");
  if (spettroNo) righe.push({ testo: "👻 Lo Spettro oggi non ha voglia di aiutare nessuno", tipo: "info" });

  const figlio = eventi.find(e => e.tipo === "figlio_diventa_lupo");
  if (figlio) righe.push({ testo: `🌕 ${nome(figlio.uid)} si è trasformato in Lupo!`, tipo: "trasforma" });

  eventi.filter(e => e.tipo === "amante_muore").forEach(e =>
    righe.push({ testo: `💔 ${nome(e.uid)} muore (amante di ${nome(e.perColpaDi)})`, tipo: "morte" })
  );

  const veg = eventi.find(e => e.tipo === "veggente_risposta" && !e.viaMutaforma);
  if (veg) righe.push({
    testo: `🔭 Veggente → ${nome(veg.bersaglio)}: ${veg.risultato === "lupo" ? "LUPO 🐺" : "Innocente ✅"}`,
    tipo: "info"
  });

  const inv = eventi.find(e => e.tipo === "investigatore_risposta" && !e.viaMutaforma);
  if (inv) righe.push({
    testo: `🕵️ Investigatore → ${nome(inv.bersaglio)}: ${inv.risultato === "esce" ? "Esce 🚶" : "Resta 🏠"}`,
    tipo: "info"
  });

  const mp = eventi.find(e => e.tipo === "missPurple_risposta");
  if (mp) righe.push({ testo: `💜 Miss Purple: ${mp.conteggio} lupo/i in gioco`, tipo: "info" });

  const med = eventi.find(e => e.tipo === "medium_risposta" && !e.viaMutaforma);
  if (med) righe.push({ testo: `🕯️ Medium → ${nome(med.bersaglio)}: fazione ${med.fazione}`, tipo: "info" });

  const cieco = eventi.find(e => e.tipo === "lupoCieco_risposta");
  if (cieco) righe.push({ testo: `🙈 Lupo Cieco: ${cieco.risultato === "si" ? "Lupo trovato nel trio 🐺" : "Nessun lupo nel trio ✅"}`, tipo: "info" });

  const boia = eventi.find(e => e.tipo === "boia_esecuzione");
  if (boia) righe.push({ testo: `🪓 Boia → ${nome(boia.bersaglio)} (${boia.ruoloDichiarato}): ${boia.indovinato ? "✅ Corretto" : "❌ Sbagliato"}`, tipo: boia.indovinato ? "morte" : "info" });

  const bug = eventi.find(e => e.tipo === "bugiardo_risposta");
  if (bug) righe.push({ testo: `🤥 Bugiardo → ${nome(bug.bersaglio)}: era ${bug.ruoloScoperto}`, tipo: "info" });

  const ang = eventi.find(e => e.tipo === "angelo_resurrezione");
  if (ang) righe.push({ testo: `😇 Angelo ha resuscitato ${nome(ang.bersaglio)}`, tipo: "ok" });

  const gio = eventi.find(e => e.tipo === "giustiziere_esecuzione");
  if (gio) righe.push({ testo: `⚔️ Giustiziere ha giustiziato ${nome(gio.bersaglio)}`, tipo: "morte" });

  const mann = eventi.find(e => e.tipo === "mannaro_caccia");
  if (mann) righe.push({ testo: `🌕 Lupo Mannaro → ${nome(mann.bersaglio)} (${mann.ruoloDichiarato}): ${mann.indovinato ? "✅ Caccia riuscita" : "❌ Mancato"}`, tipo: mann.indovinato ? "morte" : "info" });

  const par = eventi.filter(e => e.tipo === "parassita_infetta");
  if (par.length) righe.push({ testo: `🦠 Parassita ha infettato: ${par.map(e => nome(e.vittima)).join(", ")}`, tipo: "info" });

  if (vincitore) righe.push({ testo: `🏆 VITTORIA: ${vincitore.toUpperCase()}`, tipo: "trasforma" });

  return righe;
}
