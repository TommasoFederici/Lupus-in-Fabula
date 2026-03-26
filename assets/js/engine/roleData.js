// assets/js/engine/roleData.js
// Dati wiki/display per ogni ruolo — separati dalla logica di gioco (roles.js).
// Aggiungere un nuovo ruolo qui lo rende automaticamente visibile nella UI e nel modal.

export const CATEGORIES = [
  { id: "lupi",      label: "Il Branco",       color: "#c04848", bg: "#2a0808" },
  { id: "villaggio", label: "Il Villaggio",     color: "#4aaa66", bg: "#081a0a" },
  { id: "neutrale",  label: "Figure Speciali",  color: "#9070d4", bg: "#14082a" },
  { id: "mannari",   label: "Mannari",          color: "#d4884a", bg: "#1a0d02" },
  { id: "alieni",    label: "Alieni",           color: "#44c4c4", bg: "#021a1a" },
  { id: "parassita", label: "Parassita",        color: "#88cc44", bg: "#0a1a02" },
  { id: "solitari",  label: "Solitari",         color: "#cc8844", bg: "#1a1002" },
];

// Chiave = ruolo.nome (stesso valore usato in roles.js)
export const ROLE_DATA = {

  "Lupo": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🐺",
    descrizioneLunga: "Il predatore del villaggio. Ogni notte il branco si riunisce nell'ombra per scegliere chi eliminare.",
    meccaniche: [
      "Ogni notte vota insieme al branco per eliminare un giocatore",
      "Conosce l'identità di tutti gli altri lupi fin dall'inizio",
      "Vince quando i lupi eguagliano o superano in numero i villagers ancora in vita",
    ],
    abilita: [{ nome: "Caccia Notturna", desc: "Vota con il branco per eliminare un giocatore ogni notte" }],
  },

  "Sciamano": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🔮",
    descrizioneLunga: "Un manipolatore che lavora nell'ombra per i lupi. Inverte la fazione apparente di un bersaglio: un lupo sembra innocente, un innocente sembra lupo.",
    meccaniche: [
      "Ogni notte sceglie un giocatore da 'insinuare'",
      "Inverte la fazione apparente: lupo → appare innocente, innocente → appare lupo",
      "L'effetto dura solo quella notte e inganna Veggente, Miss Purple, Lupo Cieco ecc.",
    ],
    abilita: [{ nome: "Insinuo", desc: "Inverte la fazione apparente di un bersaglio per una notte" }],
  },

  "Figlio del Lupo": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "🌕",
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
    descrizioneLunga: "Un umano corrotto nell'anima che parteggia per i lupi, pur non conoscendoli personalmente.",
    meccaniche: [
      "Si comporta come un normale contadino e appare innocente alle investigazioni",
      "Vince solo se i lupi vincono la partita",
      "Deve aiutare i lupi durante il giorno influenzando i voti, anche senza sapere chi siano",
    ],
    abilita: [{ nome: "Fede Oscura", desc: "Vince con i lupi pur essendo tecnicamente umano" }],
  },

  "Illusionista": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "🪄",
    descrizioneLunga: "Un esperto di inganni che può bloccare le capacità speciali degli altri giocatori durante la notte.",
    meccaniche: [
      "Ogni notte sceglie un giocatore da bloccare",
      "Il giocatore bloccato non può utilizzare la sua abilità speciale per quella notte",
    ],
    abilita: [{ nome: "Blocco Mentale", desc: "Impedisce a un giocatore di usare il proprio potere notturno" }],
  },

  "Bugiardo": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "🤥",
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
    descrizioneLunga: "Un alleato dei lupi spietato che elimina i nemici dichiarando la loro identità segreta.",
    meccaniche: [
      "Può agire una sola volta per partita",
      "Deve dichiarare il ruolo esatto di un giocatore: se indovina, il bersaglio muore istantaneamente",
      "Se la dichiarazione è sbagliata, il Boia muore al posto del bersaglio",
    ],
    abilita: [{ nome: "Esecuzione Mirata", desc: "Uccide un giocatore indovinandone il ruolo esatto" }],
  },

  "Lupo Ciccione": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🍔",
    descrizioneLunga: "Un lupo talmente imponente da oscurare i vicini, facendoli sembrare parte del branco.",
    meccaniche: [
      "Apre gli occhi con il branco",
      "Passivamente, fa apparire i due giocatori vivi alla sua sinistra e destra come lupi",
      "Confonde permanentemente le investigazioni su quei bersagli finché è in vita",
    ],
    abilita: [{ nome: "Ingombro Visivo", desc: "I giocatori adiacenti (per ordine di turno) appaiono come lupi" }],
  },

  "Lupo Cieco": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🙈",
    descrizioneLunga: "Un lupo solitario che non conosce il resto del branco e deve affidarsi al suo fiuto per trovare compagni o vittime.",
    meccaniche: [
      "Agisce dalla seconda notte in poi",
      "Sceglie un giocatore: investiga lui e i due adiacenti (sinistra/destra nella lista)",
      "Scopre se tra i tre c'è almeno un lupo (o qualcuno che appare come tale)",
    ],
    abilita: [{ nome: "Fiuto del Branco", desc: "Investiga 3 giocatori contigui per trovare eventuali lupi" }],
  },

  "Contadino": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🌾",
    descrizioneLunga: "Il cuore pulsante del villaggio. Privo di poteri speciali, la sua unica arma è il ragionamento e il voto collettivo.",
    meccaniche: ["Nessun potere notturno", "Vince quando tutti i lupi sono stati eliminati"],
    abilita: [],
  },

  "Veggente": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🔭",
    descrizioneLunga: "Possiede il dono della seconda vista. Ogni notte può scrutare l'anima di un abitante per scoprire se nasconde una natura lupesca.",
    meccaniche: [
      "Ogni notte sceglie un giocatore e ne scopre la fazione apparente (lupo / non lupo)",
      "Lo Sciamano può falsare il risultato invertendo la fazione apparente",
    ],
    abilita: [{ nome: "Visione", desc: "Rivela se il bersaglio appare come lupo o innocente" }],
  },

  "Puttana": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🏠",
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
    descrizioneLunga: "Non teme la morte, la abbraccia come un'ultima vendetta.",
    meccaniche: [
      "Se viene eliminato tramite votazione diurna, uno dei votanti muore a caso",
      "Se muore di notte, il potere non si attiva",
    ],
    abilita: [{ nome: "Vendetta", desc: "Alla morte per voto diurno, elimina un votante casuale" }],
  },

  "Miss Purple": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "💜",
    descrizioneLunga: "Una contadina sensitiva che percepisce la presenza del male senza individuare i singoli colpevoli.",
    meccaniche: [
      "Ogni notte scopre il numero totale di giocatori vivi che appaiono come lupi",
      "Il conteggio include lupi reali e ruoli ingannati (es. Sciamano, Lupo Ciccione)",
    ],
    abilita: [{ nome: "Sesto Senso", desc: "Rivela quanti giocatori 'malvagi' sono ancora in gioco" }],
  },

  "Ammaestratore": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🦁",
    descrizioneLunga: "Un esperto domatore capace di dirottare la sete di sangue dei lupi su un bersaglio diverso.",
    meccaniche: [
      "Può agire solo una volta per partita, a partire dalla seconda notte",
      "Sceglie un nuovo bersaglio per l'attacco dei lupi di quella notte",
      "Se sceglie un lupo, l'attacco fallisce e nessuno muore",
    ],
    abilita: [{ nome: "Reindirizzamento", desc: "Cambia il bersaglio dell'attacco dei lupi per una notte" }],
  },

  "Genio": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🧞‍♂️",
    descrizioneLunga: "Un'entità magica capace di mutare la propria essenza. Può trasformarsi in un altro ruolo scelto tra tre opzioni casuali.",
    meccaniche: [
      "Può usare il potere una sola volta per partita, dalla terza notte in poi",
      "Sceglie un ruolo tra tre opzioni casuali proposte dal narratore",
      "Una volta trasformato, assume permanentemente i poteri del nuovo ruolo",
    ],
    abilita: [{ nome: "Metamorfosi", desc: "Si trasforma in un nuovo ruolo scelto tra tre opzioni casuali" }],
  },

  "Medium": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🕯️",
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
    descrizioneLunga: "Un essere divino con il potere di concedere una seconda possibilità.",
    meccaniche: [
      "Può agire una sola volta per partita",
      "Sceglie un giocatore morto da resuscitare con il suo ruolo originale",
    ],
    abilita: [{ nome: "Resurrezione", desc: "Riporta in vita un giocatore morto" }],
  },

  "Giustiziere": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "⚔️",
    descrizioneLunga: "Il vendicatore del villaggio. Non aspetta il rogo per eliminare chi ritiene colpevole.",
    meccaniche: [
      "Può agire una sola volta per partita",
      "Durante la notte sceglie un giocatore da giustiziare — l'azione è letale e non bloccabile",
    ],
    abilita: [{ nome: "Esecuzione Notturna", desc: "Uccide un giocatore a scelta durante la notte (non bloccabile)" }],
  },

  "Massone": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🧱",
    descrizioneLunga: "Membro di una società segreta. I massoni si riconoscono tra loro, creando un nucleo di certezze nel villaggio.",
    meccaniche: [
      "Conosce l'identità degli altri Massoni fin dall'inizio",
      "Nessun potere attivo notturno — la sua forza è la conoscenza degli alleati",
    ],
    abilita: [{ nome: "Fratellanza", desc: "Conosce gli altri giocatori con ruolo Massone" }],
  },

  "Amante": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "💘",
    descrizioneLunga: "Legato da un amore che non conosce ragione. Chi tenta di separare gli amanti si trova di fronte a una morte doppia.",
    meccaniche: [
      "Ogni notte si reca a casa di un giocatore",
      "Se i lupi attaccano dove si trova l'amante, muoiono tutti i presenti",
    ],
    abilita: [{ nome: "Legame Fatale", desc: "La sua presenza causa morte multipla in caso di attacco" }],
  },

  "Mitomane": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "🎭",
    descrizioneLunga: "Un impostore maestro del travestimento. La prima notte ruba l'identità di un altro.",
    meccaniche: [
      "La prima notte sceglie un giocatore da copiare",
      "Da quel momento acquisisce il ruolo, le abilità e la fazione del bersaglio",
    ],
    abilita: [{ nome: "Copia", desc: "Diventa permanentemente il ruolo di un altro giocatore" }],
  },

  "Corvo": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "🐦‍⬛",
    descrizioneLunga: "Un messaggero oscuro che può orientare il voto del villaggio con un bonus voto.",
    meccaniche: [
      "Durante la fase di votazione diurna, può segnalare un giocatore",
      "Il giocatore segnalato riceve automaticamente un voto extra nel conteggio finale",
    ],
    abilita: [{ nome: "Segnalazione", desc: "Aggiunge un voto extra al bersaglio designato durante le votazioni" }],
  },

  "Folle": {
    categoria: "solitari",
    fazioneApparente: "Villaggio",
    emoji: "🃏",
    descrizioneLunga: "Un contadino eccentrico il cui unico scopo è convincere i compaesani a mandarlo al rogo.",
    meccaniche: [
      "Vince immediatamente se viene linciato durante la votazione diurna",
      "Se muore di notte, perde la partita",
    ],
    abilita: [],
  },

  "Lupo Mannaro": {
    categoria: "mannari",
    fazioneApparente: "Lupi",
    emoji: "🌕",
    descrizioneLunga: "Un predatore solitario e spietato che gioca una partita a sé stante, cacciando sia villici che lupi.",
    meccaniche: [
      "Gioca da solo — non può essere ucciso dall'attacco dei lupi",
      "Ogni notte può tentare di uccidere un giocatore dichiarandone correttamente il ruolo",
      "Se indovina il ruolo, il bersaglio muore; se sbaglia, non succede nulla",
      "Vince se rimane l'ultimo superstite (o in coppia con la Mucca Mannara)",
    ],
    abilita: [{ nome: "Caccia Totale", desc: "Uccide chiunque indovinandone il ruolo; immune ai lupi" }],
  },

  "Mucca Mannara": {
    categoria: "mannari",
    fazioneApparente: "Lupi",
    emoji: "🐮",
    descrizioneLunga: "Una creatura bizzarra che gioca una partita solitaria. Conosce i lupi, appare come lupo, ma non muore per mano loro.",
    meccaniche: [
      "Appare come lupo alle investigazioni",
      "Conosce l'identità dei lupi all'inizio della partita",
      "Immune agli attacchi notturni dei lupi",
      "Vince con i Mannari (se sopravvive come ultimo/a o in coppia con Lupo Mannaro)",
    ],
    abilita: [{ nome: "Mimetismo Bovino", desc: "Appare come lupo e conosce i lupi, ma è immune ai loro attacchi" }],
  },

  "Mutaforma": {
    categoria: "alieni",
    fazioneApparente: "Villaggio",
    emoji: "👽",
    descrizioneLunga: "Un'entità aliena capace di replicare perfettamente le abilità altrui ogni notte.",
    meccaniche: [
      "Ogni notte sceglie un giocatore vivente e ne copia il ruolo per quella notte",
      "Se il ruolo copiato ha un'azione investigativa, può eseguirla nello stesso turno",
      "Vince con la fazione Alieni",
    ],
    abilita: [{ nome: "Simulazione", desc: "Copia il ruolo e i poteri di un giocatore per una notte" }],
  },

  "Simbionte": {
    categoria: "alieni",
    fazioneApparente: "Villaggio",
    emoji: "🧬",
    descrizioneLunga: "Un parassita alieno che si lega a un ospite la prima notte, assumendone permanentemente l'identità.",
    meccaniche: [
      "Agisce obbligatoriamente la prima notte",
      "Sceglie un giocatore e assume immediatamente il suo ruolo in modo permanente",
      "Vince con la fazione Alieni",
    ],
    abilita: [{ nome: "Assimilazione", desc: "Assume permanentemente il ruolo di un altro giocatore (notte 1)" }],
  },

  "Parassita": {
    categoria: "parassita",
    fazioneApparente: "Villaggio",
    emoji: "🦠",
    descrizioneLunga: "Una minaccia biologica che mira alla totale infestazione. Vince quando non rimane più nessuno sano.",
    meccaniche: [
      "Ogni notte sceglie chi infettare",
      "Notte 1: fino a 3 bersagli · Notte 2: fino a 2 · Notte 3+: 1 bersaglio",
      "Vince istantaneamente se tutti i giocatori vivi sono infetti",
    ],
    abilita: [{ nome: "Contagio", desc: "Infetta i giocatori progressivamente per vincere in solitaria" }],
  },
};
