// assets/js/engine/nightEngine.js
// Pipeline di risoluzione della notte, senza switch-case sui ruoli.
//
// Ordine di risoluzione:
//   1. Raccolta intent  — ogni ruolo chiama processaNotte() per prioritaNotte
//   2. Salvataggio      — Puttana cancella _morteNottePending
//   3. Trasformazione   — Figlio del Lupo → Lupo invece di morire
//   4. Applicazione morti
//   5. Catena Amanti    — se un morto era in un gruppo, tutti muoiono
//   6. Pulizia flag temporanei
//   7. Scrittura Firebase
//   8. Log eventi

import { db } from "../firebase.js";
import {
  ref, get, update
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { ROLES } from "./roles.js";
import { logEventi } from "./eventLog.js";

export async function processaNotte(gameCode) {
  // Leggo tutto in parallelo
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

  // Stato locale mutabile: lavoriamo su una copia
  const sl = {};
  for (const uid in giocatori) sl[uid] = { ...giocatori[uid] };

  // Ruoli attivi in questa partita, ordinati per prioritaNotte
  const nomiAttivi = Object.keys(rolesDB).filter(n => (rolesDB[n]?.count ?? 0) > 0);
  const ruoliNotte = Object.values(ROLES)
    .filter(r => r.attivoNotte && nomiAttivi.includes(r.nome))
    .sort((a, b) => a.prioritaNotte - b.prioritaNotte);

  const tuttiLog = [];

  // ── 1. Raccolta intent ──────────────────────────────────────────────────────
  for (const ruolo of ruoliNotte) {
    const { aggiornamenti, logEventi: ev } = ruolo.processaNotte(azioni, sl, stato);
    for (const { uid, campi } of aggiornamenti) {
      sl[uid] = { ...sl[uid], ...campi };
    }
    tuttiLog.push(...ev);
  }

  // ── 2. Salvataggio Puttana ──────────────────────────────────────────────────
  const savedUid = azioni.saved ?? null;
  if (savedUid && sl[savedUid]?._morteNottePending) {
    sl[savedUid]._morteNottePending = false;
    tuttiLog.push({
      tipo: "puttana_salvataggio_effettivo",
      bersaglio: savedUid,
      notte: stato.nightNumber,
      timestamp: Date.now()
    });
  }

  // ── 3. Trasformazione Figlio del Lupo ───────────────────────────────────────
  for (const uid in sl) {
    if (sl[uid]._morteNottePending && giocatori[uid]?.gameRole === "Figlio del Lupo") {
      sl[uid]._morteNottePending = false;
      sl[uid].gameRole = "Lupo";
      tuttiLog.push({
        tipo: "figlio_diventa_lupo",
        uid,
        notte: stato.nightNumber,
        timestamp: Date.now()
      });
    }
  }

  // ── 4. Applicazione morti ───────────────────────────────────────────────────
  const mortiNotte = [];
  for (const uid in sl) {
    if (sl[uid]._morteNottePending) {
      sl[uid].isAlive = false;
      sl[uid]._morteNottePending = false;
      mortiNotte.push(uid);
      tuttiLog.push({
        tipo: "morte_notte",
        uid,
        notte: stato.nightNumber,
        timestamp: Date.now()
      });
    }
  }

  // ── 5. Catena Amanti ────────────────────────────────────────────────────────
  const lovers = Object.keys(azioni.lovers || {});
  if (lovers.length > 0) {
    const mortoAmante = mortiNotte.find(uid => lovers.includes(uid));
    if (mortoAmante) {
      for (const lUid of lovers) {
        if (sl[lUid]?.isAlive) {
          sl[lUid].isAlive = false;
          tuttiLog.push({
            tipo: "amante_muore",
            uid: lUid,
            perColpaDi: mortoAmante,
            notte: stato.nightNumber,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  // ── 6. Pulizia flag temporanei ──────────────────────────────────────────────
  for (const uid in sl) {
    delete sl[uid]._morteNottePending;
    delete sl[uid]._sciamanoMaledetto;
  }

  // ── 7. Scrittura Firebase ───────────────────────────────────────────────────
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
  updates["nightActions"]      = null;
  updates["tempFeedback"]      = null;

  await update(ref(db, `games/${gameCode}`), updates);

  // ── 8. Log ──────────────────────────────────────────────────────────────────
  await logEventi(gameCode, tuttiLog);

  // Restituisce riepilogo testuale per il modal "Alba"
  return buildRiepilogo(mortiNotte, giocatori, tuttiLog);
}

// Costruisce il riepilogo strutturato mostrato al narratore dopo l'alba.
// Ogni riga ha { testo, tipo } dove tipo guida la colorazione nel modal:
//   "morte"     → rosso
//   "trasforma" → oro
//   "info"      → grigio chiaro
//   "ok"        → verde
function buildRiepilogo(mortiUids, giocatori, eventi) {
  const nome = (uid) => giocatori[uid]?.name ?? uid;
  const righe = [];

  const nomiMorti = mortiUids.map(nome);
  if (nomiMorti.length > 0) {
    righe.push({ testo: `Stanotte sono morti: ${nomiMorti.join(", ")}`, tipo: "morte" });
  } else {
    righe.push({ testo: "Stanotte non è morto nessuno.", tipo: "ok" });
  }

  const figlio = eventi.find(e => e.tipo === "figlio_diventa_lupo");
  if (figlio) righe.push({ testo: `🐺 ${nome(figlio.uid)} si è trasformato in Lupo!`, tipo: "trasforma" });

  const amanti = eventi.filter(e => e.tipo === "amante_muore");
  amanti.forEach(e => righe.push({ testo: `💔 ${nome(e.uid)} muore (amante di ${nome(e.perColpaDi)})`, tipo: "morte" }));

  const veg = eventi.find(e => e.tipo === "veggente_risposta");
  if (veg) righe.push({
    testo: `🔮 Veggente → ${nome(veg.bersaglio)}: ${veg.risultato === "lupo" ? "LUPO 🐺" : "Innocente ✅"}`,
    tipo: "info"
  });

  const inv = eventi.find(e => e.tipo === "investigatore_risposta");
  if (inv) righe.push({
    testo: `🔍 Investigatore → ${nome(inv.bersaglio)}: ${inv.risultato === "esce" ? "Esce di notte 🚶" : "Resta a casa 🏠"}`,
    tipo: "info"
  });

  return righe;
}
