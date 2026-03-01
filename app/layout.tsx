import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '@/context/SocketContext';
import { ChatProvider } from '@/context/ChatContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ghost Chat',
  description: 'Privacy-focused peer-to-peer chat running on Next.js and WebRTC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SocketProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
