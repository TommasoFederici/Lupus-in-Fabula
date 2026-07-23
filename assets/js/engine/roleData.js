// assets/js/engine/roleData.js
// Dati wiki/display per ogni ruolo — separati dalla logica di gioco (roles.js).
// Aggiungere un nuovo ruolo qui lo rende automaticamente visibile nella UI e nel modal.

export const CATEGORIES = [
  { id: "lupi",      label: "Il Branco",       color: "#c04848", bg: "#2a0808" },
  { id: "villaggio", label: "Il Villaggio",     color: "#4aaa66", bg: "#081a0a" },
  { id: "neutrale",  label: "Figure Speciali",  color: "#9070d4", bg: "#14082a" },
  { id: "solitari",  label: "Solitari",         color: "#cc8844", bg: "#1a1002" },
];

// Markup icona per un ruolo: <img> se esiste un file in assets/icons/,
// altrimenti fallback sull'emoji. Le icone scalano con font-size (1em)
// così si adattano al contesto (riga lobby, header wizard, card reveal...).
export function roleIconHtml(nome, emojiFallback = "•") {
  const icona = ROLE_DATA[nome]?.icona;
  return icona
    ? `<img class="role-icon-img" src="assets/icons/${icona}.png" alt="">`
    : (emojiFallback ?? "•");
}

