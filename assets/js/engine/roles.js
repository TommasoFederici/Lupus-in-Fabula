// assets/js/engine/roles.js
// Ogni ruolo è un oggetto plugin autonomo.
// Il motore di gioco li cicla per prioritaNotte senza switch-case.

// ── Helper: mappa nome DB → id ruolo ──────────────────────────────────────────
export function ruoloIdFromNome(nome) {
  return Object.keys(ROLES).find(id => ROLES[id].nome === nome) ?? null;
}

// Lupi "veri" ai fini del conteggio vittoria/Spettro: Lupo e Mucca Mannara
// (quest'ultima vince con i lupi pur non essendo nota a loro).
const RUOLI_LUPO_VERI = ["Lupo", "Mucca Mannara"];

// ── Helper: fazione apparente di un giocatore (considera Lupo Sciamano) ───────
// sl = stato locale (può avere flag _sciamanoInsinuato)
export function getFazioneApparente(uid, sl) {
  const player = sl[uid];
  if (!player) return "villaggio";
  const role = Object.values(ROLES).find(r => r.nome === player.gameRole);
  let base = role?.fazioneApparente ?? role?.fazione ?? "villaggio";
  if (player._sciamanoInsinuato) base = base === "lupi" ? "villaggio" : "lupi";
  return base;
}

// ── Helper: il giocatore con questo ruolo esce di casa questa notte? ──────────
export function playerEsceNotte(uid, player, azioni, stato) {
  const nome = player.gameRole;
  if (["Lupo", "Lupo Sciamano", "Boia"].includes(nome)) return true;
  if (nome === "Puttana")       return !!azioni.saved;
  if (nome === "Amante")        return !!azioni.amanteCasa && azioni.amanteCasa !== uid;
  if (nome === "Mitomane")      return stato.nightNumber === 1;
  if (nome === "Stopper")       return !!azioni.illusoTarget;
  if (nome === "Lupo Bugiardo") return !!azioni.bugiardoTarget && stato.nightNumber >= 2;
  if (nome === "Ammaestratore") return !!azioni.ammaestratoreTarget && stato.nightNumber >= 2;
  if (nome === "Angelo")        return !!azioni.angeloTarget;
  if (nome === "Cacciatore")    return !!azioni.giustiziereTarget;
  if (nome === "Medium")        return !!azioni.mediumTarget;
  return false;
}

// ── Win condition checker ────────────────────────────────────────────────────
// Ritorna la fazione vincitrice oppure null se la partita continua.
// Va chiamato dopo ogni evento (morte di notte, morte di giorno).
export function checkWinConditions(players, state) {
  const vivi = Object.entries(players).filter(([, p]) => p.isAlive && p.role !== "host");
  if (vivi.length === 0) return "pareggio";

  // Lupi "veri" = Lupo e Mucca Mannara (conta ai fini della parità numerica,
  // pur non essendo nota agli altri lupi)
  const lupiVeri = vivi.filter(([, p]) => RUOLI_LUPO_VERI.includes(p.gameRole));
  const nonLupi  = vivi.filter(([, p]) => !RUOLI_LUPO_VERI.includes(p.gameRole));

  if (lupiVeri.length === 0) return "villaggio";
  if (lupiVeri.length >= nonLupi.length) return "lupi";

  return null; // partita continua
}

