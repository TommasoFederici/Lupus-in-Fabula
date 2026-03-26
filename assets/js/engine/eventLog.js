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
    case "attacco_lupo":                    return `🐺 I Lupi attaccano ${nome(e.vittima)}`;
    case "morte_notte":                     return `💀 ${nome(e.uid)} muore nella notte`;
    case "morte_giorno":                    return `🔥 ${nome(e.uid)} eliminato al rogo`;
    case "puttana_salva":                   return `🏠 La Puttana ospita ${nome(e.bersaglio)}`;
    case "puttana_salvataggio_effettivo":   return `✅ ${nome(e.bersaglio)} salvato dalla Puttana`;
    case "veggente_risposta":               return `🔭 Veggente su ${nome(e.bersaglio)}: ${e.risultato === "lupo" ? "LUPO 🐺" : "Innocente ✅"}`;
    case "investigatore_risposta":          return `🕵️ Investigatore su ${nome(e.bersaglio)}: ${e.risultato === "esce" ? "Esce di notte 🚶" : "Resta a casa 🏠"}`;
    case "medium_risposta":                 return `🕯️ Medium su ${nome(e.bersaglio)}: fazione ${e.fazione}`;
    case "missPurple_risposta":             return `💜 Miss Purple: ${e.conteggio} lupo/i in gioco`;
    case "lupoCieco_risposta":              return `🙈 Lupo Cieco: ${e.risultato === "si" ? "Lupo trovato nel trio 🐺" : "Nessun lupo nel trio ✅"}`;
    case "bugiardo_risposta":               return `🤥 Bugiardo su ${nome(e.bersaglio)}: era ${e.ruoloScoperto}`;
    case "boia_esecuzione":                 return `🪓 Boia → ${nome(e.bersaglio)} (${e.ruoloDichiarato}): ${e.indovinato ? "✅ Corretto" : "❌ Sbagliato"}`;
    case "mannaro_caccia":                  return `🌕 Lupo Mannaro → ${nome(e.bersaglio)} (${e.ruoloDichiarato}): ${e.indovinato ? "✅ Caccia riuscita" : "❌ Mancato"}`;
    case "angelo_resurrezione":             return `😇 Angelo resuscita ${nome(e.bersaglio)}`;
    case "giustiziere_esecuzione":          return `⚔️ Giustiziere giustizia ${nome(e.bersaglio)}`;
    case "parassita_infetta":               return `🦠 Parassita infetta ${nome(e.vittima)}`;
    case "muto_silenzia":                   return `🤐 ${nome(e.bersaglio)} viene silenziato`;
    case "sciamano_maledizione":            return `🔮 Sciamano maledice ${nome(e.bersaglio)}`;
    case "mitomane_copia":                  return `🎭 Mitomane diventa ${e.nuovoRuolo}`;
    case "figlio_diventa_lupo":             return `🌕 ${nome(e.uid)} (Figlio del Lupo) si trasforma in Lupo!`;
    case "amante_muore":                    return `💔 ${nome(e.uid)} muore di crepacuore (amante di ${nome(e.perColpaDi)})`;
    case "kamikaze_vendetta":               return `💥 Kamikaze ${nome(e.kamikaze)} porta con sé ${nome(e.morto)}`;
    case "folle_vince":                     return `🃏 ${nome(e.uid)} era il Folle e ha vinto!`;
    case "bloccato_da_illusionista":        return `🪄 Illusionista blocca: ${e.ruolo}`;
    case "spettro_assegnato":              return `👻 ${nome(e.uid)} diventa lo Spettro del Villaggio`;
    case "spettro_boost":                  return `👻 Spettro dà il voto doppio a ${nome(e.bersaglio)}`;
    case "spettro_no_boost":               return `👻 Lo Spettro non aiuta nessuno stanotte`;
    case "vittoria":                        return `🏆 VITTORIA: ${(e.vincitore ?? "").toUpperCase()}`;
    default:                                return e.tipo;
  }
}
