const express = require("express");
const app = express();

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
    console.log(`Chat Server running on port ${PORT}`);
});

const io = require("socket.io")(server);

let socketsConneted = new Set();

io.on("connection", onConnection);

function onConnection(socket) {
    console.log(`User connected: ${socket.id}`);
    socketsConneted.add(socket);

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        socketsConneted.delete(socket);
        io.emit('clients_total', socketsConneted.size);
    });

    socket.on("message", (data) => {
        socket.broadcast.emit("chat-message", data);
    });

    socket.on("feedback", (data) => {
        socket.broadcast.emit("feedback", data);
    });

    io.emit('clients_total', socketsConneted.size);
}
