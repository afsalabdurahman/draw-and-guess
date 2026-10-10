# Pictionary Game Architecture

**PROJECT**: Real-time multiplayer Pictionary game (Skribbl.io style).

**STACK**:
* **Server**: Node.js + Express + Socket.IO + Zod (plain JavaScript ESM)
* **Client**: React + Vite + Zustand, HTML5 Canvas
* **Tests**: Vitest

**STATE**: In-memory Map of rooms (v1).

## Non-Negotiable Rules

1. **Server is the authority.** It alone checks guesses, keeps time, awards points.
2. **Secret Word Privacy.** The secret word is sent ONLY to the current drawer during a turn. Everyone else gets a masked hint like `_ p p _ e`. Revealed to all at turn end.
3. **Client Intents.** Clients send intents only, never scores or results.
4. **Time Synchronization.** Server sends `endsAt` (server timestamp); clients only display countdowns.
5. **Identity.** Identity = `playerId` + `reconnectToken`, NOT `socket.id`.
6. **Timer Management.** All timers live in one place and are cleared on every phase transition.
7. **Input Validation.** Every incoming socket event is validated with Zod; invalid payloads are dropped.
8. **Pure Functions.** Game logic (scoring, hints, guess matching, flood fill, rate limiter) are pure functions with unit tests.

## Game Phases

* `LOBBY` -> `CHOOSING_WORD` -> `DRAWING` -> `TURN_END` -> `GAME_END`

## Folder Structure

* `/server/src`: `index.js`, `rooms/`, `game/`, `net/`, `routes/`
* `/client/src`: `store/`, `socket/`, `canvas/`, `ui/`
