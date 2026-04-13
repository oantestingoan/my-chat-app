const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null; // Stores the ID of someone looking for a 1-on-1 chat

// SIMPLE MODERATION: Add bad words to this list
const BANNED_WORDS = ['badword1', 'badword2']; 

function filterMessage(msg) {
    let filtered = msg;
    BANNED_WORDS.forEach(word => {
        const reg = new RegExp(word, 'gi');
        filtered = filtered.replace(reg, '***');
    });
    return filtered;
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- PUBLIC CHAT LOGIC ---
    socket.on('join-public', () => {
        socket.join('public-room');
        socket.emit('chat-message', { user: 'System', text: 'Joined Public Chat' });
    });

    socket.on('send-public-msg', (msg) => {
        const cleanMsg = filterMessage(msg);
        io.to('public-room').emit('chat-message', { user: 'Anon', text: cleanMsg });
    });

    // --- 1-ON-1 ANONYMOUS LOGIC ---
    socket.on('find-pair', () => {
        if (waitingUser && waitingUser !== socket.id) {
            // Match found!
            const partnerId = waitingUser;
            waitingUser = null;

            const roomName = `room-${socket.id}-${partnerId}`;
            socket.join(roomName);
            io.sockets.sockets.get(partnerId).join(roomName);

            io.to(roomName).emit('pair-found', { room: roomName });
        } else {
            waitingUser = socket.id;
            socket.emit('chat-message', { user: 'System', text: 'Searching for a partner...' });
        }
    });

    socket.on('send-private-msg', (data) => {
        const cleanMsg = filterMessage(data.msg);
        io.to(data.room).emit('chat-message', { user: 'Partner', text: cleanMsg });
    });

    socket.on('disconnect', () => {
        if (waitingUser === socket.id) waitingUser = null;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});