# Lupus in Fabula

Versione online del gioco disponibile al [link](https://lupus-in-fabula-rimasto.netlify.app/)

## Tecnologie

- **Frontend**: HTML, CSS, JavaScript vanilla (ES modules)
- **Backend**: Firebase Realtime Database + autenticazione anonima
- **Font**: Cinzel (titoli) + Lora (testo) via Google Fonts
- **Dev server**: `npx serve .`

## Come si gioca

1. Un giocatore crea una partita e diventa il **narratore** (host)
2. Gli altri giocatori si uniscono tramite il codice a 5 caratteri visibile in lobby
3. Il narratore configura i ruoli nel tab **Ruoli** e le opzioni nel tab **Opzioni**
4. La partita inizia con fasi alternate di **notte** e **giorno**

## Funzionalità

### Lobby
- Codice partita condivisibile (tap per copiare negli appunti)
- Navigazione a tab Android-style: **Giocatori** · **Ruoli** · **Opzioni** (host)
- Griglia ruoli compatta con contatori ± e colori per fazione
- Redirect automatico al login se non autenticati o codice mancante

### Narratore (game.html)
- Dashboard notte sequenziale per ruolo con badge "in attesa" sui ruoli non completati
- Griglia giocatori giorno con badge morti/silenziati/bot
- Sezione votazione con contatori ±, evidenziazione condannato e bottone "Manda al Rogo"
- Modal di riepilogo animato a fine notte con righe colorate per tipo (morte / trasformazione / info)
- **Undo**: annulla l'ultima azione notturna
- Log di gioco collassabile con timestamp

### Giocatore
- Carta ruolo con reveal/nascondi
- Banner di stato (silenzio, eliminato)

### Dev Mode (host)
- Attivabile nelle Opzioni di lobby
- Aggiunge bot con uid univoco per testare senza giocatori reali
- Pulsante "Scelta Casuale Bot" nella dashboard notte per riempire automaticamente le azioni dei bot

### Opzioni partita
- **Salta Prima Notte**: nessun ruolo agisce nella notte 1

## Ruoli implementati (14)

| Ruolo | Fazione | Descrizione |
|---|---|---|
| **Lupo** | Lupi | Sceglie un giocatore da eliminare ogni notte |
| **Lupo Sciamano** | Lupi | Il bersaglio notturno appare come lupo al veggente |
| **Figlio del Lupo** | Lupi | Gioca come contadino; se ucciso di notte diventa lupo |
| **Contadino** | Villaggio | Nessun potere speciale |
| **Veggente** | Villaggio | Scopre se un giocatore bersaglio è un lupo |
| **Puttana** | Villaggio | Ospita un giocatore; se i lupi attaccano la sua casa, il bersaglio si salva |
| **Investigatore** | Villaggio | Scopre se un giocatore esce di casa di notte |
| **Muto** | Villaggio | Silenzia un giocatore per il giorno successivo |
| **Prete** | Villaggio | Attacco diurno: uccide il bersaglio se è un lupo, altrimenti muore lui |
| **Kamikaze** | Villaggio | Alla morte durante il giorno, elimina uno dei votanti |
| **Amante** | Neutrale | Se la sua casa viene attaccata, muoiono tutti gli amanti presenti |
| **Mitomane** | Neutrale | La prima notte copia il ruolo di un altro giocatore |
| **Folle** | Neutrale | Vince se viene eliminato durante il giorno |
| **Corvo** | Neutrale | Aggiunge un voto extra al bersaglio designato durante le votazioni |

## Architettura

```
├── index.html              # Pagina iniziale (crea / unisciti)
├── lobby.html              # Lobby pre-partita con nav a tab
├── game.html               # Schermata di gioco
└── assets/
    ├── js/
    │   ├── app.js          # Logica pagina iniziale + dialoghi
    │   ├── firebase.js     # Configurazione Firebase + auth anonima
    │   ├── lobby.js        # Logica lobby: tab, ruoli, giocatori, bot
    │   ├── game.js         # Logica di gioco: narratore, giocatore, votazione
    │   ├── ui.js           # Sistema dialoghi custom (alert/confirm/prompt/toast)
    │   └── engine/
    │       ├── roles.js        # Plugin ruoli (14 ruoli, architettura a oggetti)
    │       ├── nightEngine.js  # Pipeline risoluzione notte (8 step)
    │       └── eventLog.js     # Log eventi Firebase
    └── css/
        ├── base.css        # Design token, font, dialoghi UI, toast
        ├── style.css       # Landing page
        ├── lobby.css       # Lobby
        └── game.css        # Schermata di gioco
```

## Struttura Firebase

```
games/{gameCode}/
  host                        # uid host
  state/
    status                    # "waiting" | "running" | "ended"
    phase                     # "night" | "day"
    nightNumber               # numero notte corrente
    skipFirstNight            # boolean
    devMode                   # boolean
  players/{uid}/
    name, role, gameRole
    isAlive, isMuted, isBot
  roles/{roleName}/
    count, description
  nightActions/{uid}/...      # azioni notte per ruolo
  dayActions/{uid}/...        # voti giorno
  log/{pushId}/               # log eventi append-only
    tipo, uid, timestamp, ...
```
