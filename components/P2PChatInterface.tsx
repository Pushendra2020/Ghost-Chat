"use client";

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, PhoneOff, Lock, User, Info, ArrowLeft, Paperclip, FileIcon, Download, Loader2, X } from 'lucide-react';

const MAX_TEXT_LENGTH = 1000;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export default function P2PChatInterface({ isInitiator }: { isInitiator: boolean }) {
    const { peerId, setStatus, setPeerId } = useChat();
    const { messages, sendMessage, sendFile, sendingProgress, receivingProgress, rtcConnected } = useWebRTC(isInitiator);
    const [inputText, setInputText] = useState('');
    const [fileError, setFileError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sendingProgress, receivingProgress]);

    // Clear file error after 5s
    useEffect(() => {
        if (fileError) {
            const t = setTimeout(() => setFileError(''), 5000);
            return () => clearTimeout(t);
        }
    }, [fileError]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !rtcConnected) return;
        if (inputText.length > MAX_TEXT_LENGTH) return;
        sendMessage(inputText.trim());
        setInputText('');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileError('');

        if (file.type.startsWith('image/')) {
            if (file.size > MAX_IMAGE_SIZE) {
                setFileError('Images must be smaller than 10MB.');
                return;
            }
        } else {
            if (file.size > MAX_FILE_SIZE) {
                setFileError('Files must be smaller than 200MB.');
                return;
            }
        }

        sendFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDisconnect = () => {
        if (confirm("Are you sure you want to end this chat?")) {
            window.location.reload();
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans">

            {/* Header */}
            <header className="flex-none flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDisconnect}
                        className="p-2 -ml-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors hidden sm:block"
                        title="End Chat"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 relative shrink-0">
                        <User size={20} />
                        <span className={twMerge(clsx(
                            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
                            rtcConnected ? "bg-green-500" : "bg-amber-400"
                        ))}></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 text-sm md:text-base leading-tight">
                            User {peerId?.substring(0, 6)}
                        </span>
                        <span className={clsx("text-xs transition-colors", rtcConnected ? "text-slate-500" : "text-amber-600 font-medium")}>
                            {rtcConnected ? "Online" : "Connecting..."}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors hidden sm:block">
                        <Info size={24} />
                    </button>
                    <button
                        onClick={handleDisconnect}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="End Chat"
                    >
                        <PhoneOff size={22} className="sm:hidden" />
                        <span className="hidden sm:inline-block px-2 font-medium text-sm">End Chat</span>
                    </button>
                </div>
            </header>

            {/* Main Chat Area */}
            <main className="flex-1 overflow-y-auto bg-[#e5ddd5] dark:bg-slate-100 relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>

                <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4 pb-32">

                    {/* Status Message */}
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-center my-4"
                        >
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fefce8] border border-amber-200 shadow-sm text-[11px] sm:text-xs font-medium text-amber-800 text-center max-w-[90%]">
                                <Lock size={12} className="shrink-0" />
                                <span>Messages are securely end-to-end encrypted. No one outside of this chat can read them.</span>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Chat Bubbles */}
                    {messages.map((msg, index) => {
                        const isMe = msg.sender === 'me';
                        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const showTail = index === messages.length - 1 || messages[index + 1].sender !== msg.sender;

                        return (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                key={msg.id}
                                className={twMerge(clsx("flex flex-col w-full", isMe ? "items-end" : "items-start"))}
                            >
                                <div className={twMerge(clsx(
                                    "relative px-3 sm:px-4 py-2 text-[15px] leading-relaxed max-w-[85%] sm:max-w-[75%] shadow-sm",
                                    isMe
                                        ? "bg-blue-500 text-white rounded-2xl"
                                        : "bg-white text-slate-800 rounded-2xl border border-slate-100",
                                    isMe && showTail ? "rounded-br-sm" : "",
                                    !isMe && showTail ? "rounded-bl-sm" : "",
                                ))}>

                                    {/* Media/File Rendering */}
                                    {msg.file ? (
                                        <div className="flex flex-col gap-2 mt-1 mb-1">
                                            {msg.file.type.startsWith('image/') ? (
                                                <div className="relative group rounded-xl overflow-hidden">
                                                    <img src={msg.file.url} alt={msg.file.name} className="max-w-full max-h-60 object-contain bg-black/5" />
                                                    <a href={msg.file.url} download={msg.file.name} className="absolute bottom-2 right-2 p-1.5 sm:p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-sm">
                                                        <Download size={16} />
                                                    </a>
                                                </div>
                                            ) : msg.file.type.startsWith('video/') ? (
                                                <video src={msg.file.url} controls className="max-w-full rounded-xl max-h-60 bg-black/5" />
                                            ) : msg.file.type.startsWith('audio/') ? (
                                                <audio src={msg.file.url} controls className="max-w-full min-w-[200px]" />
                                            ) : (
                                                <div className={twMerge(clsx(
                                                    "flex items-center gap-3 p-3 rounded-xl min-w-[200px]",
                                                    isMe ? "bg-black/10" : "bg-slate-100"
                                                ))}>
                                                    <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
                                                        <FileIcon size={20} />
                                                    </div>
                                                    <div className="flex flex-col flex-1 overflow-hidden">
                                                        <span className="font-semibold text-sm truncate">{msg.file.name}</span>
                                                        <span className="text-xs opacity-70">{(msg.file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                    </div>
                                                    <a href={msg.file.url} download={msg.file.name} className={twMerge(clsx(
                                                        "p-2 rounded-full transition-colors shrink-0",
                                                        isMe ? "hover:bg-black/20 text-white" : "hover:bg-slate-200 text-slate-600"
                                                    ))}>
                                                        <Download size={20} />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                                    )}

                                    <div className={twMerge(clsx(
                                        "flex justify-end items-center gap-1 mt-1 -mb-1",
                                        isMe ? "text-blue-100" : "text-slate-400"
                                    ))}>
                                        <span className="text-[10px] select-none">{time}</span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* Progress Trackers for current transfers */}
                    {Object.entries(receivingProgress).map(([id, prog]) => (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={`recv-${id}`} className="flex flex-col items-start w-full">
                            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm w-full max-w-[250px] space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <Loader2 className="animate-spin text-blue-500 shrink-0" size={16} />
                                    <span className="truncate">Receiving file...</span>
                                    <span className="ml-auto text-xs text-slate-400">{Math.round(prog * 100)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${prog * 100}%` }}></div>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {Object.entries(sendingProgress).map(([id, prog]) => (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={`send-${id}`} className="flex flex-col items-end w-full">
                            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 shadow-sm w-full max-w-[250px] space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                                    <Loader2 className="animate-spin text-blue-500 shrink-0" size={16} />
                                    <span className="truncate">Sending file...</span>
                                    <span className="ml-auto text-xs opacity-70">{Math.round(prog * 100)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-blue-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 transition-all duration-300 ease-out" style={{ width: `${prog * 100}%` }}></div>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </main>

            {/* Input Area */}
            <div className="flex-none bg-[#f0f2f5] px-4 py-3 sm:py-4 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] border-t border-slate-200 z-20">

                {/* File Error Alert */}
                <AnimatePresence>
                    {fileError && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="max-w-4xl mx-auto mb-2"
                        >
                            <div className="bg-red-100 text-red-700 text-xs px-3 py-2 rounded-lg flex items-center justify-between">
                                <span>{fileError}</span>
                                <button onClick={() => setFileError('')}><X size={14} /></button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto items-end relative">

                    {/* Attachment Button */}
                    <div className="relative shrink-0 flex items-center justify-center p-2 mb-0.5">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={!rtcConnected || Object.keys(sendingProgress).length > 0}
                        />
                        <motion.button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            disabled={!rtcConnected || Object.keys(sendingProgress).length > 0}
                            className="text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                        >
                            <Paperclip size={24} />
                        </motion.button>
                    </div>

                    <div className="flex-1 bg-white rounded-2xl sm:rounded-3xl border border-slate-300 focus-within:border-blue-500 shadow-sm transition-colors flex flex-col justify-center overflow-hidden min-h-[44px] relative">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value.substring(0, MAX_TEXT_LENGTH))}
                            disabled={!rtcConnected}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            className="w-full bg-transparent border-none text-slate-900 placeholder-slate-400 focus:ring-0 py-3 px-4 max-h-[120px] resize-none focus:outline-none disabled:opacity-50 disabled:bg-slate-50 text-[15px] leading-tight"
                            placeholder={rtcConnected ? "Type a message..." : "Waiting for connection..."}
                            rows={1}
                        ></textarea>

                        {/* Word count limit indicator */}
                        {inputText.length > MAX_TEXT_LENGTH * 0.8 && (
                            <div className="absolute bottom-1 right-3 text-[10px] text-slate-400 select-none bg-white px-1">
                                {inputText.length}/{MAX_TEXT_LENGTH}
                            </div>
                        )}
                    </div>

                    <motion.button
                        whileHover={{ scale: !rtcConnected || (!inputText.trim() && Object.keys(sendingProgress).length === 0) ? 1 : 1.05 }}
                        whileTap={{ scale: !rtcConnected || (!inputText.trim() && Object.keys(sendingProgress).length === 0) ? 1 : 0.95 }}
                        disabled={!rtcConnected || (!inputText.trim() && Object.keys(sendingProgress).length === 0)}
                        type="submit"
                        className="h-11 w-11 mb-0.5 shrink-0 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <Send size={18} className="translate-x-[1px]" />
                    </motion.button>
                </form>
            </div>
        </div>
    );
}