// ── ROLES ────────────────────────────────────────────────────────────────────
export const ROLES = {

  // ── LUPI ──────────────────────────────────────────────────────────────────

  lupo: {
    id: "lupo", nome: "Lupo",
    descrizione: "Elimina un giocatore ogni notte con il branco.",
    fazione: "lupi", fazioneApparente: "lupi",
    prioritaNotte: 20, attivoNotte: true, attivoGiorno: false, defaultCount: 1,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio", label: "Bersaglio",
        chiaveAzione: "killed",
        filtroTarget: (p) => p.isAlive
      }];
    },

    processaNotte(azioni, sl, stato) {
      const bersaglio = azioni.killed ?? null;
      if (!bersaglio) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid: bersaglio, campi: { _morteNottePending: true } }],
        logEventi: [{
          tipo: "attacco_lupo", vittima: bersaglio, notte: stato.nightNumber, timestamp: Date.now()
        }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  lupoSciamano: {
    id: "lupoSciamano", nome: "Lupo Sciamano",
    descrizione: "Inverte la fazione apparente di un bersaglio per una notte.",
    fazione: "lupi", fazioneApparente: "lupi",
    prioritaNotte: 10, attivoNotte: true, attivoGiorno: false, defaultCount: 0,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio", label: "Insinuo su",
        chiaveAzione: "sciamanoTarget",
        filtroTarget: (p) => !["Lupo","Lupo Sciamano"].includes(p.gameRole) && p.isAlive,
        opzionale: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.sciamanoTarget;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid, campi: { _sciamanoInsinuato: true } }],
        logEventi: [{ tipo: "sciamano_insinuo", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  stopper: {
    id: "stopper", nome: "Stopper",
    descrizione: "Blocca l'abilità notturna di un giocatore.",
    fazione: "lupi", fazioneApparente: "villaggio",
    prioritaNotte: 12, attivoNotte: true, attivoGiorno: false, defaultCount: 0,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio", label: "Blocca",
        chiaveAzione: "illusoTarget",
        filtroTarget: (p) => !["Lupo","Lupo Sciamano","Stopper"].includes(p.gameRole) && p.isAlive,
        opzionale: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.illusoTarget;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid, campi: { _bloccato: true } }],
        logEventi: [{ tipo: "stopper_blocca", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  lupoBugiardo: {
    id: "lupoBugiardo", nome: "Lupo Bugiardo",
    descrizione: "Una volta per partita scopre il ruolo di un giocatore morto.",
    fazione: "lupi", fazioneApparente: "villaggio",
    prioritaNotte: 22, attivoNotte: true, attivoGiorno: false, defaultCount: 0,
    flagUsato: "bugiardoUsato",

    controlliNotte(giocatori, azioni, stato, extra) {
      if ((stato.nightNumber ?? 1) < 2) return null;
      const me = Object.values(giocatori).find(p => p.gameRole === "Lupo Bugiardo");
      if (me?.bugiardoUsato) return [{ tipo: "info", testo: "Potere già usato 🔒" }];
      return [{
        tipo: "radio", label: "Esamina il defunto",
        chiaveAzione: "bugiardoTarget",
        filtroTarget: (p) => !p.isAlive && p.role !== "host",
        includeDead: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.bugiardoTarget;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const bugiardoUid = Object.keys(sl).find(u => sl[u].gameRole === "Lupo Bugiardo");
      return {
        aggiornamenti: bugiardoUid ? [{ uid: bugiardoUid, campi: { bugiardoUsato: true } }] : [],
        logEventi: [{
          tipo: "bugiardo_risposta", bersaglio: uid,
          ruoloScoperto: sl[uid]?.gameRole ?? "?",
          notte: stato.nightNumber, timestamp: Date.now()
        }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  boia: {
    id: "boia", nome: "Boia",
    descrizione: "Una volta per partita: dichiara il ruolo di un giocatore. Se corretto, muore; altrimenti muore il Boia.",
    fazione: "lupi", fazioneApparente: "lupi",
    prioritaNotte: 25, attivoNotte: true, attivoGiorno: false, defaultCount: 0,
    flagUsato: "boiaUsato",

    controlliNotte(giocatori) {
      const me = Object.values(giocatori).find(p => p.gameRole === "Boia");
      if (me?.boiaUsato) return [{ tipo: "info", testo: "Potere già usato 🔒" }];
      return [
        {
          tipo: "radio", label: "Bersaglio",
          chiaveAzione: "boiaTarget",
          filtroTarget: (p) => p.gameRole !== "Boia" && p.isAlive
        },
        {
          tipo: "select-ruolo", label: "Ruolo dichiarato",
          chiaveAzione: "boiaRole"
        }
      ];
    },

    processaNotte(azioni, sl, stato) {
      const targetUid = azioni.boiaTarget;
      const roleDich  = azioni.boiaRole;
      if (!targetUid || !roleDich) return { aggiornamenti: [], logEventi: [] };
      const boiaUid   = Object.keys(sl).find(u => sl[u].gameRole === "Boia");
      const indovinato = sl[targetUid]?.gameRole === roleDich;
      const morto      = indovinato ? targetUid : boiaUid;
      const agg = [{ uid: morto, campi: { _morteNottePending: true } }];
      if (boiaUid) agg.push({ uid: boiaUid, campi: { boiaUsato: true } });
      return {
        aggiornamenti: agg,
        logEventi: [{
          tipo: "boia_esecuzione", bersaglio: targetUid, ruoloDichiarato: roleDich,
          indovinato, notte: stato.nightNumber, timestamp: Date.now()
        }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  indemoniato: {
    id: "indemoniato", nome: "Indemoniato",
    descrizione: "Appare innocente ma vince con i lupi.",
    fazione: "lupi", fazioneApparente: "villaggio",
    prioritaNotte: null, attivoNotte: false, attivoGiorno: false, defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  // ── VILLAGGIO ─────────────────────────────────────────────────────────────

  puttana: {
    id: "puttana", nome: "Puttana",
    descrizione: "Ospita un giocatore; se i lupi attaccano casa sua quella notte si salva.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 30, attivoNotte: true, attivoGiorno: false, defaultCount: 1,

    controlliNotte() {
      return [{
        tipo: "radio", label: "Ospita",
        chiaveAzione: "saved",
        filtroTarget: (p) => p.isAlive,
        opzionale: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.saved;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [],
        logEventi: [{ tipo: "puttana_salva", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  ammaestratore: {
    id: "ammaestratore", nome: "Ammaestratore",
    descrizione: "Una volta per partita reindirizza l'attacco dei lupi su un altro bersaglio.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 27, attivoNotte: true, attivoGiorno: false, defaultCount: 0,
    flagUsato: "ammaestratoreUsato",

    controlliNotte(giocatori, azioni, stato) {
      if ((stato.nightNumber ?? 1) < 2) return null;
      const me = Object.values(giocatori).find(p => p.gameRole === "Ammaestratore");
      if (me?.ammaestratoreUsato) return [{ tipo: "info", testo: "Potere già usato 🔒" }];
      return [{
        tipo: "radio", label: "Reindirizza attacco su",
        chiaveAzione: "ammaestratoreTarget",
        filtroTarget: (p) => p.gameRole !== "Ammaestratore" && p.isAlive,
        opzionale: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const newTarget = azioni.ammaestratoreTarget;
      if (!newTarget) return { aggiornamenti: [], logEventi: [] };
      const ammUid = Object.keys(sl).find(u => sl[u].gameRole === "Ammaestratore");
      // Cancella i flag di morte pendenti dal bersaglio originale dei lupi
      const vecchiBersagli = azioni.killed ? [azioni.killed] : [];
      const agg = vecchiBersagli.map(u => ({ uid: u, campi: { _morteNottePending: false } }));
      // Applica sul nuovo bersaglio (se non è un lupo)
      const isLupo = ["lupi"].includes(Object.values(ROLES).find(r => r.nome === sl[newTarget]?.gameRole)?.fazione);
      if (!isLupo) agg.push({ uid: newTarget, campi: { _morteNottePending: true } });
      if (ammUid) agg.push({ uid: ammUid, campi: { ammaestratoreUsato: true } });
      return {
        aggiornamenti: agg,
        logEventi: [{
          tipo: "ammaestratore_reindirizza", nuovoBersaglio: newTarget,
          fallisce: isLupo, notte: stato.nightNumber, timestamp: Date.now()
        }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  veggente: {
    id: "veggente", nome: "Veggente",
    descrizione: "Investiga un giocatore; il narratore rivela se è un lupo.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 50, attivoNotte: true, attivoGiorno: false, defaultCount: 1,

    controlliNotte() {
      return [{
        tipo: "radio", label: "Investiga",
        chiaveAzione: "investigated",
        filtroTarget: (p) => p.isAlive
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.investigated;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const isLupo = getFazioneApparente(uid, sl) === "lupi";
      return {
        aggiornamenti: [],
        logEventi: [{
          tipo: "veggente_risposta", bersaglio: uid,
          risultato: isLupo ? "lupo" : "innocente",
          notte: stato.nightNumber, timestamp: Date.now()
        }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  medium: {
    id: "medium", nome: "Medium",
    descrizione: "Ogni notte scopre la fazione di un giocatore morto.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 55, attivoNotte: true, attivoGiorno: false, defaultCount: 0,

    controlliNotte(giocatori, azioni, stato, extra) {
      return [{
        tipo: "radio", label: "Interroga il defunto",
        chiaveAzione: "mediumTarget",
        filtroTarget: (p) => !p.isAlive && p.role !== "host",
        includeDead: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.mediumTarget;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const role   = Object.values(ROLES).find(r => r.nome === sl[uid]?.gameRole);
      const fazione = role?.fazione ?? "villaggio";
      return {
        aggiornamenti: [],
        logEventi: [{
          tipo: "medium_risposta", bersaglio: uid, fazione,
          notte: stato.nightNumber, timestamp: Date.now()
        }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  investigatore: {
    id: "investigatore", nome: "Investigatore",
    descrizione: "Controlla se un giocatore esce di casa di notte.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 60, attivoNotte: true, attivoGiorno: false, defaultCount: 0,

    controlliNotte() {
      return [{
        tipo: "radio", label: "Sorveglia",
        chiaveAzione: "watched",
        filtroTarget: (p) => p.gameRole !== "Investigatore" && p.isAlive
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.watched;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const esce = playerEsceNotte(uid, sl[uid], azioni, stato);
      return {
        aggiornamenti: [],
        logEventi: [{
          tipo: "investigatore_risposta", bersaglio: uid,
          risultato: esce ? "esce" : "resta",
          notte: stato.nightNumber, timestamp: Date.now()
        }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  muto: {
    id: "muto", nome: "Muto",
    descrizione: "Silenzia un giocatore per il giorno successivo.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 70, attivoNotte: true, attivoGiorno: false, defaultCount: 0,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio", label: "Silenzia",
        chiaveAzione: "muted",
        filtroTarget: (p) => p.gameRole !== "Muto" && p.isAlive,
        opzionale: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.muted;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid, campi: { isMuted: true } }],
        logEventi: [{ tipo: "muto_silenzia", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  angelo: {
    id: "angelo", nome: "Angelo",
    descrizione: "Una volta per partita resuscita un giocatore morto.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 78, attivoNotte: true, attivoGiorno: false, defaultCount: 0,
    flagUsato: "angeloUsato",

    controlliNotte(giocatori, azioni, stato, extra) {
      const me = Object.values({ ...giocatori, ...(extra?.allPlayers ?? {}) }).find(p => p.gameRole === "Angelo");
      if (me?.angeloUsato) return [{ tipo: "info", testo: "Potere già usato 🔒" }];
      return [{
        tipo: "radio", label: "Resuscita",
        chiaveAzione: "angeloTarget",
        filtroTarget: (p) => !p.isAlive && p.role !== "host",
        includeDead: true
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.angeloTarget;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const angeloUid = Object.keys(sl).find(u => sl[u].gameRole === "Angelo");
      const agg = [{ uid, campi: { isAlive: true } }];
      if (angeloUid) agg.push({ uid: angeloUid, campi: { angeloUsato: true } });
      return {
        aggiornamenti: agg,
        logEventi: [{ tipo: "angelo_resurrezione", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  cacciatore: {
    id: "cacciatore", nome: "Cacciatore",
    descrizione: "Una volta per partita uccide un giocatore di notte (non bloccabile).",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 80, attivoNotte: true, attivoGiorno: false, defaultCount: 0,
    flagUsato: "giustiziereUsato",

    controlliNotte(giocatori) {
      const me = Object.values(giocatori).find(p => p.gameRole === "Cacciatore");
      if (me?.giustiziereUsato) return [{ tipo: "info", testo: "Potere già usato 🔒" }];
      return [{
        tipo: "radio", label: "Giustizia",
        chiaveAzione: "giustiziereTarget",
        filtroTarget: (p) => p.gameRole !== "Cacciatore" && p.isAlive
      }];
    },

    processaNotte(azioni, sl, stato) {
      const uid = azioni.giustiziereTarget;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const gUid = Object.keys(sl).find(u => sl[u].gameRole === "Cacciatore");
      const agg = [{ uid, campi: { _morteNottePending: true, _nonBloccabile: true } }];
      if (gUid) agg.push({ uid: gUid, campi: { giustiziereUsato: true } });
      return {
        aggiornamenti: agg,
        logEventi: [{ tipo: "giustiziere_esecuzione", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  prete: {
    id: "prete", nome: "Prete",
    descrizione: "Di giorno indica un giocatore: se è un lupo muore, altrimenti muore il prete.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: null, attivoNotte: false, attivoGiorno: true, defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  contadino: {
    id: "contadino", nome: "Contadino",
    descrizione: "Nessun potere speciale.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: null, attivoNotte: false, attivoGiorno: false, defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  kamikaze: {
    id: "kamikaze", nome: "Kamikaze",
    descrizione: "Alla sua morte di giorno, elimina uno dei votanti.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: null, attivoNotte: false, attivoGiorno: false, defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },

    effettoPassivo(evento, giocatori) {
      if (evento.tipo !== "morte_giorno") return { aggiornamenti: [], logEventi: [] };
      if (giocatori[evento.uid]?.gameRole !== "Kamikaze") return { aggiornamenti: [], logEventi: [] };
      if (!evento.votanti?.length) return { aggiornamenti: [], logEventi: [] };
      const vittima = evento.votanti[Math.floor(Math.random() * evento.votanti.length)];
      return {
        aggiornamenti: [{ uid: vittima, campi: { isAlive: false } }],
        logEventi: [{ tipo: "kamikaze_vendetta", morto: vittima, kamikaze: evento.uid, timestamp: Date.now() }]
      };
    }
  },

  // ── NEUTRALE ──────────────────────────────────────────────────────────────

  amante: {
    id: "amante", nome: "Amante",
    descrizione: "Ogni notte scelgono insieme una casa comune in cui dormire (o restano separati). Se i lupi la attaccano, muoiono tutti gli amanti presenti.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: 40, attivoNotte: true, attivoGiorno: false, defaultCount: 0,
    pairOnly: true,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio", label: "Casa comune stanotte",
        chiaveAzione: "amanteCasa",
        filtroTarget: (p) => p.gameRole === "Amante" && p.isAlive,
        opzionale: true
      }];
    },

    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  mitomane: {
    id: "mitomane", nome: "Mitomane",
    descrizione: "La prima notte copia il ruolo di un altro giocatore.",
    fazione: "neutrale", fazioneApparente: "villaggio",
    prioritaNotte: 90, attivoNotte: true, attivoGiorno: false, defaultCount: 0,

    controlliNotte(giocatori, azioni, stato) {
      if (stato.nightNumber !== 1) return null;
      return [{
        tipo: "select-ruolo", label: "Copia ruolo",
        chiaveAzione: "copied"
      }];
    },

    processaNotte(azioni, sl, stato) {
      if (stato.nightNumber !== 1 || !azioni.copied) return { aggiornamenti: [], logEventi: [] };
      const mitUid = Object.keys(sl).find(uid => sl[uid].gameRole === "Mitomane");
      if (!mitUid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid: mitUid, campi: { gameRole: azioni.copied } }],
        logEventi: [{ tipo: "mitomane_copia", nuovoRuolo: azioni.copied, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  // ── SOLITARI ──────────────────────────────────────────────────────────────

  matto: {
    id: "matto", nome: "Matto",
    descrizione: "Vince se viene eliminato durante il giorno.",
    fazione: "solitari", fazioneApparente: "villaggio",
    prioritaNotte: null, attivoNotte: false, attivoGiorno: false, defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },

    effettoPassivo(evento, giocatori) {
      if (evento.tipo === "morte_giorno" && giocatori[evento.uid]?.gameRole === "Matto") {
        return {
          aggiornamenti: [],
          logEventi: [{ tipo: "folle_vince", uid: evento.uid, timestamp: Date.now() }]
        };
      }
      return { aggiornamenti: [], logEventi: [] };
    }
  },

  muccaMannara: {
    id: "muccaMannara", nome: "Mucca Mannara",
    descrizione: "Conosce i lupi dalla prima notte e vince con loro, ma i lupi non la conoscono e non è immune ai loro attacchi.",
    fazione: "lupi", fazioneApparente: "lupi",
    prioritaNotte: null, attivoNotte: false, attivoGiorno: false, defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  // ── SPETTRO DEL VILLAGGIO ─────────────────────────────────────────────────

  spettroDelVillaggio: {
    id: "spettroDelVillaggio", nome: "Spettro del Villaggio",
    descrizione: "Il primo morto diventa spettro: ogni notte sceglie un giocatore il cui voto al rogo vale doppio.",
    fazione: "neutrale", fazioneApparente: "villaggio",
    prioritaNotte: 15, attivoNotte: true, attivoGiorno: false, defaultCount: 0,
    isGhostRole: true,    // bypassa il check allDead nel wizard
    isGameMechanic: true, // non appare nella lista ruoli della lobby

    getWizardPlayers(stato, players) {
      const uid = stato.spettro;
      return uid && players[uid] ? [[uid, players[uid]]] : [];
    },

    controlliNotte(giocatori, azioni, stato) {
      const lastPick = stato.spettroLastPick ?? null;
      return [{
        tipo: "radio", label: "Scegli chi voterà doppio domani",
        chiaveAzione: "spettroTarget",
        filtroTarget: (p, uid) => p.isAlive && uid !== lastPick,
        opzionale: true
      }];
    },

    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  // ── Ruoli senza azione notturna ────────────────────────────────────────────

  figlioDelLupo: {
    id: "figlioDelLupo", nome: "Figlio del Lupo",
    descrizione: "Appare innocente; se ucciso dai lupi di notte diventa lupo.",
    fazione: "villaggio", fazioneApparente: "villaggio",
    prioritaNotte: null, attivoNotte: false, attivoGiorno: false, defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },
};

// ── Probabilità assegnazione Spettro ─────────────────────────────────────────
// deathsSoFar: morti avvenute senza che lo Spettro fosse assegnato (0-based).
// N: giocatori totali (escluso host), W: lupi "veri" (Lupo + Mucca Mannara).
// La formula garantisce il 100% all'ultima morte "sicura" prima della vittoria dei lupi.
export function calcSpettroProb(deathsSoFar, N, W) {
  const deadline = Math.max(1, N - 2 * W - 1);
  const k = deathsSoFar + 1; // k-esima morte
  if (deadline <= 1) return 1.0;
  const BASE = 0.7;
  return Math.min(1.0, BASE + (k - 1) * (1 - BASE) / (deadline - 1));
}
export function countWolves(players) {
  return Object.values(players).filter(p => RUOLI_LUPO_VERI.includes(p.gameRole)).length;
}

// ── Ruoli attivi di notte in partita, ordinati per priorità ──────────────────
export function getRuoliNotte(nomiAttiviInPartita) {
  return Object.values(ROLES)
    .filter(r => r.attivoNotte && nomiAttiviInPartita.includes(r.nome))
    .sort((a, b) => a.prioritaNotte - b.prioritaNotte);
}
