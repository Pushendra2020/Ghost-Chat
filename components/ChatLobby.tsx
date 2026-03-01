"use client";

import { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useChat } from '@/context/ChatContext';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Copy, CheckCircle2, UserPlus, Loader2, X, Check } from 'lucide-react';

type ChatLobbyProps = {
    onConnectionStart: (isInitiator: boolean) => void;
};

export default function ChatLobby({ onConnectionStart }: ChatLobbyProps) {
    const { myId, peerId, setPeerId, status, setStatus } = useChat();
    const { socket } = useSocket();
    const [inputId, setInputId] = useState('');
    const [error, setError] = useState('');
    const [incomingRequest, setIncomingRequest] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!socket) return;

        const handleIncoming = (data: any) => setIncomingRequest(data);
        const handleAccepted = (data: any) => {
            if (status !== 'requesting') return; // Ignore if we timed out
            setPeerId(data.receiverId);
            setStatus('connected');
            onConnectionStart(true);
        };
        const handleRejected = () => {
            setStatus('lobby');
            setError('Connection request was declined.');
        };

        socket.on('incoming-request', handleIncoming);
        socket.on('request-accepted', handleAccepted);
        socket.on('request-rejected', handleRejected);

        return () => {
            socket.off('incoming-request', handleIncoming);
            socket.off('request-accepted', handleAccepted);
            socket.off('request-rejected', handleRejected);
        };
    }, [socket, setPeerId, setStatus, onConnectionStart, status]);

    // Handle 30-second timeout for connection requests
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (status === 'requesting') {
            timeout = setTimeout(() => {
                setStatus('lobby');
                setError('Connection request timed out (30s). Peer may be offline or ignoring.');
            }, 30000);
        }
        return () => clearTimeout(timeout);
    }, [status, setStatus]);

    const copyId = () => {
        if (myId) {
            navigator.clipboard.writeText(myId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleConnect = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputId.trim() || inputId === myId) return;
        setError('');
        setStatus('requesting');

        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: myId, receiverId: inputId })
            });
            const data = await res.json();

            if (data.success || data.error === 'Request already pending') {
                socket?.emit('connection-request', {
                    requestId: data.request?._id, // Pass DB tracking ID
                    senderId: myId,
                    receiverId: inputId,
                });
            } else {
                setError(data.error);
                setStatus('lobby');
            }
        } catch (e) {
            setError('Network connection failed. Please check your internet.');
            setStatus('lobby');
        }
    };

    const acceptRequest = async () => {
        if (!incomingRequest) return;
        try {
            if (incomingRequest.requestId) {
                await fetch('/api/requests', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId: incomingRequest.requestId, status: 'accepted' })
                });
            }
            socket?.emit('request-accepted', {
                senderId: incomingRequest.senderId,
                receiverId: myId
            });
            setPeerId(incomingRequest.senderId);
            setStatus('connected');
            onConnectionStart(false);
            setIncomingRequest(null);
        } catch (e) {
            console.error(e);
        }
    };

    const rejectRequest = async () => {
        if (!incomingRequest) return;
        try {
            if (incomingRequest.requestId) {
                await fetch('/api/requests', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId: incomingRequest.requestId, status: 'rejected' })
                });
            }
            socket?.emit('request-rejected', {
                senderId: incomingRequest.senderId,
                receiverId: myId
            });
            setIncomingRequest(null);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col font-sans bg-slate-50 text-slate-800 selection:bg-blue-100">

            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex-none flex items-center justify-between px-6 py-4 md:px-10 z-10 bg-white border-b border-slate-200 shadow-sm"
            >
                <div className="flex items-center gap-2">
                    <div className="bg-blue-500 p-2 rounded-xl text-white shadow-sm">
                        <MessageCircle size={24} />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">Ghost Chat</h1>
                </div>
            </motion.header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden"
                >
                    <div className="p-8 flex flex-col gap-8">

                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-semibold text-slate-900">Connect to Chat</h2>
                            <p className="text-sm text-slate-500">Share your ID to receive messages, or connect to a friend's ID.</p>
                        </div>

                        {/* User ID Section */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Your ID</label>
                            <motion.div
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={copyId}
                                className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
                            >
                                <span className="text-lg font-mono font-medium text-slate-700 select-all">{myId || "Connecting..."}</span>
                                <div className={twMerge(clsx(
                                    "p-2 rounded-lg transition-colors",
                                    copied ? "text-green-600 bg-green-100" : "text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-100"
                                ))}>
                                    {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                                </div>
                            </motion.div>
                        </div>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400 uppercase">Or connect to</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        {/* Connect Form */}
                        <form onSubmit={handleConnect} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Friend's ID</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <UserPlus size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={inputId}
                                        onChange={(e) => setInputId(e.target.value)}
                                        disabled={status !== 'lobby'}
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                                        placeholder="Enter ID here..."
                                    />
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: status !== 'lobby' || !inputId.trim() ? 1 : 1.02 }}
                                whileTap={{ scale: status !== 'lobby' || !inputId.trim() ? 1 : 0.98 }}
                                type="submit"
                                disabled={status !== 'lobby' || !inputId.trim()}
                                className={twMerge(
                                    clsx(
                                        "w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white transition-all",
                                        status === 'requesting'
                                            ? "bg-blue-400 cursor-wait"
                                            : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 shadow-blue-600/20 hover:shadow-blue-600/30"
                                    )
                                )}
                            >
                                {status === 'requesting' ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                        Connecting...
                                    </>
                                ) : (
                                    'Start Chat'
                                )}
                            </motion.button>
                        </form>

                        {/* Error Handling */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-sm text-red-600 text-center">{error}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </div>
                </motion.div>
            </main>

            {/* Incoming Request Dialog */}
            <AnimatePresence>
                {incomingRequest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 text-center space-y-4">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                                    <MessageCircle className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-slate-900">Incoming Chat</h3>
                                    <p className="mt-2 text-sm text-slate-500">
                                        <span className="font-semibold text-slate-800">{incomingRequest.senderId}</span> wants to connect with you.
                                    </p>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-4 py-3 flex gap-3 sm:px-6">
                                <button
                                    type="button"
                                    onClick={rejectRequest}
                                    className="flex-1 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2.5 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm transition-colors"
                                >
                                    Decline
                                </button>
                                <button
                                    type="button"
                                    onClick={acceptRequest}
                                    className="flex-1 w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2.5 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm transition-colors"
                                >
                                    Accept
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
