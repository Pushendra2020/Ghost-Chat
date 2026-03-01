"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type ChatContextType = {
    myId: string | null;
    setMyId: (id: string | null) => void;
    peerId: string | null;
    setPeerId: (id: string | null) => void;
    status: 'lobby' | 'requesting' | 'incoming' | 'connected' | 'error';
    setStatus: (status: 'lobby' | 'requesting' | 'incoming' | 'connected' | 'error') => void;
    currentRequestId: string | null;
    setCurrentRequestId: (id: string | null) => void;
};

const ChatContext = createContext<ChatContextType>({
    myId: null,
    setMyId: () => { },
    peerId: null,
    setPeerId: () => { },
    status: 'lobby',
    setStatus: () => { },
    currentRequestId: null,
    setCurrentRequestId: () => { },
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
    const [myId, setMyId] = useState<string | null>(null);
    const [peerId, setPeerId] = useState<string | null>(null);
    const [status, setStatus] = useState<'lobby' | 'requesting' | 'incoming' | 'connected' | 'error'>('lobby');
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

    return (
        <ChatContext.Provider value={{
            myId, setMyId,
            peerId, setPeerId,
            status, setStatus,
            currentRequestId, setCurrentRequestId
        }}>
            {children}
        </ChatContext.Provider>
    );
};
