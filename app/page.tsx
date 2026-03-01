"use client";

import { useEffect, useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useChat } from '@/context/ChatContext';
import ChatLobby from '@/components/ChatLobby';
import P2PChatInterface from '@/components/P2PChatInterface';

export default function Home() {
  const { isConnected, socket } = useSocket();
  const { myId, setMyId, status } = useChat();
  const [loading, setLoading] = useState(true);

  // Determine if the current user is the initiator (sent the request) or receiver
  const [isInitiator, setIsInitiator] = useState(false);

  useEffect(() => {
    async function initUser() {
      try {
        const res = await fetch('/api/users', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setMyId(data.userId);
        }
      } catch (e) {
        console.error('Failed to init user', e);
      } finally {
        setLoading(false);
      }
    }
    initUser();
  }, [setMyId]);

  useEffect(() => {
    if (isConnected && myId && socket) {
      socket.emit('join', myId);
    }
  }, [isConnected, myId, socket]);

  if (loading || !isConnected) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl font-semibold opacity-80">Connecting to secure relay...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      {status === 'connected' ? (
        <P2PChatInterface isInitiator={isInitiator} />
      ) : (
        <ChatLobby onConnectionStart={(initiator) => setIsInitiator(initiator)} />
      )}
    </main>
  );
}