// Chiave = ruolo.nome (stesso valore usato in roles.js)
// icona (opzionale) = nome file in assets/icons/<icona>.png, senza estensione
export const ROLE_DATA = {

  "Lupo": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🐺",
    icona: "lupo",
    descrizioneLunga: "Il predatore del villaggio. Ogni notte il branco si riunisce nell'ombra per scegliere chi eliminare.",
    meccaniche: [
      "Ogni notte vota insieme al branco per eliminare un giocatore",
      "Conosce l'identità di tutti gli altri lupi fin dall'inizio",
      "Vince quando i lupi eguagliano o superano in numero i villagers ancora in vita",
    ],
    abilita: [{ nome: "Caccia Notturna", desc: "Vota con il branco per eliminare un giocatore ogni notte" }],
  },

  "Lupo Sciamano": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🔮",
    icona: "lupo_sciamano",
    descrizioneLunga: "Un manipolatore che lavora nell'ombra per i lupi. Inverte la fazione apparente di un bersaglio: un lupo sembra innocente, un innocente sembra lupo.",
    meccaniche: [
      "Ogni notte sceglie un giocatore da 'insinuare'",
      "Inverte la fazione apparente: lupo → appare innocente, innocente → appare lupo",
      "L'effetto dura solo quella notte e inganna Veggente, Investigatore ecc.",
    ],
    abilita: [{ nome: "Insinuo", desc: "Inverte la fazione apparente di un bersaglio per una notte" }],
  },

  "Figlio del Lupo": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "🌕",
    icona: "figlio_del_lupo",
    descrizioneLunga: "Nato tra i villagers, porta nel sangue il gene della luna. Ignaro della sua natura, si trasforma se attaccato dai lupi.",
    meccaniche: [
      "All'inizio gioca e appare come un innocente contadino",
      "Se i lupi lo attaccano di notte, invece di morire si trasforma e si unisce al branco",
      "Da trasformato vince con i lupi",
    ],
    abilita: [{ nome: "Trasformazione", desc: "Sopravvive al primo attacco notturno dei lupi e si converte al branco" }],
  },

  "Indemoniato": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "😈",
    icona: "indemoniato",
    descrizioneLunga: "Un umano corrotto nell'anima che parteggia per i lupi, pur non conoscendoli personalmente.",
    meccaniche: [
      "Si comporta come un normale contadino e appare innocente alle investigazioni",
      "Vince solo se i lupi vincono la partita",
      "Deve aiutare i lupi durante il giorno influenzando i voti, anche senza sapere chi siano",
    ],
    abilita: [{ nome: "Fede Oscura", desc: "Vince con i lupi pur essendo tecnicamente umano" }],
  },

  "Stopper": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "🪄",
    icona: "stopper",
    descrizioneLunga: "Un esperto di inganni che può bloccare le capacità speciali degli altri giocatori durante la notte.",
    meccaniche: [
      "Ogni notte sceglie un giocatore da bloccare",
      "Il giocatore bloccato non può utilizzare la sua abilità speciale per quella notte",
    ],
    abilita: [{ nome: "Blocco Mentale", desc: "Impedisce a un giocatore di usare il proprio potere notturno" }],
  },

  "Lupo Bugiardo": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "🤥",
    icona: "bugiardo",
    descrizioneLunga: "Un informatore dei lupi che scava tra i segreti dei defunti per permettere ai lupi di rubarne l'identità.",
    meccaniche: [
      "Può agire una sola volta per partita, a partire dalla seconda notte",
      "Sceglie un giocatore morto e ne scopre il ruolo segreto",
    ],
    abilita: [{ nome: "Sciacallo", desc: "Scopre il ruolo di un giocatore eliminato" }],
  },

  "Boia": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🪓",
    icona: "boia",
    descrizioneLunga: "Un alleato dei lupi spietato che elimina i nemici dichiarando la loro identità segreta.",
    meccaniche: [
      "Può agire una sola volta per partita",
      "Deve dichiarare il ruolo esatto di un giocatore: se indovina, il bersaglio muore istantaneamente",
      "Se la dichiarazione è sbagliata, il Boia muore al posto del bersaglio",
    ],
    abilita: [{ nome: "Esecuzione Mirata", desc: "Uccide un giocatore indovinandone il ruolo esatto" }],
  },

  "Mucca Mannara": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🐮",
    icona: "mucca_mannara",
    descrizioneLunga: "Una creatura bizzarra alleata del branco. Conosce l'identità dei lupi fin dalla prima notte e vince insieme a loro, ma i lupi non sanno chi sia lei — e non è immune ai loro attacchi.",
    meccaniche: [
      "Fa parte della fazione dei lupi e vince insieme a loro",
      "Conosce l'identità dei lupi fin dalla prima notte",
      "I lupi NON sanno che è una loro alleata",
      "Non è immune all'attacco notturno dei lupi: può morire come chiunque altro",
    ],
    abilita: [{ nome: "Complicità Silenziosa", desc: "Conosce i lupi dalla prima notte e vince con loro, senza che loro la riconoscano" }],
  },

  "Contadino": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🌾",
    icona: "contadino",
    descrizioneLunga: "Il cuore pulsante del villaggio. Privo di poteri speciali, la sua unica arma è il ragionamento e il voto collettivo.",
    meccaniche: ["Nessun potere notturno", "Vince quando tutti i lupi sono stati eliminati"],
    abilita: [],
  },

  "Veggente": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🔭",
    icona: "veggente",
    descrizioneLunga: "Possiede il dono della seconda vista. Ogni notte può scrutare l'anima di un abitante per scoprire se nasconde una natura lupesca.",
    meccaniche: [
      "Ogni notte sceglie un giocatore e ne scopre la fazione apparente (lupo / non lupo)",
      "Il Lupo Sciamano può falsare il risultato invertendo la fazione apparente",
    ],
    abilita: [{ nome: "Visione", desc: "Rivela se il bersaglio appare come lupo o innocente" }],
  },

  "Puttana": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🏠",
    icona: "puttana",
    descrizioneLunga: "Gestisce una locanda dove ospita un avventore ogni notte. Chi si trova da lei è al sicuro dagli attacchi lupeschi.",
    meccaniche: [
      "Ogni notte sceglie un giocatore da ospitare",
      "Se i lupi attaccano il bersaglio ospitato, l'attacco fallisce",
      "Se i lupi attaccano direttamente la casa della puttana, lei muore",
    ],
    abilita: [{ nome: "Ospitalità", desc: "Protegge il giocatore ospitato dall'attacco notturno dei lupi" }],
  },

  "Investigatore": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🕵️",
    icona: "investigatore",
    descrizioneLunga: "Un detective che sorveglia i movimenti notturni. Sa se un giocatore è 'uscito di casa' quella notte.",
    meccaniche: [
      "Ogni notte sorveglia un giocatore",
      "Scopre se quel giocatore ha usato un'abilità notturna (è 'uscito di casa')",
    ],
    abilita: [{ nome: "Sorveglianza", desc: "Rivela se il bersaglio ha agito durante la notte" }],
  },

  "Muto": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🤐",
    icona: "muto",
    descrizioneLunga: "Un personaggio silenzioso con il potere di togliere la parola agli altri.",
    meccaniche: [
      "Ogni notte può scegliere un giocatore da silenziare",
      "Il giocatore silenziato non può parlare durante la giornata successiva",
    ],
    abilita: [{ nome: "Silenzio", desc: "Impedisce a un giocatore di comunicare il giorno successivo" }],
  },

  "Prete": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "✝️",
    icona: "prete",
    descrizioneLunga: "Un sacerdote disposto a rischiare la vita per purificare il villaggio.",
    meccaniche: [
      "Una volta per partita, durante il giorno, può accusare pubblicamente un giocatore",
      "Se il bersaglio è un lupo → il lupo muore immediatamente",
      "Se il bersaglio è innocente → il prete muore al suo posto",
    ],
    abilita: [{ nome: "Esorcismo", desc: "Accusa un giocatore di giorno: se è lupo muore lui, altrimenti muore il prete" }],
  },

  "Kamikaze": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "💥",
    icona: "kamikaze",
    descrizioneLunga: "Non teme la morte, la abbraccia come un'ultima vendetta.",
    meccaniche: [
      "Se viene eliminato tramite votazione diurna, uno dei votanti muore a caso",
      "Se muore di notte, il potere non si attiva",
    ],
    abilita: [{ nome: "Vendetta", desc: "Alla morte per voto diurno, elimina un votante casuale" }],
  },

  "Ammaestratore": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🦁",
    icona: "ammaestratore",
    descrizioneLunga: "Un esperto domatore capace di dirottare la sete di sangue dei lupi su un bersaglio diverso.",
    meccaniche: [
      "Può agire solo una volta per partita, a partire dalla seconda notte",
      "Sceglie un nuovo bersaglio per l'attacco dei lupi di quella notte",
      "Se sceglie un lupo, l'attacco fallisce e nessuno muore",
    ],
    abilita: [{ nome: "Reindirizzamento", desc: "Cambia il bersaglio dell'attacco dei lupi per una notte" }],
  },

  "Medium": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🕯️",
    icona: "medium",
    descrizioneLunga: "Un ponte tra il mondo dei vivi e quello dei morti. Ogni notte interroga un'anima per scoprirne la fazione.",
    meccaniche: [
      "Ogni notte sceglie un giocatore morto con cui comunicare",
      "Scopre per quale fazione giocava il defunto",
    ],
    abilita: [{ nome: "Seduta Spiritica", desc: "Scopre la fazione reale di un giocatore morto" }],
  },

  "Angelo": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "😇",
    icona: "angelo",
    descrizioneLunga: "Un essere divino con il potere di concedere una seconda possibilità.",
    meccaniche: [
      "Può agire una sola volta per partita",
      "Sceglie un giocatore morto da resuscitare con il suo ruolo originale",
    ],
    abilita: [{ nome: "Resurrezione", desc: "Riporta in vita un giocatore morto" }],
  },

  "Cacciatore": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "⚔️",
    icona: "cacciatore",
    descrizioneLunga: "Il vendicatore del villaggio. Non aspetta il rogo per eliminare chi ritiene colpevole.",
    meccaniche: [
      "Può agire una sola volta per partita",
      "Durante la notte sceglie un giocatore da giustiziare — l'azione è letale e non bloccabile",
    ],
    abilita: [{ nome: "Esecuzione Notturna", desc: "Uccide un giocatore a scelta durante la notte (non bloccabile)" }],
  },

  "Amante": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "💘",
    icona: "amanti",
    descrizioneLunga: "Legati da un amore che non conosce ragione (servono almeno due amanti in partita). Ogni notte scelgono, tutti insieme, in quale casa tra le loro dormire — o se restare ciascuno a casa propria.",
    meccaniche: [
      "Richiede almeno 2 Amanti in partita",
      "Ogni notte il narratore sceglie una casa comune tra quelle degli amanti vivi (o nessuna, se dormono separati)",
      "Se i lupi attaccano quella casa, muoiono tutti gli amanti lì presenti",
      "Se i lupi attaccano un'altra casa, o gli amanti dormono separati, non succede nulla di più",
    ],
    abilita: [{ nome: "Legame Fatale", desc: "Se attaccata, la casa comune degli amanti causa una morte multipla" }],
  },

  "Mitomane": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "🎭",
    icona: "mitomane",
    descrizioneLunga: "Un impostore maestro del travestimento. La prima notte ruba l'identità di un altro.",
    meccaniche: [
      "La prima notte sceglie un giocatore da copiare",
      "Da quel momento acquisisce il ruolo, le abilità e la fazione del bersaglio",
    ],
    abilita: [{ nome: "Copia", desc: "Diventa permanentemente il ruolo di un altro giocatore" }],
  },

  "Matto": {
    categoria: "solitari",
    fazioneApparente: "Villaggio",
    emoji: "🃏",
    icona: "matto",
    descrizioneLunga: "Un contadino eccentrico il cui unico scopo è convincere i compaesani a mandarlo al rogo.",
    meccaniche: [
      "Vince immediatamente se viene linciato durante la votazione diurna",
      "Se muore di notte, perde la partita",
    ],
    abilita: [],
  },

  "Spettro del Villaggio": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "👻",
    descrizioneLunga: "Il primo giocatore a morire non sparisce del tutto — il suo spirito rimane nel villaggio con un potere misterioso.",
    meccaniche: [
      "Diventa automaticamente Spettro il primo giocatore eliminato (di notte o al rogo)",
      "Ogni notte sceglie un giocatore vivo: il suo voto al rogo del giorno successivo vale 2",
      "Non può scegliere lo stesso giocatore due notti di fila",
      "Non può votare al rogo (è già morto)",
      "Vince con la sua fazione originale — lo spirito resta leale",
    ],
    abilita: [{ nome: "Voto Doppio", desc: "Il giocatore scelto di notte conta doppio al prossimo rogo" }],
  },
};
