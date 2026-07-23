// assets/js/engine/gameReset.js
// Reset dello stato "residuo" di una partita — condiviso tra lobby.js
// (startGame, inizio nuova partita) e game.js (handleEndGame, fine partita)
// così i due punti restano sempre in sync quando si aggiunge un nuovo campo.
export function buildResidualStateUpdates(players) {
  const updates = {
    nightActions: null,
    dayActions: null,
    tempFeedback: null,
    log: null,
  };
  for (const uid in players) {
    if (players[uid].role !== "host") {
      updates[`players/${uid}/isAlive`] = true;
      updates[`players/${uid}/isMuted`] = false;
    }
  }
  return updates;
}
