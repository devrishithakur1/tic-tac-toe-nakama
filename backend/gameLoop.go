package main

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

var winPatterns = [][3]int{
	{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // rows
	{0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // cols
	{0, 4, 8}, {2, 4, 6}, // diagonals
}

func checkWinner(board [9]string) string {
	for _, p := range winPatterns {
		a, b, c := p[0], p[1], p[2]
		if board[a] != "" && board[a] == board[b] && board[a] == board[c] {
			return board[a] // "X" or "O"
		}
	}
	// check draw
	for _, cell := range board {
		if cell == "" {
			return ""
		}
	}
	return "draw"
}

// --- Match handler ---

type TicTacToeMatch struct{}

func (m *TicTacToeMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	mode := "classic"
	if m, ok := params["mode"].(string); ok {
		mode = m
	}

	state := &GameState{
		Players:       make(map[string]string),
		PlayerNames:   make(map[string]string),
		Mode:          mode,
		TimerDuration: 30, // 30 seconds
	}
	tickRate := 1
	label := "tic_tac_toe"
	return state, tickRate, label
}

func (m *TicTacToeMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	gs := state.(*GameState)

	if len(gs.Players) >= 2 {
		return gs, false, "Match is full"
	}

	return gs, true, ""
}

func (m *TicTacToeMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	gs := state.(*GameState)

	for _, presence := range presences {
		symbol := "X"
		if len(gs.Players) == 1 {
			symbol = "O"
		}
		gs.Players[presence.GetUserId()] = symbol
		gs.PlayerNames[presence.GetUserId()] = presence.GetUsername()
		logger.Info("Player %s (%s) joined as %s", presence.GetUsername(), presence.GetUserId(), symbol)
	}

	if len(gs.Players) == 2 {
		// X goes first
		for userId, symbol := range gs.Players {
			if symbol == "X" {
				gs.CurrentTurn = userId
				break
			}
		}

		gs.ElapsedTurnTicks = 0

		data, _ := json.Marshal(gs)
		// Broadcast to all existing players already fully in the match
		dispatcher.BroadcastMessage(OpCodeGameStart, data, nil, nil, true)
		// ALSO broadcast specifically to the newly joining matching presences!
		dispatcher.BroadcastMessage(OpCodeGameStart, data, presences, nil, true)
		logger.Info("Game started in mode: %s!", gs.Mode)
	}

	// Always send the latest state to anyone joining (late joiners or reconnects)
	data, _ := json.Marshal(gs)
	dispatcher.BroadcastMessage(OpCodeBoardUpdate, data, presences, nil, true)

	return gs
}

func (m *TicTacToeMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	gs := state.(*GameState)

	for _, presence := range presences {
		delete(gs.Players, presence.GetUserId())
		logger.Info("Player %s left", presence.GetUserId())
	}

	if !gs.GameOver && len(gs.Players) < 2 {
		gs.GameOver = true
		gs.Winner = "opponent_left"

		// award win to remaining player
		for userId := range gs.Players {
			username := gs.PlayerNames[userId]
			if _, err := nk.LeaderboardRecordWrite(ctx, "tic_tac_toe_wins", userId, username, 1, 0, nil, nil); err != nil {
				logger.Error("Failed to write leaderboard: %v", err)
			}
			break
		}

		data, _ := json.Marshal(gs)
		dispatcher.BroadcastMessage(OpCodeGameOver, data, nil, nil, true)
	}

	return gs
}

func (m *TicTacToeMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	gs := state.(*GameState)

	if gs.GameOver {
		return gs
	}

	// Handle timers
	if gs.Mode == "timed" && len(gs.Players) == 2 {
		gs.ElapsedTurnTicks++

		if gs.ElapsedTurnTicks >= gs.TimerDuration {
			// Timeout! Current player loses.
			gs.GameOver = true
			gs.Winner = "timeout"

			// Find opponent to award win
			for userId := range gs.Players {
				if userId != gs.CurrentTurn {
					gs.Winner = userId
					username := gs.PlayerNames[userId]
					if _, err := nk.LeaderboardRecordWrite(ctx, "tic_tac_toe_wins", userId, username, 1, 0, nil, nil); err != nil {
						logger.Error("Failed to write leaderboard: %v", err)
					}
					break
				}
			}

			data, _ := json.Marshal(gs)
			dispatcher.BroadcastMessage(OpCodeGameOver, data, nil, nil, true)
			return gs
		}

		// Broadcast timer update every tick
		data, _ := json.Marshal(gs)
		dispatcher.BroadcastMessage(OpCodeTimerUpdate, data, nil, nil, true)
	}

	for _, msg := range messages {
		if msg.GetOpCode() != OpCodeMakeMove {
			continue
		}

		var move MovePayload
		if err := json.Unmarshal(msg.GetData(), &move); err != nil {
			logger.Error("Failed to parse move: %v", err)
			continue
		}

		cellIndex := move.CellIndex
		senderId := msg.GetUserId()

		// Validate turn
		if senderId != gs.CurrentTurn {
			logger.Warn("Player %s tried to move out of turn", senderId)
			continue
		}

		// Validate cell
		if cellIndex < 0 || cellIndex > 8 || gs.Board[cellIndex] != "" {
			logger.Warn("Invalid cell %d", cellIndex)
			continue
		}

		// Apply move
		gs.Board[cellIndex] = gs.Players[senderId]
		gs.ElapsedTurnTicks = 0 // Reset timer on successful move

		result := checkWinner(gs.Board)

		if result != "" {
			gs.GameOver = true

			if result == "draw" {
				gs.Winner = "draw"
			} else {
				// find winner userId by symbol
				for userId, symbol := range gs.Players {
					if symbol == result {
						gs.Winner = userId
						break
					}
				}

				// write to leaderboard
				if gs.Winner != "" {
					username := gs.PlayerNames[gs.Winner]
					if _, err := nk.LeaderboardRecordWrite(ctx, "tic_tac_toe_wins", gs.Winner, username, 1, 0, nil, nil); err != nil {
						logger.Error("Failed to write leaderboard: %v", err)
					}
				}
			}

			data, _ := json.Marshal(gs)
			dispatcher.BroadcastMessage(OpCodeGameOver, data, nil, nil, true)

		} else {
			// swap turn
			for userId := range gs.Players {
				if userId != senderId {
					gs.CurrentTurn = userId
					break
				}
			}

			data, _ := json.Marshal(gs)
			dispatcher.BroadcastMessage(OpCodeBoardUpdate, data, nil, nil, true)
		}
	}

	return gs
}

func (m *TicTacToeMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *TicTacToeMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}
