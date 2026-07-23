// assets/js/engine/eventLog.js
// Helper per scrivere eventi persistenti su Firebase.
// Il log è append-only e non viene mai cancellato a fine partita.

import { db } from "../firebase.js";
import { ref, push } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { escapeHtml } from "../ui.js";

export async function logEvento(gameCode, evento) {
  await push(ref(db, `games/${gameCode}/log`), {
    ...evento,
    timestamp: evento.timestamp ?? Date.now()
  });
}

export async function logEventi(gameCode, eventi) {
  for (const e of eventi) {
    await logEvento(gameCode, e);
  }
}

// Colore per tipo evento (bordo/testo nel log) — un solo posto, accanto al
// testo, invece che duplicato in game.js.
const LOG_TIPO_COLOR = {
  morte_notte:                    "#c84050",
  attacco_lupo:                   "#c84050",
  boia_esecuzione:                "#c84050",
  giustiziere_esecuzione:         "#d05060",
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
  bugiardo_risposta:              "#c06080",
  sciamano_insinuo:               "#8060c0",
  muto_silenzia:                  "#806080",
  folle_vince:                    "#a0c040",
  bloccato_da_stopper:            "#6080a0",
  stopper_blocca:                 "#6080a0",
  ammaestratore_reindirizza:      "#c09040",
  puttana_salva:                  "#40b880",
  spettro_assegnato:              "#8070b0",
  spettro_boost:                  "#8070b0",
  spettro_no_boost:               "#8070b0",
};

export function logEntryColor(tipo) {
  return LOG_TIPO_COLOR[tipo] ?? null;
}

// Formatta un evento in stringa leggibile per la UI
export function formatLogEntry(e, giocatori = {}) {
  const nome = (uid) => escapeHtml(giocatori[uid]?.name ?? uid);

  switch (e.tipo) {
    case "attacco_lupo":                    return `🐺 I Lupi attaccano ${nome(e.vittima)}${e.esito === "muore" ? " — muore" : e.esito === "sopravvive" ? " — sopravvive" : ""}`;
    case "morte_notte":                     return `💀 ${nome(e.uid)} muore nella notte`;
    case "morte_giorno":                    return `🔥 ${nome(e.uid)} eliminato al rogo`;
    case "puttana_salva":                   return `🏠 La Puttana ospita ${nome(e.bersaglio)}`;
    case "puttana_salvataggio_effettivo":   return `✅ ${nome(e.bersaglio)} salvato dalla Puttana`;
    case "veggente_risposta":               return `🔭 Veggente su ${nome(e.bersaglio)}: ${e.risultato === "lupo" ? "LUPO 🐺" : "Innocente ✅"}`;
    case "investigatore_risposta":          return `🕵️ Investigatore su ${nome(e.bersaglio)}: ${e.risultato === "esce" ? "Esce di notte 🚶" : "Resta a casa 🏠"}`;
    case "medium_risposta":                 return `🕯️ Medium su ${nome(e.bersaglio)}: fazione ${e.fazione}`;
    case "bugiardo_risposta":               return `🤥 Lupo Bugiardo su ${nome(e.bersaglio)}: era ${e.ruoloScoperto}`;
    case "boia_esecuzione":                 return `🪓 Boia dichiara "${e.ruoloDichiarato}" su ${nome(e.bersaglio)}: ${e.indovinato ? "✅ Corretto" : "❌ Sbagliato"} — muore ${nome(e.morto)}`;
    case "angelo_resurrezione":             return `😇 Angelo resuscita ${nome(e.bersaglio)}`;
    case "giustiziere_esecuzione":          return `⚔️ Cacciatore giustizia ${nome(e.bersaglio)}, che muore`;
    case "muto_silenzia":                   return `🤐 ${nome(e.bersaglio)} viene silenziato`;
    case "sciamano_insinuo":                return `🔮 Lupo Sciamano insinua su ${nome(e.bersaglio)}`;
    case "stopper_blocca":                  return `🪄 Stopper blocca ${nome(e.bersaglio)}`;
    case "ammaestratore_reindirizza":       return `🦁 Ammaestratore reindirizza l'attacco su ${nome(e.nuovoBersaglio)}${e.fallisce ? " (fallisce: bersaglio è un lupo)" : ""}`;
    case "mitomane_copia":                  return `🎭 Mitomane diventa ${e.nuovoRuolo}`;
    case "figlio_diventa_lupo":             return `🌕 ${nome(e.uid)} (Figlio del Lupo) si trasforma in Lupo!`;
    case "amante_muore":                    return `💔 ${nome(e.uid)} muore: era nella casa di ${nome(e.perColpaDi)}, bersaglio dei lupi stanotte`;
    case "kamikaze_vendetta":               return `💥 Kamikaze ${nome(e.kamikaze)} porta con sé ${nome(e.morto)}`;
    case "folle_vince":                     return `🃏 ${nome(e.uid)} era il Matto e ha vinto!`;
    case "bloccato_da_stopper":             return `🪄 Stopper blocca: ${e.ruolo}`;
    case "spettro_assegnato":              return `👻 ${nome(e.uid)} diventa lo Spettro del Villaggio`;
    case "spettro_boost":                  return `👻 Spettro dà il voto doppio a ${nome(e.bersaglio)}`;
    case "spettro_no_boost":               return `👻 Lo Spettro non aiuta nessuno stanotte`;
    case "vittoria":                        return `🏆 VITTORIA: ${(e.vincitore ?? "").toUpperCase()}`;
    default:                                return e.tipo;
  }
}
