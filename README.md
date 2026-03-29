# Tic-Tac-Toe Multiplayer

A real-time multiplayer Tic-Tac-Toe game built with [Nakama](https://heroiclabs.com/nakama/) (Go) on the backend and React + Vite on the frontend.

**Source code:** https://github.com/devrishithakur1/tic-tac-toe-nakama

**Live game:** `https://devrishi-tic-tac-toe.duckdns.org/`

---

## Table of Contents

1. [Architecture & Design Decisions](#architecture--design-decisions)
2. [Game Logic](#game-logic)
3. [Setup & Installation](#setup--installation)
4. [API & Server Configuration](#api--server-configuration)
5. [Deployment](#deployment)
6. [Testing Multiplayer](#testing-multiplayer)
7. [Troubleshooting](#troubleshooting)

---

## Architecture & Design Decisions

```
┌────────────────────┐        WebSocket         ┌─────────────────────┐
│  React + Vite      │ ◄───────────────────────► │  Nakama Game Server │
│  (frontend)        │     real-time messages    │  (Go plugin)        │
└────────────────────┘                           └──────────┬──────────┘
                                                            │
                                                 ┌──────────▼──────────┐
                                                 │     PostgreSQL       │
                                                 │  auth, leaderboards  │
                                                 └─────────────────────┘
```

**Nakama** provides matchmaking, real-time WebSocket match state, email authentication, and leaderboards out of the box — without needing to build any of that infrastructure from scratch.

**Server-authoritative design:** All game logic lives in `gameLoop.go` on the server. The client only sends a move (board index); the server validates it, updates the board, checks for a win/draw, manages the turn timer, and broadcasts the new state to both players. Neither client can cheat or get out of sync.

**Frontend structure:** A single `NakamaContext` holds the client session and is shared across pages via React Context. Each page (`AuthPage`, `LobbyPage`, `GamePage`, `LeaderboardPage`) handles one concern. There are no custom hooks layered on top — the context is consumed directly, keeping things simple.

---

## Game Logic

All match logic runs server-side in `gameLoop.go` at a tick rate of 1 tick/second.

### Match lifecycle

- **MatchInit** — initializes `GameState` with an empty board, empty player maps, a `TimerDuration` of 30 seconds, and a mode (`classic` or `timed`). The match is labeled `tic_tac_toe` for matchmaking.
- **MatchJoinAttempt** — rejects a join if the match already has 2 players.
- **MatchJoin** — assigns the first player to join as `X` and the second as `O`. Once both are present, `X` is set as the first to move and a `GameStart` broadcast is sent to both players, followed immediately by a `BoardUpdate` with the initial state.
- **MatchLeave** — if a player disconnects mid-game, the match ends immediately. The remaining player is awarded a win on the leaderboard and a `GameOver` message is broadcast with `winner: "opponent_left"`.
- **MatchLoop** — runs every tick and handles timer countdown and incoming move messages.

### Move validation

When a `MakeMove` message arrives, the server checks:
1. The sender is the player whose turn it currently is.
2. The cell index is between 0–8 and the cell is not already occupied.

Invalid moves are silently dropped — the client receives no response and the board does not change.

### Win detection

After every valid move, the server checks all 8 win patterns (3 rows, 3 columns, 2 diagonals) against the board. If a pattern matches, the matching symbol's owner is declared the winner. If no pattern matches and all 9 cells are filled, the result is a draw. On any terminal result, a `GameOver` message is broadcast and the winner's score is written to the leaderboard (draws do not update the leaderboard).

### Game modes

| Mode | Behaviour |
|---|---|
| `classic` | No turn timer — players can take as long as they want |
| `timed` | Each player has 30 seconds per turn. The timer resets on every valid move. If it expires, the opponent wins |

In `timed` mode the server broadcasts a `TimerUpdate` every tick so the frontend can display a live countdown.

### Leaderboard writes

Wins are recorded to `tic_tac_toe_wins` via `LeaderboardRecordWrite` in three cases: normal win, timeout, and opponent disconnect. Draws and losses do not write a record.

---

## Setup & Installation

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Node.js](https://nodejs.org/) v18+

### 1. Clone the repo

```bash
git clone https://github.com/devrishithakur1/tic-tac-toe-nakama.git
cd tic-tac-toe-nakama
```

### 2. Start the backend

```bash
cd backend
docker-compose up --build
```

This starts Nakama at `http://localhost:7350` and PostgreSQL at `localhost:5432`. First startup takes about a minute while the database initializes — wait for `"Startup done"` in the logs before opening the frontend.

```bash
# Run in background
docker-compose up --build -d

# View logs
docker-compose logs -f nakama

# Stop
docker-compose down
```

### 3. Configure the frontend

```bash
cd ../frontend
cp .env.example .env
```

The defaults work for local development:

```env
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_SERVER_KEY=server-secret
```

> `VITE_NAKAMA_SERVER_KEY` must match the `--socket.server_key` value passed in the Docker entrypoint. If you change one, update the other — they need to be identical or the frontend won't connect.

### 4. Start the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Project Structure

```
├── go.work                         # Go workspace
├── backend/
│   ├── docker-compose.yml          # Nakama + PostgreSQL
│   ├── Dockerfile                  # Nakama plugin build
│   ├── local.yml                   # Nakama server config
│   ├── main.go                     # Plugin entry point, registers match handler
│   ├── gameLoop.go                 # Match loop, move validation, win detection, timer
│   └── types.go                    # Shared types (GameState, OpCodes, etc.)
│
└── frontend/
    ├── .env.example
    ├── vite.config.ts
    └── src/
        ├── context/
        │   └── NakamaContext.tsx   # Nakama client, session, socket
        └── pages/
            ├── AuthPage.tsx        # Login / register
            ├── LobbyPage.tsx       # Matchmaking + private match by ID
            ├── GamePage.tsx        # Board, timer, match state
            └── LeaderboardPage.tsx # All-time and weekly rankings
```

---

## API & Server Configuration

### Nakama server config (`backend/local.yml`)

Key values:

```yaml
name: nakama-node

logger:
  level: INFO

runtime:
  path: "/nakama/data/modules"

console:
  username: admin
  password: password123
```

> The server key is passed directly via the Docker entrypoint (`--socket.server_key "server-secret"`) rather than in `local.yml`.

### Endpoints used by the frontend

| Endpoint | Description |
|---|---|
| `POST /v2/account/authenticate/email` | Register or log in |
| WebSocket `/ws` | Real-time match communication |
| `POST /v2/rpc/create_private_match` | Create a private match, returns a Match ID |
| `POST /v2/rpc/join_private_match` | Join a match by ID |
| `GET /v2/leaderboard/{id}` | Fetch leaderboard scores |

### WebSocket message protocol

The client sends moves and the server broadcasts state updates using numeric OpCodes:

**Client → Server**

| OpCode | Payload | Description |
|---|---|---|
| `1` | `{ "position": 0–8 }` | Place a mark at a board index |

**Server → Client**

| OpCode | Payload | Description |
|---|---|---|
| `100` | Full `GameState` object | Board updated |
| `101` | `{ "winner": "X" \| "O" \| "draw" }` | Match over |
| `102` | `{ "remaining_seconds": N }` | Timer tick |
| `103` | `{ "player": "X" \| "O" }` | Turn timed out |

**GameState shape:**

```json
{
  "board": ["X", "", "O", "", "X", "", "", "", ""],
  "turn": "O",
  "players": { "X": "user-id-1", "O": "user-id-2" },
  "status": "playing",
  "winner": null
}
```

### Leaderboards

Scores are submitted by the server automatically when a match ends.

---

## Deployment

Both the backend and frontend are hosted on a DigitalOcean VM, with Nginx as the reverse proxy routing traffic to Nakama and serving the frontend build.

The frontend is built with `npm run build` and the `dist/` output is served as static files. The backend runs via `docker-compose up -d` on the same VM.

Production frontend environment variables:

```env
VITE_NAKAMA_HOST=your-domain.com
VITE_NAKAMA_PORT=443
VITE_NAKAMA_USE_SSL=true
VITE_NAKAMA_SERVER_KEY=your-production-server-key
```

---

## Testing Multiplayer

### Two-tab test (quickest)

1. Open `http://localhost:5173` in a normal tab — register as `player1@test.com`
2. Open `http://localhost:5173` in an incognito window — register as `player2@test.com`
3. Both click **"Find Match"** — Nakama pairs them automatically
4. Play a full game and verify win detection, turn switching, and leaderboard update

### Private match

1. Player 1 clicks **"Create Private Match"** — a Match ID appears
2. Player 2 enters that ID and clicks **"Join"**
3. Both land in the same match

### Turn timer

Start a **timed** match and let a player's turn expire without moving. After 30 seconds the server ends the match, awards the win to the opponent, and broadcasts a `GameOver` message to both clients.

### Nakama console

Visit `http://localhost:7351` (login: `admin` / `password123`) to inspect active matches, user accounts, and leaderboard entries during or after a game.

---

## Troubleshooting

**Nakama won't start** — PostgreSQL takes a moment on first run. Check `docker-compose logs postgres` and wait for it to be ready before retrying.

**Frontend can't connect** — Confirm the backend is running and `VITE_NAKAMA_HOST` / `VITE_NAKAMA_PORT` in `.env` are correct.

**Server key mismatch** — `VITE_NAKAMA_SERVER_KEY` in `.env` must exactly match the `--socket.server_key` value in the Docker entrypoint (`server-secret` by default).

**Matchmaking doesn't pair players** — Both users must be authenticated and on the same server. Check the console under **Matches** to see if a match was created.
