# 🎨 Sketch & Guess

A real-time multiplayer drawing and guessing game for the browser, in the style of Skribbl.io. One player gets a secret word and draws it. Everyone else guesses in chat, and faster correct guesses earn more points.
![Background](https://github.com/afsalabdurahman/draw-and-guess/blob/main/client/public/screenshot1.png)
![Background](https://github.com/afsalabdurahman/draw-and-guess/blob/main/client/public/screen2.png)

## Features

- **Rooms with shareable links.** The host sets rounds, draw time and word list.
- **Drawing tools.** Pen, colours, brush size, eraser, fill, undo and clear. Strokes stream live to every player.
- **Turn flow.** The drawer picks from 3 words, a countdown starts, and letter hints reveal over time.
- **Server-authoritative.** The server alone checks guesses, keeps time and awards points. The secret word is never sent to guessers.
- **Smart chat.** Correct guessers can't leak the word. Near-misses show "close!" to the sender only.
- **Reconnect support.** Refresh or drop for up to 30 seconds and rejoin with your score kept. Late joiners see the canvas as it stands.
- **Recovery.** If the drawer leaves mid-turn, the game ends the turn cleanly and moves on.
- **Abuse protection.** Rate limits and size limits on chat and strokes, plus Zod validation on every event.
- **Replay.** A stroke-by-stroke replay of every drawing at the end of the game.

## Tech stack

| Layer | Technology |
|---|---|
| Server | Node.js, Express, Socket.IO, Zod (plain JavaScript, ESM) |
| Client | React, Vite, Zustand, HTML5 Canvas |
| Tests | Vitest, socket.io-client |
| State | In-memory `Map` of rooms (v1) |

## Architecture rules

1. The server is the authority. It alone checks guesses, keeps time and awards points.
2. The secret word goes only to the current drawer. Everyone else gets a masked hint like `_ p p _ e`, and the word is revealed to all at turn end.
3. Clients send intents only, never scores or results.
4. The server sends `endsAt` (a server timestamp). Clients only display countdowns.
5. Identity is `playerId` + `reconnectToken`, not `socket.id`.
6. All timers live in one place and are cleared on every phase transition.
7. Every incoming socket event is validated with Zod. Invalid payloads are dropped.
8. Game logic (scoring, hints, guess matching, flood fill, rate limiter) is pure and unit tested.

## Game phases

```
LOBBY -> CHOOSING_WORD -> DRAWING -> TURN_END -> GAME_END
```

| Phase | What happens |
|---|---|
| `LOBBY` | Players join, host edits settings and starts the game (2+ players) |
| `CHOOSING_WORD` | The drawer picks from 3 words (auto-pick after 15s) |
| `DRAWING` | Timer runs, strokes stream, hints reveal, guesses are scored |
| `TURN_END` | The word is revealed and points are shown for 5s |
| `GAME_END` | Final scoreboard and replay viewer |

## Project structure

```
/server
  /src
    index.js        # Express + Socket.IO bootstrap
    /rooms          # RoomManager, Room, state machine
    /game           # scoring, hints, guess, words
    /net            # handlers, schemas, rate limiting
    /routes         # REST routes
/client
  /public
    /picture-bg     # background image
  /src
    /store          # Zustand store
    /socket         # socket client
    /canvas         # renderer, flood fill, tools
    /ui             # Lobby, Game, Chat, PlayerList, WordPicker, Replay
```

## Getting started

**Requirements:** Node.js 18 or newer.

```bash
# 1. Clone
git clone https://github.com/<your-username>/sketch-and-guess.git
cd sketch-and-guess

# 2. Start the server (http://localhost:4000)
cd server
npm install
npm run dev

# 3. Start the client (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

Open `http://localhost:5173`, create a room, and copy the invite link into a second tab to play against yourself.

## Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `4000` | Server port |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` | Allowed CORS origin |
| `VITE_SERVER_URL` | client | `http://localhost:4000` | Server URL used by the client |

## Testing

```bash
cd server
npm test
```

Covers scoring, hints, guess matching, rate limiting, flood fill, room and reconnect flows, and a cheat audit that checks the secret word never appears in any payload sent to guessers.

## Security

- All socket events are validated with Zod.
- Token-bucket rate limits per socket and per event type.
- Limits on message length, points per stroke batch, points per stroke and ops per turn.
- Repeated violations lead to a kick.
- Client text is rendered by React with no `dangerouslySetInnerHTML`.

## Deployment notes

- Build the client with `npm run build` in `/client` and serve `dist/` from any static host.
- Run the server with `node src/index.js` behind a proxy that supports WebSockets.
- State is in memory, so a restart clears all rooms. To scale to multiple servers, add Redis and the Socket.IO Redis adapter.

## Roadmap

- [ ] Foundation: rooms, join, reconnect tokens
- [ ] Lobby settings and host migration
- [ ] Canvas tools and flood fill
- [ ] Real-time stroke streaming and late-join snapshots
- [ ] Game engine: turns, words, guessing, scoring, hints
- [ ] Resilience: 30s grace, drawer-leave recovery
- [ ] Security hardening
- [ ] Replay viewer
- [ ] Polish, sounds and mobile support

## License

MIT
