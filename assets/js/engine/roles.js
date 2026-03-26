// assets/js/engine/roles.js
// Ogni ruolo è un oggetto plugin autonomo.
// Il motore di gioco li cicla per prioritaNotte senza switch-case.

// Helper: mappa nome DB → id ruolo (deve stare prima di ROLES perché è usata a runtime)
export function ruoloIdFromNome(nome) {
  return Object.keys(ROLES).find(id => ROLES[id].nome === nome) ?? null;
}

// Helper: il giocatore con questo ruolo esce di casa questa notte?
// Usato dall'Investigatore per determinare il risultato.
export function playerEsceNotte(uid, player, azioni, stato) {
  const nome = player.gameRole;
  if (["Lupo", "Lupo Sciamano"].includes(nome)) return true;
  if (nome === "Puttana") return !!azioni.saved;
  if (nome === "Amante")  return !!(azioni.lovers?.[uid]);
  if (nome === "Mitomane") return stato.nightNumber === 1;
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
export const ROLES = {

  lupo: {
    id: "lupo",
    nome: "Lupo",
    descrizione: "I lupi indicano un giocatore da eliminare durante la notte.",
    fazione: "lupi",
    prioritaNotte: 20,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 1,

    controlliNotte(giocatori /*, azioni, stato */) {
      return [{
        tipo: "checkbox-multi",
        label: "Bersaglio",
        chiaveAzione: "killed",
        filtroTarget: (p) => !["Lupo", "Lupo Sciamano"].includes(p.gameRole) && p.isAlive
      }];
    },

    processaNotte(azioni, giocatori, stato) {
      const bersagli = Object.keys(azioni.killed || {});
      return {
        aggiornamenti: bersagli.map(uid => ({ uid, campi: { _morteNottePending: true } })),
        logEventi: bersagli.map(uid => ({
          tipo: "attacco_lupo", vittima: uid, notte: stato.nightNumber, timestamp: Date.now()
        }))
      };
    },

    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  // ── priorità 10: deve marcare il bersaglio PRIMA che il Veggente indaghi ──
  lupoSciamano: {
    id: "lupoSciamano",
    nome: "Lupo Sciamano",
    descrizione: "Maledice un giocatore: quella notte appare come lupo al Veggente.",
    fazione: "lupi",
    prioritaNotte: 10,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 0,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio",
        label: "Maledici",
        chiaveAzione: "sciamanoTarget",
        filtroTarget: (p) => !["Lupo", "Lupo Sciamano"].includes(p.gameRole) && p.isAlive,
        opzionale: true
      }];
    },

    processaNotte(azioni, giocatori, stato) {
      const uid = azioni.sciamanoTarget;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid, campi: { _sciamanoMaledetto: true } }],
        logEventi: [{ tipo: "sciamano_maledizione", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },

    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  puttana: {
    id: "puttana",
    nome: "Puttana",
    descrizione: "Ospita un giocatore; se i lupi attaccano casa sua quella notte si salva.",
    fazione: "villaggio",
    prioritaNotte: 30,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 1,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio",
        label: "Ospita",
        chiaveAzione: "saved",
        filtroTarget: (p) => p.isAlive,
        opzionale: true
      }];
    },

    // Il salvataggio vero viene risolto nella pipeline. Qui logghiamo solo.
    processaNotte(azioni, giocatori, stato) {
      const uid = azioni.saved;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [],
        logEventi: [{ tipo: "puttana_salva", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },

    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  amante: {
    id: "amante",
    nome: "Amante",
    descrizione: "Se dormono insieme e uno viene attaccato, muoiono tutti.",
    fazione: "neutrale",
    prioritaNotte: 40,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 0,

    controlliNotte(giocatori) {
      return [{
        tipo: "checkbox-multi",
        label: "Dorme con",
        chiaveAzione: "lovers",
        filtroTarget: (p) => p.gameRole === "Amante" && p.isAlive
      }];
    },

    // La morte a catena è gestita dalla pipeline
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  veggente: {
    id: "veggente",
    nome: "Veggente",
    descrizione: "Investiga un giocatore; il narratore rivela se è un lupo.",
    fazione: "villaggio",
    prioritaNotte: 50,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 1,

    controlliNotte() {
      return [{
        tipo: "radio",
        label: "Investiga",
        chiaveAzione: "investigated",
        filtroTarget: (p) => p.isAlive
      }];
    },

    processaNotte(azioni, giocatori, stato) {
      const uid = azioni.investigated;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const target = giocatori[uid];
      const isLupo = target._sciamanoMaledetto
        ? true
        : ["Lupo", "Lupo Sciamano"].includes(target.gameRole);
      return {
        aggiornamenti: [],
        logEventi: [{
          tipo: "veggente_risposta",
          bersaglio: uid,
          risultato: isLupo ? "lupo" : "innocente",
          notte: stato.nightNumber,
          timestamp: Date.now()
        }]
      };
    },

    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  investigatore: {
    id: "investigatore",
    nome: "Investigatore",
    descrizione: "Controlla se un giocatore esce di casa di notte.",
    fazione: "villaggio",
    prioritaNotte: 60,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 0,

    controlliNotte() {
      return [{
        tipo: "radio",
        label: "Sorveglia",
        chiaveAzione: "watched",
        filtroTarget: (p) => p.gameRole !== "Investigatore" && p.isAlive
      }];
    },

    processaNotte(azioni, giocatori, stato) {
      const uid = azioni.watched;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      const esce = playerEsceNotte(uid, giocatori[uid], azioni, stato);
      return {
        aggiornamenti: [],
        logEventi: [{
          tipo: "investigatore_risposta",
          bersaglio: uid,
          risultato: esce ? "esce" : "resta",
          notte: stato.nightNumber,
          timestamp: Date.now()
        }]
      };
    },

    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  muto: {
    id: "muto",
    nome: "Muto",
    descrizione: "Silenzia un giocatore per il giorno successivo.",
    fazione: "villaggio",
    prioritaNotte: 70,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 0,

    controlliNotte(giocatori) {
      return [{
        tipo: "radio",
        label: "Silenzia",
        chiaveAzione: "muted",
        filtroTarget: (p) => p.gameRole !== "Muto" && p.isAlive,
        opzionale: true
      }];
    },

    processaNotte(azioni, giocatori, stato) {
      const uid = azioni.muted;
      if (!uid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid, campi: { isMuted: true } }],
        logEventi: [{ tipo: "muto_silenzia", bersaglio: uid, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },

    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  mitomane: {
    id: "mitomane",
    nome: "Mitomane",
    descrizione: "La prima notte copia il ruolo di un altro giocatore.",
    fazione: "neutrale",
    prioritaNotte: 80,
    attivoNotte: true,
    attivoGiorno: false,
    defaultCount: 0,

    controlliNotte(giocatori, azioni, stato) {
      if (stato.nightNumber !== 1) return null;
      return [{
        tipo: "select-ruolo",
        label: "Copia ruolo",
        chiaveAzione: "copied"
      }];
    },

    processaNotte(azioni, giocatori, stato) {
      if (stato.nightNumber !== 1 || !azioni.copied) return { aggiornamenti: [], logEventi: [] };
      const mitUid = Object.keys(giocatori).find(uid => giocatori[uid].gameRole === "Mitomane");
      if (!mitUid) return { aggiornamenti: [], logEventi: [] };
      return {
        aggiornamenti: [{ uid: mitUid, campi: { gameRole: azioni.copied } }],
        logEventi: [{ tipo: "mitomane_copia", nuovoRuolo: azioni.copied, notte: stato.nightNumber, timestamp: Date.now() }]
      };
    },

    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  // ── Ruoli senza azione notturna — solo effettoPassivo o giorno ──

  figlioDelLupo: {
    id: "figlioDelLupo",
    nome: "Figlio del Lupo",
    descrizione: "Gioca da contadino; se ucciso dai lupi di notte diventa lupo.",
    fazione: "villaggio",
    prioritaNotte: null,
    attivoNotte: false,
    attivoGiorno: false,
    defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    // La trasformazione è gestita direttamente dalla pipeline in nightEngine
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  folle: {
    id: "folle",
    nome: "Folle",
    descrizione: "Vince se viene eliminato durante il giorno.",
    fazione: "neutrale",
    prioritaNotte: null,
    attivoNotte: false,
    attivoGiorno: false,
    defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },

    effettoPassivo(evento, giocatori) {
      if (evento.tipo === "morte_giorno" && giocatori[evento.uid]?.gameRole === "Folle") {
        return {
          aggiornamenti: [],
          logEventi: [{ tipo: "folle_vince", uid: evento.uid, timestamp: Date.now() }]
        };
      }
      return { aggiornamenti: [], logEventi: [] };
    }
  },

  kamikaze: {
    id: "kamikaze",
    nome: "Kamikaze",
    descrizione: "Alla sua morte di giorno, elimina uno dei votanti.",
    fazione: "villaggio",
    prioritaNotte: null,
    attivoNotte: false,
    attivoGiorno: false,
    defaultCount: 0,
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

  prete: {
    id: "prete",
    nome: "Prete",
    descrizione: "Di giorno indica un giocatore: se è un lupo muore, altrimenti muore il prete.",
    fazione: "villaggio",
    prioritaNotte: null,
    attivoNotte: false,
    attivoGiorno: true,
    defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  contadino: {
    id: "contadino",
    nome: "Contadino",
    descrizione: "Nessun potere speciale. La notte dorme come un pupo.",
    fazione: "villaggio",
    prioritaNotte: null,
    attivoNotte: false,
    attivoGiorno: false,
    defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  },

  corvo: {
    id: "corvo",
    nome: "Corvo",
    descrizione: "Durante le votazioni può assegnare un voto bonus a un giocatore. Il bersaglio non sa di essere marcato.",
    fazione: "neutrale",
    prioritaNotte: null,
    attivoNotte: false,
    attivoGiorno: true,
    defaultCount: 0,
    controlliNotte() { return null; },
    processaNotte() { return { aggiornamenti: [], logEventi: [] }; },
    effettoPassivo() { return { aggiornamenti: [], logEventi: [] }; }
  }
};

// Ruoli attivi di notte presenti in partita, ordinati per priorità
export function getRuoliNotte(nomiAttiviInPartita) {
  return Object.values(ROLES)
    .filter(r => r.attivoNotte && nomiAttiviInPartita.includes(r.nome))
    .sort((a, b) => a.prioritaNotte - b.prioritaNotte);
}
