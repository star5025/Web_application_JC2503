const API_BASE = 'http://localhost:5500';

const socket = io();

// 玩家输入名字，前端将名字发给后端
document.getElementById('playerName').addEventListener('submit', function(e) {
  e.preventDefault();
  const input = document.getElementById('player');
  if (input.value) {
    // 将玩家名字发送给后端
    socket.emit('player name', input.value);
    input.value = '';
  }
});

// 玩家接收来自后端提供的其他玩家的名字
socket.on('player list', function(msg){
  const item = document.createElement('li');
  item.textContent = msg;
  document.getElementById('messages').appendChild(item);
});