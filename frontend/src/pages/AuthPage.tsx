import React, { useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, LogIn, UserPlus } from 'lucide-react';

export const AuthPage: React.FC = () => {
    const { login, signup } = useNakama();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) return;
        setError('');
        setLoading(true);
        try {
            if (isSignUp) {
                await signup(username.trim(), password);
            } else {
                await login(username.trim(), password);
            }
            navigate('/lobby');
        } catch (err: any) {
            setError(err.message || (isSignUp ? 'Signup failed' : 'Login failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="glass-panel w-full max-w-md p-8 text-center space-y-8">
                <div className="flex justify-center">
                    <div className="bg-blue-500/20 p-4 rounded-full border border-blue-500/30">
                        <Gamepad2 className="w-12 h-12 text-blue-400" />
                    </div>
                </div>

                <div>
                    <h1 className="text-3xl font-bold mb-2">Tic-Tac-Toe</h1>
                    <p className="text-gray-400">Multiplayer</p>
                </div>

                {/* Sign In / Sign Up Toggle */}
                <div className="flex bg-black/20 rounded-xl p-1 border border-white/10">
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(false); setError(''); }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isSignUp ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(true); setError(''); }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${isSignUp ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                            required
                            minLength={8}
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group"
                    >
                        {loading ? 'Connecting...' : (
                            <>
                                {isSignUp
                                    ? <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    : <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                }
                                {isSignUp ? 'Create Account' : 'Sign In'}
                            </>
                        )}
                    </button>
                </form>
                <span>
                    Made with ❤️ by Dev Rishi
                </span>

            </div>
        </div>
    );
};
