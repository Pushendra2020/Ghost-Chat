import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(handler);
    const io = new Server(httpServer, {
        path: '/api/socket',
        addTrailingSlash: false,
    });

    io.on('connection', (socket) => {
        socket.on('join', (userId) => {
            socket.join(userId);
            console.log(`User ${userId} joined room`);
        });

        socket.on('connection-request', (data) => {
            io.to(data.receiverId).emit('incoming-request', data);
        });

        socket.on('request-accepted', (data) => {
            io.to(data.senderId).emit('request-accepted', data);
        });

        socket.on('request-rejected', (data) => {
            io.to(data.senderId).emit('request-rejected', data);
        });

        socket.on('webrtc-offer', (data) => {
            io.to(data.receiverId).emit('webrtc-offer', data);
        });

        socket.on('webrtc-answer', (data) => {
            io.to(data.receiverId).emit('webrtc-answer', data);
        });

        socket.on('webrtc-ice-candidate', (data) => {
            io.to(data.receiverId).emit('webrtc-ice-candidate', data);
        });
    });

    httpServer
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
