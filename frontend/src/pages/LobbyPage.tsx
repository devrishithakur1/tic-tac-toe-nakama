import React, { useEffect, useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, LogOut, Users, Trophy, Copy, Check, X } from 'lucide-react';

export const LobbyPage: React.FC = () => {
    const { session, logout, socket, createPrivateMatch } = useNakama();
    const navigate = useNavigate();
    const [matchmaking, setMatchmaking] = useState(false);
    const [matchIdInput, setMatchIdInput] = useState('');
    const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!session) {
            navigate('/');
            return;
        }

        if (socket) {
            socket.onmatchmakermatched = (matched) => {
                setMatchmaking(false);
                const targetId = matched.token || matched.match_id;
                navigate(`/game/${targetId}`);
            };
        }

        return () => {
            if (socket) socket.onmatchmakermatched = () => { };
        };
    }, [session, socket, navigate]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleFindMatch = async (mode: string) => {
        if (!socket) return;
        try {
            setMatchmaking(true);
            await socket.addMatchmaker("*", 2, 2, { mode });
        } catch (e) {
            console.error(e);
            setMatchmaking(false);
        }
    };

    const handleCreatePrivate = async (mode: string) => {
        try {
            const matchId = await createPrivateMatch(mode);
            setCreatedMatchId(matchId);
        } catch (e) {
            console.error(e);
        }
    };

    const handleJoinPrivate = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const idToJoin = createdMatchId || matchIdInput;
        if (idToJoin.trim()) {
            navigate(`/game/${idToJoin.trim()}`);
            setCreatedMatchId(null);
        }
    };

    const copyToClipboard = () => {
        if (createdMatchId) {
            navigator.clipboard.writeText(createdMatchId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="absolute top-4 right-4 flex gap-4">
                <button onClick={() => navigate('/leaderboard')} className="glass-panel px-4 py-2 flex items-center gap-2 hover:bg-white/10 transition-colors">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="font-semibold">{session?.username}</span>
                </button>
                <button onClick={handleLogout} className="glass-panel px-4 py-2 flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 transition-colors">
                    <LogOut className="w-4 h-4" />
                    <span>Exit</span>
                </button>
            </div>

            <div className="glass-panel w-full max-w-2xl p-8 space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Game Lobby</h1>
                    <p className="text-gray-400">Choose a game mode to start playing</p>
                </div>

                {matchmaking ? (
                    <div className="flex flex-col items-center justify-center p-12 space-y-4">
                        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="text-lg font-medium text-blue-400 animate-pulse">Searching for opponent...</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">

                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold border-b border-white/10 pb-2 flex items-center gap-2">
                                <Users className="w-5 h-5 text-gray-400" />
                                Public Match
                            </h2>
                            <button
                                onClick={() => handleFindMatch("classic")}
                                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 p-4 rounded-xl text-left transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <div className="font-bold text-lg text-blue-400">Classic Mode</div>
                                    <div className="text-sm text-gray-400">No time limits</div>
                                </div>
                                <Play className="w-6 h-6 text-gray-500 group-hover:text-blue-400 transition-colors" />
                            </button>

                            <button
                                onClick={() => handleFindMatch("timed")}
                                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 p-4 rounded-xl text-left transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <div className="font-bold text-lg text-rose-400">Timed Mode</div>
                                    <div className="text-sm text-gray-400">30 seconds per turn</div>
                                </div>
                                <Clock className="w-6 h-6 text-gray-500 group-hover:text-rose-400 transition-colors" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold border-b border-white/10 pb-2 flex items-center gap-2">
                                <Lock className="w-5 h-5 text-gray-400" />
                                Private Match
                            </h2>

                            <div className="flex gap-2">
                                <button onClick={() => handleCreatePrivate("classic")} className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 p-3 rounded-lg text-sm text-center transition-colors">Create Classic</button>
                                <button onClick={() => handleCreatePrivate("timed")} className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 p-3 rounded-lg text-sm text-center transition-colors">Create Timed</button>
                            </div>

                            <form onSubmit={handleJoinPrivate} className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Match ID..."
                                    value={matchIdInput}
                                    onChange={(e) => setMatchIdInput(e.target.value)}
                                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                />
                                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">Join</button>
                            </form>
                        </div>

                    </div>
                )}
            </div>

            {/* Match Created Modal */}
            {createdMatchId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-panel w-full max-w-md p-8 relative animate-in zoom-in duration-300">
                        <button onClick={() => setCreatedMatchId(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="text-center space-y-6">
                            <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-blue-500/30">
                                <Lock className="w-8 h-8 text-blue-400" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold">Match Created!</h2>
                                <p className="text-gray-400 text-sm">Share this ID with your friend so they can join the game.</p>
                            </div>

                            <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                                <code className="font-mono text-blue-300 text-sm truncate">{createdMatchId}</code>
                                <button
                                    onClick={copyToClipboard}
                                    className={`p-2 rounded-lg transition-all ${copied ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                >
                                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>

                            <button
                                onClick={() => handleJoinPrivate()}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 group transition-all"
                            >
                                <Play className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                Start Match
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Lock = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

