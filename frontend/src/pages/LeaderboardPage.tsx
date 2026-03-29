import React, { useEffect, useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import type { LeaderboardRecordList } from '@heroiclabs/nakama-js';
import { Trophy, ArrowLeft, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LeaderboardPage: React.FC = () => {
    const { client, session } = useNakama();
    const [leaderboard, setLeaderboard] = useState<LeaderboardRecordList | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!session) return;
        const fetchLeaderboard = async () => {
            try {
                const result = await client.listLeaderboardRecords(session, "tic_tac_toe_wins", [], 100);
                setLeaderboard(result);
            } catch (err) {
                console.error("Failed to load leaderboard", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [client, session]);

    if (!session) {
        return <div className="text-center p-8 text-white">Please login first.</div>;
    }

    return (
        <div className="flex flex-col items-center min-h-screen p-4 py-12 max-w-2xl mx-auto w-full space-y-8">

            <div className="w-full flex items-center justify-between">
                <button onClick={() => navigate('/lobby')} className="bg-white/5 border border-white/10 p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                    Global Rankings

                </h1>
                <div className="w-10"></div> {/* Spacer for centering */}
            </div>

            <div className="glass-panel w-full overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="w-full">
                        <div className="grid grid-cols-12 gap-4 bg-white/5 p-4 border-b border-white/10 text-gray-400 text-sm font-semibold uppercase tracking-wider">
                            <div className="col-span-2 text-center">Rank</div>
                            <div className="col-span-6">Player</div>
                            <div className="col-span-4 text-right pr-4">Wins</div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {leaderboard?.records?.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No ranked players yet.</div>
                            ) : (
                                leaderboard?.records?.map((record, idx) => {
                                    const ownerId = record.owner_id || 'unknown';
                                    const displayName = record.username || ownerId.split('-')[0] + '...';
                                    return (
                                        <div key={ownerId} className={`grid grid-cols-12 gap-4 p-4 border-b border-white/5 hover:bg-white/5 transition-colors items-center ${ownerId === session.user_id ? 'bg-blue-500/10' : ''}`}>
                                            <div className="col-span-2 flex justify-center">
                                                {idx === 0 ? <Medal className="w-6 h-6 text-yellow-400" /> :
                                                    idx === 1 ? <Medal className="w-6 h-6 text-gray-300" /> :
                                                        idx === 2 ? <Medal className="w-6 h-6 text-amber-600" /> :
                                                            <span className="font-bold text-gray-400">#{idx + 1}</span>}
                                            </div>
                                            <div className="col-span-6 font-medium text-sm truncate flex items-center gap-2">
                                                {ownerId === session.user_id && <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30">YOU</span>}
                                                {displayName}
                                            </div>
                                            <div className="col-span-4 text-right pr-4 font-black text-xl text-blue-400">
                                                {record.score}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};
