const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const messages = []; // 保存所有留言，实际项目可用数据库

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

// 启动服务器
const PORT = 5500;
app.listen(PORT, () => {
  console.log(`server is running at：http://localhost:${PORT}`);
});
