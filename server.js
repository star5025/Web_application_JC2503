const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // 创建Socket.IO服务器
const messages = []; // 保存所有留言，实际项目可用数据库
const players = {}; //保存在线玩家的信息，(每个玩家的socket id: 玩家名)

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // 提供静态文件服务，访问 http://localhost:5500/index.html

// 因为express和socket冲突，暂时无法使用留言墙
// // 获取所有留言
// app.get('/messages', (req, res) => {
//   res.json(messages);
// });

// // 新增留言
// app.post('/messages', (req, res) => {
//   const { user, text } = req.body;
//   if (user && text) {
//     messages.push({ user, text });
//     res.json({ success: true });
//   } else {
//     res.status(400).json({ success: false, msg: 'user and text required' });
//   }
// });

// 监听客户端连接
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 监听客户端发来的消息
  socket.on('playerName', (name) => {
    console.log('Received name: ', name);
    players[socket.id] = name;
    // 将在线玩家列表广播给所有连接的客户端
    io.emit('playerList', players);
  });

    // 监听挑战事件
  socket.on('challenge', ({ targetName, fromName }) => {
    // 找到目标玩家的 socket.id      
    const targetSocketId = Object.keys(players).find(
        id => players[id] === targetName
    );
    if (targetSocketId) {
      // 只给被挑战者发消息
      io.to(targetSocketId).emit('challengeReceived', fromName);
      }
      // 给发起者自己一个反馈
      socket.emit('challengeSent', targetName);
  });

    // 监听被挑战者同意
  socket.on('challengeAccepted', ({ fromName, targetName }) => {
    // 找到双方的socket id
    const fromSocketId = Object.keys(players).find(
    id => players[id] === fromName
    );
    const targetSocketId = Object.keys(players).find(
    id => players[id] === targetName
     );
    if (fromSocketId && targetSocketId) {
    // 分配唯一房间名
    const roomName = `game_${fromSocketId}_${targetSocketId}`;
    // 让双方都加入房间
    io.sockets.sockets.get(fromSocketId)?.join(roomName);
    io.sockets.sockets.get(targetSocketId)?.join(roomName);
    // 通知双方可以开始游戏
    io.to(roomName).emit('startGame', { roomName, players: [fromName, targetName] });
    }
});

  // 监听断开
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerList', players);
  });
});

// 启动服务器
const PORT = 5500;
server.listen(PORT, () => {
  console.log(`server is running at：http://localhost:${PORT}`);
});
