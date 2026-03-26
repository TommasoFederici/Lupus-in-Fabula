# Lupus in Fabula

Versione online del gioco disponibile al [link](https://lupus-in-fabula-rimasto.netlify.app/)

## Tecnologie

- **Frontend**: HTML, CSS, JavaScript vanilla
- **Backend**: Firebase (Realtime Database + autenticazione anonima)

## Come si gioca

1. Un giocatore crea una partita e diventa il **narratore** (host)
2. Gli altri giocatori si uniscono tramite un codice a 5 caratteri
3. Il narratore configura i ruoli nella lobby
4. La partita inizia con fasi alternate di **notte** e **giorno**

## Funzionalità

- Codici partita casuali per unirsi in multiplayer
- Sincronizzazione in tempo reale tra tutti i client
- Vista separata per narratore e giocatori (ogni giocatore vede solo il proprio ruolo)
- Gestione automatica delle azioni notturne al cambio di fase
- Fine partita con ritorno automatico alla lobby per tutti

## Ruoli implementati (13)

| Ruolo | Descrizione |
|---|---|
| **Lupo** | Sceglie un giocatore da eliminare ogni notte |
| **Veggente** | Scopre se un giocatore bersaglio è un lupo |
| **Puttana** | Ogni notte ospita un giocatore; se i lupi attaccano casa sua, il bersaglio si salva |
| **Amante** | Se la sua casa viene attaccata, muoiono tutti gli amanti presenti |
| **Folle** | Vince se viene eliminato durante il giorno |
| **Kamikaze** | Alla morte, elimina uno dei votanti |
| **Contadino** | Nessun potere speciale |
| **Mitomane** | La prima notte copia il ruolo di un altro giocatore |
| **Figlio del Lupo** | Gioca come contadino; se ucciso di notte diventa lupo |
| **Lupo Sciamano** | Il bersaglio notturno appare come lupo al veggente |
| **Muto** | Silenzia un giocatore per il giorno successivo |
| **Investigatore** | Scopre se un giocatore esce di casa di notte |
| **Prete** | Attacco diurno: uccide il bersaglio se è un lupo, altrimenti muore lui |

## Struttura del progetto

```
├── index.html          # Pagina iniziale (crea/unisciti)
├── lobby.html          # Lobby pre-partita
├── game.html           # Schermata di gioco
├── assets/
│   ├── js/
│   │   ├── app.js      # Logica pagina iniziale
│   │   ├── firebase.js # Configurazione Firebase
│   │   ├── lobby.js    # Logica lobby
│   │   └── game.js     # Logica di gioco e fasi
│   ├── css/
│   │   ├── style.css
│   │   ├── lobby.css
│   │   └── game.css
│   └── data/
│       └── roles.json  # Definizioni e descrizioni dei ruoli
```
