"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useChat } from '@/context/ChatContext';

export type Message = {
    id: string;
    sender: 'me' | 'peer';
    text: string;
    timestamp: Date;
    file?: {
        name: string;
        type: string;
        size: number;
        url: string;
    };
};

export type FileMetadata = {
    id: string;
    filename: string;
    filetype: string;
    filesize: number;
    totalChunks: number;
};

type IncomingFile = {
    metadata: FileMetadata;
    chunks: Uint8Array[];
    receivedChunks: number;
};

export const useWebRTC = (isInitiator: boolean) => {
    const { socket } = useSocket();
    const { myId, peerId } = useChat();

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const incomingFilesRef = useRef<Record<string, IncomingFile>>({});

    const [messages, setMessages] = useState<Message[]>([]);
    const [rtcConnected, setRtcConnected] = useState(false);

    // Track file upload/download progress (0 to 1) keyed by msgId
    const [sendingProgress, setSendingProgress] = useState<Record<string, number>>({});
    const [receivingProgress, setReceivingProgress] = useState<Record<string, number>>({});

    const addMessage = useCallback((msg: Message) => {
        setMessages((prev) => [...prev, msg]);
    }, []);

    const sendMessage = useCallback((text: string) => {
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            const msgId = Math.random().toString(36).substring(7);
            const payload = { type: 'text', id: msgId, text, timestamp: new Date().toISOString() };
            dataChannelRef.current.send(JSON.stringify(payload));
            addMessage({ id: msgId, sender: 'me', text, timestamp: new Date() });
        } else {
            console.warn('Data channel is not open');
        }
    }, [addMessage]);

    const sendFile = useCallback((file: File) => {
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

        const chunkSize = 16384; // 16KB per chunk to be safe over WebRTC
        const msgId = Math.random().toString(36).substring(7);
        const totalChunks = Math.ceil(file.size / chunkSize);

        // 1. Send metadata wrapper
        const metadata: FileMetadata = {
            id: msgId,
            filename: file.name,
            filetype: file.type,
            filesize: file.size,
            totalChunks
        };
        const startPayload = { type: 'file-start', metadata, timestamp: new Date().toISOString() };
        dataChannelRef.current.send(JSON.stringify(startPayload));

        // 2. Read and send chunks using ArrayBuffer
        const reader = new FileReader();
        let offset = 0;
        let currentChunk = 0;

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            if (e.target?.result && dataChannelRef.current?.readyState === 'open') {
                const buffer = e.target.result as ArrayBuffer;

                // Pack chunk logic: [msgId (8 chars/bytes)] + [chunkIndex (UInt32 4 bytes)] + [raw chunk data]
                const paddedId = String(msgId).padEnd(8, ' ').substring(0, 8);
                const idBytes = new TextEncoder().encode(paddedId);
                const header = new Uint8Array(12);
                header.set(idBytes, 0);
                const view = new DataView(header.buffer);
                view.setUint32(8, currentChunk, true); // Little endian

                const chunkData = new Uint8Array(buffer);
                const combined = new Uint8Array(12 + chunkData.length);
                combined.set(header, 0);
                combined.set(chunkData, 12);

                try {
                    dataChannelRef.current.send(combined.buffer);
                    offset += buffer.byteLength;
                    currentChunk++;

                    setSendingProgress(prev => ({ ...prev, [msgId]: currentChunk / totalChunks }));

                    if (offset < file.size) {
                        // Prevent overflowing the browser's buffer
                        if (dataChannelRef.current.bufferedAmount > 1024 * 1024) { // 1MB buffer backpressure
                            const checkBuffer = setInterval(() => {
                                if (dataChannelRef.current && dataChannelRef.current.bufferedAmount < 1024 * 1024 * 0.5) {
                                    clearInterval(checkBuffer);
                                    readNextChunk();
                                }
                            }, 50);
                        } else {
                            readNextChunk();
                        }
                    } else {
                        // Send completion, display file for sender
                        addMessage({
                            id: msgId,
                            sender: 'me',
                            text: `[File attached: ${file.name}]`,
                            timestamp: new Date(),
                            file: { name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file) }
                        });
                        setTimeout(() => {
                            setSendingProgress(prev => { const n = { ...prev }; delete n[msgId]; return n; });
                        }, 1000);
                    }
                } catch (err) {
                    console.error("Error sending chunk", err);
                }
            }
        };

        // Start processing the file
        readNextChunk();
    }, [addMessage]);

    const setupDataChannel = useCallback((channel: RTCDataChannel) => {
        channel.binaryType = 'arraybuffer'; // Necessary for handling chunk byte arrays
        channel.bufferedAmountLowThreshold = 1024 * 1024 * 0.5; // 500KB

        channel.onopen = () => console.log('Data channel opened');
        channel.onclose = () => console.log('Data channel closed');
        channel.onmessage = (event) => {
            if (typeof event.data === 'string') {
                // Must be JSON metadata
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'file-start') {
                        incomingFilesRef.current[data.metadata.id] = {
                            metadata: data.metadata,
                            chunks: new Array(data.metadata.totalChunks), // preallocate array
                            receivedChunks: 0
                        };
                        setReceivingProgress(prev => ({ ...prev, [data.metadata.id]: 0 }));
                    } else if (data.type === 'text') {
                        addMessage({
                            id: data.id,
                            sender: 'peer',
                            text: data.text,
                            timestamp: new Date(data.timestamp),
                        });
                    } else {
                        // For backwards compatibility before we added message types
                        addMessage({
                            id: data.id,
                            sender: 'peer',
                            text: data.text,
                            timestamp: new Date(data.timestamp),
                        });
                    }
                } catch (e) {
                    console.warn("Could not parse string message:", event.data);
                }
            } else if (event.data instanceof ArrayBuffer) {
                // Must be a raw chunk
                const buffer = event.data;
                const headerText = new TextDecoder().decode(buffer.slice(0, 8));
                const msgId = headerText.trim();
                const view = new DataView(buffer);
                const chunkIndex = view.getUint32(8, true); // Little endian unpack

                const chunkData = new Uint8Array(buffer, 12); // The rest is the file data

                const incomingFile = incomingFilesRef.current[msgId];
                if (incomingFile) {
                    incomingFile.chunks[chunkIndex] = chunkData;
                    incomingFile.receivedChunks++;

                    setReceivingProgress(prev => ({
                        ...prev,
                        [msgId]: incomingFile.receivedChunks / incomingFile.metadata.totalChunks
                    }));

                    if (incomingFile.receivedChunks === incomingFile.metadata.totalChunks) {
                        try {
                            const blob = new Blob(incomingFile.chunks as BlobPart[], { type: incomingFile.metadata.filetype });
                            const url = URL.createObjectURL(blob);

                            addMessage({
                                id: msgId,
                                sender: 'peer',
                                text: `[File received: ${incomingFile.metadata.filename}]`,
                                timestamp: new Date(),
                                file: {
                                    name: incomingFile.metadata.filename,
                                    type: incomingFile.metadata.filetype,
                                    size: incomingFile.metadata.filesize,
                                    url
                                }
                            });
                        } catch (e) {
                            console.error("Error creating blob", e);
                        }

                        delete incomingFilesRef.current[msgId];
                        setTimeout(() => {
                            setReceivingProgress(prev => { const n = { ...prev }; delete n[msgId]; return n; });
                        }, 1000);
                    }
                }
            }
        };
    }, [addMessage]);

    const initPeerConnection = useCallback((startAsInitiator: boolean) => {
        if (!socket || !peerId || !myId) return;

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }

        const peerConnection = new RTCPeerConnection({
            iceServers: [
                // --- STUN Server Configuration (Commented out for now) ---
                { urls: 'stun:stun.l.google.com:19302' },
            ],
        });
        peerConnectionRef.current = peerConnection;

        // Handle ICE Candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    senderId: myId,
                    receiverId: peerId,
                    candidate: event.candidate,
                });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('WebRTC State:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                setRtcConnected(true);
            } else if (peerConnection.connectionState === 'disconnected') {
                // Mobile file pickers might background the browser, causing temporary disconnects.
                // We disable the input but don't print the terminal error message so it can freely reconnect.
                setRtcConnected(false);
            } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
                setRtcConnected((prev) => {
                    if (prev) {
                        addMessage({
                            id: Math.random().toString(36).substring(7),
                            sender: 'peer',
                            text: '⚠ Peer has disconnected or left the chat.',
                            timestamp: new Date()
                        });
                    }
                    return false;
                });
            }
        };

        // Data Channel Logic
        if (startAsInitiator) {
            const dataChannel = peerConnection.createDataChannel('chat');
            dataChannelRef.current = dataChannel;
            setupDataChannel(dataChannel);

            // Create Offer
            peerConnection.createOffer().then((offer) => {
                return peerConnection.setLocalDescription(offer);
            }).then(() => {
                socket.emit('webrtc-offer', {
                    senderId: myId,
                    receiverId: peerId,
                    offer: peerConnection.localDescription,
                });
            }).catch(err => console.error('Error creating offer:', err));
        } else {
            peerConnection.ondatachannel = (event) => {
                dataChannelRef.current = event.channel;
                setupDataChannel(event.channel);
            };
        }
    }, [socket, peerId, myId, setupDataChannel]);

    useEffect(() => {
        if (!socket || !peerId) return;

        const handleOffer = async (data: any) => {
            if (data.senderId !== peerId) return;

            initPeerConnection(false); // We are answering
            const pc = peerConnectionRef.current;
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit('webrtc-answer', {
                senderId: myId,
                receiverId: peerId,
                answer: pc.localDescription,
            });
        };

        const handleAnswer = async (data: any) => {
            if (data.senderId !== peerId) return;
            const pc = peerConnectionRef.current;
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        };

        const handleIceCandidate = async (data: any) => {
            if (data.senderId !== peerId) return;
            const pc = peerConnectionRef.current;
            if (pc && data.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        };

        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);

        // If we are the initiator, start the connection immediately upon mount
        if (isInitiator) {
            initPeerConnection(true);
        }

        return () => {
            socket.off('webrtc-offer', handleOffer);
            socket.off('webrtc-answer', handleAnswer);
            socket.off('webrtc-ice-candidate', handleIceCandidate);
        };
    }, [socket, peerId, myId, initPeerConnection, isInitiator]);

    return {
        messages,
        sendMessage,
        sendFile,
        sendingProgress,
        receivingProgress,
        rtcConnected,
        peerConnectionRef
    };
};
