package main

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Tic-tac-toe Go module loaded 🚀")

	// Create leaderboards
	if err := nk.LeaderboardCreate(ctx, "tic_tac_toe_wins", false, "desc", "incr", "", nil); err != nil {
		logger.Info("Leaderboard tic_tac_toe_wins may already exist: %v", err)
	}
	if err := nk.LeaderboardCreate(ctx, "tic_tac_toe_streaks", false, "desc", "set", "", nil); err != nil {
		logger.Info("Leaderboard tic_tac_toe_streaks may already exist: %v", err)
	}

	// Register match handler
	if err := initializer.RegisterMatch("tic_tac_toe", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &TicTacToeMatch{}, nil
	}); err != nil {
		return err
	}

	// Register matchmaker — fires when 2 players are queued
	if err := initializer.RegisterMatchmakerMatched(func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {
		logger.Info("Matchmaker matched %d players", len(entries))

		mode := "classic"
		if len(entries) > 0 {
			if m, ok := entries[0].GetProperties()["mode"].(string); ok {
				mode = m
			}
		}

		matchId, err := nk.MatchCreate(ctx, "tic_tac_toe", map[string]interface{}{"mode": mode})
		if err != nil {
			return "", err
		}
		return matchId, nil
	}); err != nil {
		return err
	}

	// Register RPC to create a private match
	if err := initializer.RegisterRpc("create_match", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
		var payloadData map[string]interface{}
		mode := "classic"
		if err := json.Unmarshal([]byte(payload), &payloadData); err == nil {
			if m, ok := payloadData["mode"].(string); ok {
				mode = m
			}
		}

		matchId, err := nk.MatchCreate(ctx, "tic_tac_toe", map[string]interface{}{"mode": mode})
		if err != nil {
			return "", err
		}
		logger.Info("Created private match: %s with mode %s", matchId, mode)
		result, _ := json.Marshal(map[string]string{"matchId": matchId})
		return string(result), nil
	}); err != nil {
		return err
	}

	// Register RPC to check if a username is available
	if err := initializer.RegisterRpc("check_username", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(payload), &data); err != nil {
			return "", runtime.NewError("invalid payload", 3) // INVALID_ARGUMENT
		}

		username, ok := data["username"].(string)
		if !ok || username == "" {
			return "", runtime.NewError("username is required", 3)
		}

		// Check if any user already has this username
		users, err := nk.UsersGetUsername(ctx, []string{username})
		if err != nil {
			logger.Error("Error checking username: %v", err)
			return "", runtime.NewError("internal error", 13) // INTERNAL
		}

		available := len(users) == 0
		result, _ := json.Marshal(map[string]bool{"available": available})
		return string(result), nil
	}); err != nil {
		return err
	}

	return nil
}
