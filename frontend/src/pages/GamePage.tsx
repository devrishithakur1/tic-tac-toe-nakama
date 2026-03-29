import React, { useEffect, useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import { useNavigate, useParams } from 'react-router-dom';
import type { Match, MatchData } from '@heroiclabs/nakama-js';
import { Copy, LogOut, RefreshCcw, Timer, Trophy } from 'lucide-react';

const OpCodeGameStart = 1;
const OpCodeBoardUpdate = 2;
const OpCodeMakeMove = 3;
const OpCodeGameOver = 4;
const OpCodeTimerUpdate = 5;

interface GameState {
    board: string[];
    players: Record<string, string>; // userId -> "X" or "O"
    playerNames: Record<string, string>; // userId -> username
    currentTurn: string;
    winner: string;
    gameOver: boolean;
    mode: string;
    elapsedTurnTicks: number;
    timerDuration: number;
}

export const GamePage: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const { session, socket, joinMatch } = useNakama();
    const navigate = useNavigate();

    const [match, setMatch] = useState<Match | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!session || !socket || !matchId) {
            navigate('/lobby');
            return;
        }

        let currentMatch: Match | null = null;

        const setupMatch = async () => {
            try {
                currentMatch = await joinMatch(matchId);
                setMatch(currentMatch);
            } catch (err: any) {
                setError(err.message || "Failed to join match");
            }
        };

        setupMatch();

        socket.onmatchdata = (matchData: MatchData) => {
            try {
                const state: GameState = JSON.parse(new TextDecoder().decode(matchData.data));
                setGameState(state);
            } catch (e) {
                console.error("Failed to parse match data", e);
            }
        };

        return () => {
            socket.onmatchdata = () => { };
            // Optionally leave match when unmounting
            if (currentMatch) {
                socket.leaveMatch(currentMatch.match_id).catch(() => { });
            }
        };
    }, [session, socket, matchId, joinMatch, navigate]);

    const handleCellClick = async (index: number) => {
        if (!gameState || gameState.gameOver || gameState.board[index] !== "" || gameState.currentTurn !== session?.user_id) {
            return;
        }

        if (socket && match) {
            const payload = JSON.stringify({ cellIndex: index });
            try {
                await socket.sendMatchState(match.match_id, OpCodeMakeMove, new TextEncoder().encode(payload));
            } catch (err) {
                console.error("Failed to send move", err);
            }
        }
    };

    const copyMatchId = () => {
        if (matchId) {
            navigator.clipboard.writeText(matchId);
        }
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <h2 className="text-2xl font-bold text-rose-400 mb-4">Error</h2>
                <p className="text-gray-300 mb-6">{error}</p>
                <button onClick={() => navigate('/lobby')} className="bg-white/10 px-6 py-2 rounded-lg hover:bg-white/20 transition-colors">Return to Lobby</button>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-xl font-medium animate-pulse">Waiting for opponent...</p>
                <div className="mt-8 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg text-sm border border-white/10">
                    <span className="text-gray-400">Match ID:</span>
                    <code className="font-mono text-blue-300">{matchId}</code>
                    <button onClick={copyMatchId} className="hover:text-white transition-colors p-1" title="Copy to clipboard">
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    const userId = session?.user_id || "";
    const mySymbol = gameState.players[userId];
    const isMyTurn = gameState.currentTurn === userId;
    const myName = gameState.playerNames?.[userId] || 'You';
    const opponentId = Object.keys(gameState.players).find(id => id !== userId) || '';
    const opponentName = gameState.playerNames?.[opponentId] || 'Opponent';

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 max-w-lg mx-auto w-full space-y-8">

            {/* Header Info */}
            <div className="w-full flex justify-between items-center bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 shadow-lg">
                <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">{myName}</span>
                    <span className={`text-2xl font-black ${mySymbol === 'X' ? 'text-blue-400' : 'text-rose-400'}`}>
                        {mySymbol}
                    </span>
                </div>

                {gameState.mode === 'timed' && !gameState.gameOver && (
                    <div className="flex flex-col items-center bg-black/20 px-4 py-2 rounded-xl">
                        <div className="flex items-center gap-1 text-yellow-400 text-sm font-semibold mb-1">
                            <Timer className="w-4 h-4" /> Timer
                        </div>
                        <div className="text-xl font-mono tabular-nums font-bold">
                            {Math.max(0, gameState.timerDuration - gameState.elapsedTurnTicks)}s
                        </div>
                    </div>
                )}

                <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">{opponentName}</span>
                    <span className={`text-2xl font-black ${mySymbol === 'X' ? 'text-rose-400' : 'text-blue-400'}`}>
                        {mySymbol === 'X' ? 'O' : 'X'}
                    </span>
                </div>
            </div>

            {/* Turn Indicator */}
            {!gameState.gameOver && (
                <div className="text-center w-full">
                    <div className={`text-xl font-bold p-3 rounded-xl border transition-all ${isMyTurn ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                        {isMyTurn ? "Your Turn!" :`${opponentName}'s Turn...`} 
                    </div>
                </div>
            )}

            {/* Game Board */}
            <div className="glass-panel p-6 w-full max-w-[400px] aspect-square relative z-10 grid grid-cols-3 gap-3 bg-white/10">
                {gameState.board.map((cell, index) => (
                    <button
                        key={index}
                        onClick={() => handleCellClick(index)}
                        disabled={gameState.gameOver || cell !== "" || !isMyTurn}
                        className={`
              w-full h-full rounded-xl flex items-center justify-center text-6xl font-black
              bg-black/20 hover:bg-black/40 transition-all border border-white/5
              shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]
              ${cell === "" && isMyTurn ? 'cursor-pointer hover:border-white/20 active:scale-95' : 'cursor-default'}
            `}
                    >
                        {cell === "X" && <span className="cell-x">X</span>}
                        {cell === "O" && <span className="cell-o">O</span>}
                    </button>
                ))}

                {/* Game Over Overlay */}
                {gameState.gameOver && (
                    <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 space-y-6 text-center animate-in fade-in zoom-in duration-300">
                        <div className="space-y-2">
                            {gameState.winner === session?.user_id && <h2 className="text-5xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]">VICTORY</h2>}
                            {gameState.winner === "draw" && <h2 className="text-5xl font-black text-gray-300 drop-shadow-[0_0_15px_rgba(209,213,219,0.8)]">DRAW</h2>}
                            {gameState.winner !== session?.user_id && gameState.winner !== "draw" && gameState.winner !== "opponent_left" && gameState.winner !== "timeout" && <h2 className="text-5xl font-black text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">DEFEAT</h2>}
                            {gameState.winner === "opponent_left" && <h2 className="text-4xl font-black text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]">YOU WIN</h2>}
                            {gameState.winner === "timeout" && <h2 className="text-4xl font-black text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">TIMEOUT</h2>}
                        </div>

                        <p className="text-gray-300 text-lg">
                            {gameState.winner === session?.user_id && "You demolished your opponent!"}
                            {gameState.winner === "draw" && "A battle of equals."}
                            {gameState.winner !== session?.user_id && gameState.winner !== "draw" && gameState.winner !== "opponent_left" && gameState.winner !== "timeout" && "Better luck next time."}
                            {gameState.winner === "opponent_left" && "Your opponent cowardly fled the battle."}
                            {gameState.winner === "timeout" && "Someone was too slow."}
                        </p>

                        <button
                            onClick={() => navigate('/lobby')}
                            className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            <LogOut className="w-5 h-5" /> Return to Lobby
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
};
