const socket = io();

const msgForm = document.getElementById('msgForm');
const nicknameInput = document.getElementById('nickname');
const messageInput = document.getElementById('message');
const messagesDiv = document.getElementById('messages');

msgForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  const message = messageInput.value.trim();
  if (!nickname) {
    alert('Please enter name!');
    return;
  }
  if (!message) {
    alert('Please enter message!');
    return;
  }
  // 发送消息给服务器
  socket.emit('message', { nickname, message });
  // 清空输入框
  messageInput.value = '';
});
// 接收服务器广播的留言数据，渲染留言
// Listening for events of content of message board from back-end server
socket.on('messageBoard', (messages) => {
  messagesDiv.innerHTML = '';
  messages.forEach(({nickname, message}) => {
    const msgElem = document.createElement('p');
    msgElem.textContent = `${nickname}: ${message}`;
    messagesDiv.appendChild(msgElem);
  });
});


// 根据当前时间选择问候语
// Greeting according to current time
function greeting() {
    let element = document.getElementById("greet");
    let date = new Date();
    let hour = date.getHours();
    let message = "";

    if (hour >= 6 && hour < 11) {
        message = "Good morning! 👋";
    } else if (hour >= 11 && hour < 13) {
        message = "Good day! 👨‍💻";
    } else if (hour >= 13 && hour < 18) {
        message = "Good afternoon! 🍵";
    } else {
        message = "Good evening! 🌃";
    }

    element.textContent = message;
}

greeting();