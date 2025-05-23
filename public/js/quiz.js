const socket = io();

let currentName;

// 玩家输入名字，前端将名字发给后端
document.getElementById('playerName').addEventListener('submit', function(e) {
  e.preventDefault();
  const input = document.getElementById('player').value;
  if (input) {
    // 将玩家名字发送给后端
    socket.emit('playerName', input);
    currentName = input;
    input = '';
  }
});

// 玩家接收来自后端提供的其他玩家的名字
socket.on('playerList', function(list){
  const display = document.getElementById('displayList');
  display.innerHTML = '';
  for (let id in list) {
    if (list.hasOwnProperty(id)) {
      const nameBlock = document.createElement('div');
      nameBlock.classList.add('nameBlock');
      // 点击玩家，向该玩家发出挑战邀请
      nameBlock.addEventListener('click', function(e) {
        const targetName = e.currentTarget.textContent.trim();
        if (targetName === currentName) {
            alert('This is you.');
        } else {
            socket.emit('challenge', {targetName, fromName: currentName});
        }
    });
      nameBlock.textContent = list[id];
      display.appendChild(nameBlock);
    }
  }
});

// 收到挑战已发送
socket.on('challengeSent', function(targetName) {
  alert('Challenge sent to ' + targetName + ' ✅');
});

// 收到别人挑战
socket.on('challengeReceived', function(fromName) {
  if (confirm('You have received a challenge from ' + fromName + '!')) {
    // 加入游戏
    socket.emit('challengeAccepted', { fromName, targetName: currentName });
  };
});

// 监听进入对局
socket.on('startGame', function(data) {
  // data: { roomName, players }
  alert(
    'Game started! Room: ' + data.roomName + 
    '\nPlayers: ' + data.players.join(' vs ')
  );
  // 这里你可以跳转到对战页面或显示对局界面
  location.href = 'room.html';
  // 或者显示对战UI
});
