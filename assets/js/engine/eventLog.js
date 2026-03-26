// assets/js/engine/eventLog.js
// Helper per scrivere eventi persistenti su Firebase.
// Il log è append-only e non viene mai cancellato a fine partita.

import { db } from "../firebase.js";
import { ref, push } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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

// Formatta un evento in stringa leggibile per la UI
export function formatLogEntry(e, giocatori = {}) {
  const nome = (uid) => giocatori[uid]?.name ?? uid;

  switch (e.tipo) {
    case "attacco_lupo":           return `🐺 Lupi attaccano ${nome(e.vittima)}`;
    case "morte_notte":            return `💀 ${nome(e.uid)} muore nella notte`;
    case "puttana_salva":          return `❤️  Puttana ospita ${nome(e.bersaglio)}`;
    case "puttana_salvataggio_effettivo": return `✅ ${nome(e.bersaglio)} salvato dalla Puttana`;
    case "veggente_risposta":      return `🔮 Veggente su ${nome(e.bersaglio)}: ${e.risultato === "lupo" ? "LUPO 🐺" : "Innocente ✅"}`;
    case "investigatore_risposta": return `🔍 Investigatore su ${nome(e.bersaglio)}: ${e.risultato === "esce" ? "Esce di notte 🚶" : "Resta a casa 🏠"}`;
    case "muto_silenzia":          return `🤐 ${nome(e.bersaglio)} silenziato`;
    case "mitomane_copia":         return `🎭 Mitomane diventa ${e.nuovoRuolo}`;
    case "figlio_diventa_lupo":    return `🐺 ${nome(e.uid)} (Figlio del Lupo) si trasforma!`;
    case "amante_muore":           return `💔 ${nome(e.uid)} muore per ${nome(e.perColpaDi)}`;
    case "sciamano_maledizione":   return `🌀 Lupo Sciamano maledice ${nome(e.bersaglio)}`;
    case "kamikaze_vendetta":      return `💥 Kamikaze (${nome(e.kamikaze)}) porta con sé ${nome(e.morto)}`;
    case "folle_vince":            return `🃏 ${nome(e.uid)} era il Folle e ha vinto!`;
    case "morte_giorno":           return `⚔️  ${nome(e.uid)} eliminato di giorno`;
    default:                       return e.tipo;
  }
}
