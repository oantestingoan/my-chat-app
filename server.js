const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let waitingUser = null; 
let onlineCount = 0;
const BANNED_WORDS = ['slur1', 'badword']; // Add words here

function filterText(text) {
    let filtered = text;
    BANNED_WORDS.forEach(word => {
        const reg = new RegExp(word, 'gi');
        filtered = filtered.replace(reg, '***');
    });
    return filtered;
}

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('user-count', onlineCount);

    socket.on('set-profile', (data) => {
        const cleanName = filterText(data.username).substring(0, 15);
        socket.userData = { username: cleanName, avatar: data.avatar, color: data.color };
    });

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
            socket.emit('chat-message', { user: 'System', text: 'Searching for a partner...' });
        }
    });

    socket.on('skip', (roomName) => {
        if(roomName) {
            io.to(roomName).emit('partner-skipped');
            io.in(roomName).socketsLeave(roomName);
        }
    });

    socket.on('send-private-msg', (data) => {
        const cleanMsg = filterText(data.msg);
        socket.to(data.room).emit('chat-message', { 
            user: socket.userData.username, 
            avatar: socket.userData.avatar,
            color: socket.userData.color,
            text: cleanMsg 
        });
        socket.emit('chat-message', { user: 'You', text: cleanMsg });
    });

    socket.on('disconnect', () => {
        onlineCount--;
        io.emit('user-count', onlineCount);
        if (waitingUser === socket.id) waitingUser = null;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live`));
