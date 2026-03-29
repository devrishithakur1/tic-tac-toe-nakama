# Tic-Tac-Toe Multiplayer

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game using **Nakama (Go)** for the backend and **React (Vite + Tailwind CSS)** for the frontend.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) and Docker Compose
- [Node.js](https://nodejs.org/) (v18+)
- [Go](https://golang.org/dl/) (v1.22+) - _Optional, for local development outside Docker_

## Getting Started

### 1. Run the Backend (Nakama)

The backend uses Docker Compose to spin up the Nakama server and its PostgreSQL database.

```bash
cd backend
docker-compose up --build
```

- **Nakama API**: `http://localhost:7350`
- **Nakama Console**: `http://localhost:7351` (Default: `admin` / `password`)

### 2. Run the Frontend

The frontend is a Vite-powered React application.

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

## Project Structure

- `backend/`: Go modules for Nakama match logic, RPCs, and leaderboards.
- `frontend/`: React components, hooks, and context for Nakama interaction.

## Key Features

- **Multiplayer Matchmaking**: Real-time matchmaking with 2 players.
- **Server-Authoritative**: Game logic and state are managed on the server.
- **Timed Mode**: Turn-based timer logic (30s per turn).
- **Leaderboards**: Persistence of wins and streaks.
- **Authentication**: Secure login/sign-up via Nakama's email auth with username deduplication.
- **Match IDs**: Shareable private match IDs with "Copy" functionality.

### Environment Variables (Frontend)

Copy `frontend/.env.example` to `frontend/.env` and update with your server details:

- `VITE_NAKAMA_HOST`: Server address
- `VITE_NAKAMA_PORT`: Server port
- `VITE_NAKAMA_USE_SSL`: `true` for HTTPS
- `VITE_NAKAMA_SERVER_KEY`: Server secret key
