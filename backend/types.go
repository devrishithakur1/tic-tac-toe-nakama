package main

const (
	OpCodeGameStart   = 1
	OpCodeBoardUpdate = 2
	OpCodeMakeMove    = 3
	OpCodeGameOver    = 4
	OpCodeTimerUpdate = 5
)

type GameState struct {
	Board            [9]string         `json:"board"`
	Players          map[string]string `json:"players"`     // userId -> "X" or "O"
	PlayerNames      map[string]string `json:"playerNames"` // userId -> username
	CurrentTurn      string            `json:"currentTurn"`
	Winner           string            `json:"winner"` // userId, "draw", "opponent_left", "timeout", or ""
	GameOver         bool              `json:"gameOver"`
	Mode             string            `json:"mode"`             // "classic" or "timed"
	ElapsedTurnTicks int               `json:"elapsedTurnTicks"` // seconds elapsed since turn start
	TimerDuration    int               `json:"timerDuration"`    // max seconds per turn (e.g., 30)
}

type MovePayload struct {
	CellIndex int `json:"cellIndex"`
}
