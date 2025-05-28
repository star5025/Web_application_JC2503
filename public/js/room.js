const socket = io();

// 监听点击就绪按钮
document.getElementById('ready').addEventListener('click', function(e) {
    socket.emit(playerReady, {roomName});
    
})
  