'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
const port = process.env.PORT || 3030;

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(port);

var io = socketIO(app, {
  pingInterval: 30000,
  pingTimeout: 400000000
});

io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message, room) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    // socket.broadcast.emit('message', message);
    socket.broadcast.to(room).emit('message', message);
  });

  // room에 roomId를 넣어서 1:1의 공간을 만들 수 있다.
  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      socket.roomName = room
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room); // room에 속한 모두에게 join 전송
      socket.join(room);
      socket.roomName = room
      socket.emit('joined', room, socket.id); // 본인에게 joined 전송
      io.sockets.in(room).emit('ready'); // room에 속한 모두에게 ready 전송
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1' && details.address !== '118.67.128.225') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('standby', function(room) {
    log("Standby " + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;

    if (numClients == 1) {
      log('standby and join room');
      socket.join(room)
    }
  });

  socket.on('bye', function(room) {
    io.sockets.in(room).emit('bye');
  });

  socket.on('disconnect', function() {
    io.sockets.in(socket.roomName).emit('termination')
  });

});
