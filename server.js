const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { socket } = require('server/router');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // 创建Socket.IO服务器
const messages = []; // 保存所有留言，实际项目可用数据库
const players = {}; //保存在线玩家的信息，(每个玩家的socket id: 玩家名)

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // 提供静态文件服务，访问 http://localhost:5500/index.html

// 获取所有留言
app.get('/messages', (req, res) => {
  res.json(messages);
});

// 新增留言
app.post('/messages', (req, res) => {
  const { user, text } = req.body;
  if (user && text) {
    messages.push({ user, text });
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, msg: 'user and text required' });
  }
});

// 监听客户端连接
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 监听客户端发来的消息
  socket.on('player name', (msg) => {
    console.log('Received message:', msg);
    // 广播给所有连接的客户端
    io.emit('player name', msg);
  });

  // 监听断开
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 启动服务器
const PORT = 5500;
app.listen(PORT, () => {
  console.log(`server is running at：http://localhost:${PORT}`);
});
