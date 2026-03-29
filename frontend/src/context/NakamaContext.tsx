import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket, Match } from '@heroiclabs/nakama-js';

// Nakama Server details from environment variables
const NAKAMA_SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey';
const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || '127.0.0.1';
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350';
const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true';

const client = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);

interface NakamaContextType {
    client: Client;
    session: Session | null;
    socket: Socket | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    signup: (username: string, password: string) => Promise<void>;
    logout: () => void;
    createPrivateMatch: (mode: string) => Promise<string>;
    joinMatch: (matchId: string) => Promise<Match>;
    findMatch: (mode: string) => Promise<void>;
}

const NakamaContext = createContext<NakamaContextType | undefined>(undefined);

export const useNakama = () => {
    const context = useContext(NakamaContext);
    if (!context) {
        throw new Error('useNakama must be used within a NakamaProvider');
    }
    return context;
};

export const NakamaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedSession = localStorage.getItem('nakama-session');
        if (storedSession) {
            try {
                const s = Session.restore(storedSession, "");
                if (s.isexpired(Math.floor(Date.now() / 1000)) || !s.username) {
                    // Clear expired or old device-auth sessions
                    localStorage.removeItem('nakama-session');
                    setLoading(false);
                } else {
                    setSession(s);
                    initSocket(s).then(() => setLoading(false));
                }
            } catch (e) {
                localStorage.removeItem('nakama-session');
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }, []);

    const initSocket = async (s: Session) => {
        const sock = client.createSocket(false, false);
        await sock.connect(s, true);
        setSocket(sock);
        return sock;
    };

    // Build a synthetic email from the username for Nakama's email auth
    const toEmail = (username: string) => `${username.toLowerCase()}@tictactoe.local`;

    // Login with existing username + password
    const login = async (username: string, password: string) => {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        setLoading(true);
        try {
            const s = await client.authenticateEmail(toEmail(username), password, false, username);
            localStorage.setItem('nakama-session', s.token);
            setSession(s);
            await initSocket(s);
        } catch (e: any) {
            console.error("Login failed", e);
            if (e?.status === 404 || e?.statusCode === 404) {
                throw new Error("Account not found. Please sign up first.");
            }
            throw new Error("Invalid username or password");
        } finally {
            setLoading(false);
        }
    };

    // Signup with new username + password
    const signup = async (username: string, password: string) => {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        setLoading(true);
        try {
            const s = await client.authenticateEmail(toEmail(username), password, true, username);
            // Set the display name to the username
            await client.updateAccount(s, { display_name: username });
            localStorage.setItem('nakama-session', s.token);
            setSession(s);
            await initSocket(s);
        } catch (e: any) {
            console.error("Signup failed", e);
            if (e?.status === 409 || e?.statusCode === 409) {
                throw new Error("Username already taken. Please choose another.");
            }
            throw new Error(e?.message || "Signup failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        if (socket) socket.disconnect(false);
        localStorage.removeItem('nakama-session');
        setSession(null);
        setSocket(null);
    };

    const createPrivateMatch = async (mode: string): Promise<string> => {
        if (!session) throw new Error("No session");
        const payload = { mode };
        const response = await client.rpc(session, "create_match", payload);
        const responsePayload = response.payload as any;
        const result = typeof responsePayload === 'string' ? JSON.parse(responsePayload) : (responsePayload || {});
        return result.matchId;
    };

    const joinMatch = async (matchIdOrToken: string): Promise<Match> => {
        if (!socket) throw new Error("No socket");
        const isToken = matchIdOrToken.length > 80;
        if (isToken) {
            return await socket.joinMatch("", matchIdOrToken);
        } else {
            return await socket.joinMatch(matchIdOrToken);
        }
    };

    const findMatch = async (mode: string) => {
        if (!socket) throw new Error("No socket");
        await socket.addMatchmaker("*", 2, 2, { mode });
    };

    return (
        <NakamaContext.Provider value={{ client, session, socket, loading, login, signup, logout, createPrivateMatch, joinMatch, findMatch }}>
            {children}
        </NakamaContext.Provider>
    );
};

