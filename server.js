const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Since your files are all in one folder now:
app.use(express.static(__dirname));

let waitingUser = null; 
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
    // --- CUSTOM PUBLIC ROOMS ---
    socket.on('join-room', (roomName) => {
        socket.leaveAll(); // Leave previous rooms
        socket.join(roomName);
        socket.emit('chat-message', { user: 'System', text: `Joined room: ${roomName}` });
    });

    socket.on('send-public-msg', (data) => {
        const cleanMsg = filterMessage(data.msg);
        io.to(data.room).emit('chat-message', { user: 'Anon', text: cleanMsg });
    });

    // --- 1-ON-1 WITH AUTO-SKIP ---
    socket.on('find-pair', () => {
        if (waitingUser && waitingUser !== socket.id) {
            const partnerId = waitingUser;
            waitingUser = null;
            const roomName = `pair-${socket.id}-${partnerId}`;
            
            socket.join(roomName);
            const partnerSocket = io.sockets.sockets.get(partnerId);
            if(partnerSocket) {
                partnerSocket.join(roomName);
                io.to(roomName).emit('pair-found', { room: roomName });
            }
        } else {
            waitingUser = socket.id;
            socket.emit('chat-message', { user: 'System', text: 'Searching...' });
        }
    });

    socket.on('skip', (roomName) => {
        io.to(roomName).emit('partner-skipped'); // Tell both users someone skipped
        // Force them to leave the room
        io.in(roomName).socketsLeave(roomName);
    });

    socket.on('send-private-msg', (data) => {
        const cleanMsg = filterMessage(data.msg);
        socket.to(data.room).emit('chat-message', { user: 'Partner', text: cleanMsg });
        socket.emit('chat-message', { user: 'You', text: cleanMsg });
    });

    socket.on('disconnect', () => {
        if (waitingUser === socket.id) waitingUser = null;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running` bits));
