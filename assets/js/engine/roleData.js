// assets/js/engine/roleData.js
// Dati wiki/display per ogni ruolo — separati dalla logica di gioco (roles.js).
// Aggiungere un nuovo ruolo qui lo rende automaticamente visibile nella UI e nel modal.

export const CATEGORIES = [
  { id: "lupi",      label: "Il Branco",       color: "#c04848", bg: "#2a0808" },
  { id: "villaggio", label: "Il Villaggio",     color: "#4aaa66", bg: "#081a0a" },
  { id: "neutrale",  label: "Figure Speciali",  color: "#9070d4", bg: "#14082a" },
];

// Chiave = ruolo.nome (stesso valore usato in roles.js)
export const ROLE_DATA = {

  "Lupo": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🐺",
    descrizioneLunga:
      "Il predatore del villaggio. Ogni notte il branco si riunisce nell'ombra per scegliere chi eliminare. Astuto e spietato, deve restare nascosto tra gli innocenti per portare i lupi alla vittoria.",
    meccaniche: [
      "Ogni notte vota insieme al branco per eliminare un giocatore",
      "Conosce l'identità di tutti gli altri lupi fin dall'inizio",
      "Vince quando i lupi eguagliano o superano in numero i villagers ancora in vita",
    ],
    abilita: [
      { nome: "Caccia Notturna", desc: "Vota con il branco per eliminare un giocatore ogni notte" },
    ],
  },

  "Lupo Sciamano": {
    categoria: "lupi",
    fazioneApparente: "Lupi",
    emoji: "🔮",
    descrizioneLunga:
      "Un lupo dotato di poteri mistici. Può alterare le visioni del Veggente, rendendo la chiaroveggenza inaffidabile e seminando confusione tra le forze del villaggio.",
    meccaniche: [
      "Agisce prima del Veggente nella sequenza notturna (priorità alta)",
      "Il bersaglio scelto quella notte appare come 'lupo' al Veggente",
      "Coopera col branco nella caccia notturna",
    ],
    abilita: [
      { nome: "Maledizione", desc: "Fa apparire un giocatore come lupo al Veggente per quella notte" },
    ],
  },

  "Figlio del Lupo": {
    categoria: "lupi",
    fazioneApparente: "Villaggio",
    emoji: "🌕",
    descrizioneLunga:
      "Nato tra i villagers, porta nel sangue il gene della luna. Ignaro della sua natura, gioca come un contadino finché i lupi non lo 'svegliano' attaccandolo di notte.",
    meccaniche: [
      "All'inizio gioca e appare come un innocente contadino",
      "Se i lupi lo attaccano di notte, invece di morire si trasforma e si unisce al branco",
      "Da trasformato vince con i lupi",
    ],
    abilita: [
      { nome: "Trasformazione", desc: "Sopravvive al primo attacco notturno dei lupi e si converte al branco" },
    ],
  },

  "Contadino": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🌾",
    descrizioneLunga:
      "Il cuore pulsante del villaggio. Privo di poteri speciali, la sua unica arma è il ragionamento e il voto collettivo. Un contadino che sopravvive e vota bene vale quanto uno specialista.",
    meccaniche: [
      "Nessun potere notturno",
      "Vince quando tutti i lupi sono stati eliminati",
    ],
    abilita: [],
  },

  "Veggente": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🔭",
    descrizioneLunga:
      "Possiede il dono della seconda vista. Ogni notte può scrutare l'anima di un abitante per scoprire se nasconde una natura lupesca. Il suo potere è immenso, ma attenzione al Lupo Sciamano.",
    meccaniche: [
      "Ogni notte sceglie un giocatore e ne scopre la fazione (lupo / non lupo)",
      "Il Lupo Sciamano può falsare il risultato su un bersaglio specifico quella notte",
      "Deve condividere le informazioni con cautela per non rivelare la propria identità",
    ],
    abilita: [
      { nome: "Visione", desc: "Rivela se il bersaglio è un lupo o un innocente" },
    ],
  },

  "Puttana": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🏠",
    descrizioneLunga:
      "Gestisce una locanda dove ospita un avventore ogni notte. Chi si trova da lei è al sicuro dagli attacchi lupeschi — ma attenzione: se i lupi attaccano la locanda, lei stessa è in pericolo.",
    meccaniche: [
      "Ogni notte sceglie un giocatore da ospitare nella sua casa",
      "Se i lupi attaccano il bersaglio ospitato, l'attacco fallisce (la puttana lo salva)",
      "Se i lupi attaccano direttamente la casa della puttana, lei muore",
    ],
    abilita: [
      { nome: "Ospitalità", desc: "Protegge il giocatore ospitato dall'attacco notturno dei lupi" },
    ],
  },

  "Investigatore": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🕵️",
    descrizioneLunga:
      "Un detective che sorveglia i movimenti notturni. Non sa cosa fa il bersaglio, ma sa se è uscito di casa — un'informazione preziosa per smascherare chi usa poteri nella notte.",
    meccaniche: [
      "Ogni notte sorveglia un giocatore",
      "Scopre se quel giocatore ha usato un'abilità notturna (è 'uscito di casa')",
      "Non rivela cosa ha fatto il bersaglio, solo se era attivo o meno",
    ],
    abilita: [
      { nome: "Sorveglianza", desc: "Rivela se il bersaglio ha agito durante la notte" },
    ],
  },

  "Muto": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "🤐",
    descrizioneLunga:
      "Un personaggio silenzioso con il potere di togliere la parola agli altri. Il silenzio può essere devastante nel dibattito diurno, neutralizzando i giocatori chiave del villaggio o del branco.",
    meccaniche: [
      "Ogni notte può scegliere un giocatore da silenziare",
      "Il giocatore silenziato non può parlare durante la giornata successiva",
      "Il narratore applica e fa rispettare il silenzio durante il giorno",
    ],
    abilita: [
      { nome: "Silenzio", desc: "Impedisce a un giocatore di comunicare il giorno successivo" },
    ],
  },

  "Prete": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "✝️",
    descrizioneLunga:
      "Un sacerdote disposto a rischiare la vita per purificare il villaggio. La sua accusa può smascherare un lupo, ma se sbaglia paga lui. Un'arma a doppio taglio da usare con saggezza.",
    meccaniche: [
      "Una volta per partita, durante il giorno, può accusare pubblicamente un giocatore",
      "Se il bersaglio è un lupo → il lupo muore immediatamente",
      "Se il bersaglio è innocente → il prete muore al suo posto",
    ],
    abilita: [
      { nome: "Esorcismo", desc: "Accusa un giocatore di giorno: se è lupo muore lui, altrimenti muore il prete" },
    ],
  },

  "Kamikaze": {
    categoria: "villaggio",
    fazioneApparente: "Villaggio",
    emoji: "💥",
    descrizioneLunga:
      "Non teme la morte, la abbraccia come un'ultima vendetta. Chi lo manda al rogo paga un prezzo: uno dei suoi accusatori viene trascinato con lui.",
    meccaniche: [
      "Se viene eliminato tramite votazione diurna",
      "Uno dei giocatori che hanno votato per lui viene eliminato a caso",
      "Se muore di notte per mano dei lupi, il potere non si attiva",
    ],
    abilita: [
      { nome: "Vendetta", desc: "Alla morte per voto diurno, elimina un votante casuale" },
    ],
  },

  "Amante": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "💘",
    descrizioneLunga:
      "Legato da un amore che non conosce ragione. Ogni notte si reca dal suo amato, e chi tenta di separare gli amanti si trova di fronte a una morte doppia. Vince con chiunque ami.",
    meccaniche: [
      "Ogni notte si reca a casa di un giocatore",
      "Se i lupi attaccano dove si trova l'amante, muoiono tutti i presenti",
      "Vince insieme alla fazione del giocatore con cui si trovava al momento della vittoria",
    ],
    abilita: [
      { nome: "Legame Fatale", desc: "La sua presenza causa morte multipla in caso di attacco" },
    ],
  },

  "Mitomane": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "🎭",
    descrizioneLunga:
      "Un impostore maestro del travestimento. La prima notte ruba l'identità di un altro, diventando per tutti gli effetti quel personaggio. La sua vera fazione dipende da chi copia.",
    meccaniche: [
      "La prima notte sceglie un giocatore da copiare",
      "Da quel momento acquisisce il ruolo, le abilità e la fazione del bersaglio",
      "Vince con la fazione del ruolo copiato",
    ],
    abilita: [
      { nome: "Copia", desc: "Diventa il ruolo di un altro giocatore dalla seconda notte in poi" },
    ],
  },

  "Folle": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "🃏",
    descrizioneLunga:
      "Un pazzo che desidera ardentemente essere bruciato sul rogo. La sua vittoria è paradossale: deve convincere il villaggio di essere un lupo senza esserlo. Un gioco di bluff puro.",
    meccaniche: [
      "Vince solo se viene eliminato tramite votazione durante il giorno",
      "Perde se sopravvive fino alla fine della partita",
      "Perde se viene eliminato di notte dai lupi",
      "Non ha poteri notturni",
    ],
    abilita: [],
  },

  "Corvo": {
    categoria: "neutrale",
    fazioneApparente: "Villaggio",
    emoji: "🐦‍⬛",
    descrizioneLunga:
      "Un messaggero oscuro che può orientare il voto del villaggio. Il suo potere è sottile ma devastante: un voto extra sul bersaglio giusto può cambiare l'esito di un'intera giornata.",
    meccaniche: [
      "Durante la fase di votazione diurna, può segnalare un giocatore",
      "Il giocatore segnalato riceve automaticamente un voto extra nel conteggio finale",
      "Il narratore applica il bonus voto prima di annunciare il condannato",
    ],
    abilita: [
      { nome: "Segnalazione", desc: "Aggiunge un voto extra al bersaglio designato durante le votazioni" },
    ],
  },

};
