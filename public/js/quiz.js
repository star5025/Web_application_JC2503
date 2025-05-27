const socket = io();
    
// === 页面元素引用 ===
const contentDiv = document.querySelector('.container .content');

const playerNameForm = document.getElementById('playerName');     // 你的名字输入表单
const playerInput = document.getElementById('player');             // 你的名字输入框
const displayList = document.getElementById('displayList');        // 在线玩家列表容器
const inputBoxDiv = document.querySelector('.inputBox');           // 输入名字的整体区域
const TIMER_DURATION = 8; // 秒数，可自行修改
let timerInterval = null;

// 动态创建挑战提示区，放在 content 内，初始隐藏
const challengeSection = document.createElement('div');
challengeSection.id = 'challengeSection';
challengeSection.classList.add('hidden');
challengeSection.innerHTML = `
  <h2>Received a challenge!</h2>
  <p id="challengerName"></p>
  <button id="acceptChallengeBtn">Accept✅</button>
  <button id="rejectChallengeBtn">Reject❎</button>
`;
contentDiv.appendChild(challengeSection);

// 动态创建游戏进行区，初始隐藏
const gameSection = document.createElement('div');
gameSection.id = 'gameSection';
gameSection.classList.add('hidden');
gameSection.innerHTML = `
  <p id="scoreInfo"></p>
  <p id="questionText"></p>
  <div id="timerContainer"><div id="timerBar"></div></div>
  <div id="answerOptions"></div>
  <p id="roundResult"></p>
`;
contentDiv.appendChild(gameSection);

// 动态创建游戏结束区，初始隐藏
const gameOverSection = document.createElement('div');
gameOverSection.id = 'gameOverSection';
gameOverSection.classList.add('hidden');
gameOverSection.innerHTML = `
  <h2>Game Over🔚</h2>
  <p id="finalResult"></p>
  <button id="backToStartBtn">Back to start.</button>
`;
contentDiv.appendChild(gameOverSection);

// 获取动态区块中的元素
const challengerNameP = document.getElementById('challengerName');
const acceptBtn = document.getElementById('acceptChallengeBtn');
const rejectBtn = document.getElementById('rejectChallengeBtn');

const scoreInfo = document.getElementById('scoreInfo');
const questionText = document.getElementById('questionText');
const answerOptionsDiv = document.getElementById('answerOptions');
const roundResultP = document.getElementById('roundResult');

const finalResultText = document.getElementById('finalResult');
const backToStartBtn = document.getElementById('backToStartBtn');

let playerName = '';
let currentGameId = null;
let hasAnswered = false;

// 注册用户名
playerNameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = playerInput.value.trim();
  if (!name) {
    alert('Please enter your name.');
    return;
  }
  playerName = name;
  socket.emit('register', playerName);

  // 隐藏输入名字区域，显示玩家列表
  inputBoxDiv.style.display = 'none';
  displayList.innerHTML = '<p>Waiting for online player list to be updated...</p>';
});

// 更新在线玩家列表
socket.on('playerList', (list) => {
  // 过滤掉自己
  const otherPlayers = list.filter(name => name !== playerName);
  displayList.innerHTML = '';

  if (otherPlayers.length === 0) {
    displayList.innerHTML = '<p>No online player.</p>';
  } else {
    otherPlayers.forEach(name => {
      const playerItem = document.createElement('div');
      playerItem.textContent = name;
      playerItem.classList.add('playerItem');
      playerItem.addEventListener('click', () => {
        if (confirm(`Are you sure to challenge the player, ${name}?`)) {
          socket.emit('challenge', name);
          alert(`A challenge request has been sent to ${name}. Please wait for response.`);
        }
      });
      displayList.appendChild(playerItem);
    });
  }
});

// 收到挑战通知
socket.on('challenged', (challengerName) => {
  // 隐藏玩家列表和输入框区域
  displayList.style.display = 'none';
  inputBoxDiv.style.display = 'none';

  // 显示挑战提示区
  challengeSection.classList.remove('hidden');
  challengerNameP.textContent = `Player ${challengerName} challenge you！`;
  acceptBtn.dataset.challenger = challengerName;
  rejectBtn.dataset.challenger = challengerName;
});

// 拒绝挑战按钮
rejectBtn.addEventListener('click', () => {
  const challengerName = rejectBtn.dataset.challenger;
  socket.emit('challengeResponse', { challengerName, accept: false });
  challengeSection.classList.add('hidden');
  // 恢复显示玩家列表和输入框区域
  displayList.style.display = 'block';
  inputBoxDiv.style.display = 'block';
});

// 接受挑战按钮
acceptBtn.addEventListener('click', () => {
  const challengerName = acceptBtn.dataset.challenger;
  socket.emit('challengeResponse', { challengerName, accept: true });
  challengeSection.classList.add('hidden');
  // 游戏开始由后端通知显示
});

// 挑战被拒绝
socket.on('challengeRejected', (responderName) => {
  alert(`Player ${responderName} reject you!`);
});

// 游戏开始
socket.on('gameStart', (data) => {
  currentGameId = data.gameId;

  // 隐藏其他区域，显示游戏区域
  displayList.style.display = 'none';
  inputBoxDiv.style.display = 'none';
  challengeSection.classList.add('hidden');
  gameOverSection.classList.add('hidden');
  gameSection.classList.remove('hidden');

  roundResultP.textContent = '';
  hasAnswered = false;

  updateScoreText(data.opponent, 0, 0);
  showQuestion(data.question, data.options);
});

// 下一题
socket.on('nextQuestion', (data) => {
  hasAnswered = false;
  roundResultP.textContent = '';
  updateScoreText('opponent', data.opponentScore, data.yourScore);
  showQuestion(data.question, data.options);
});

// 点击答案按钮提交答案
function answerClickHandler(idx) {
  if (hasAnswered) return;
  hasAnswered = true;
  clearInterval(timerInterval);
  disableAnswerButtons();
  socket.emit('submitAnswer', { gameId: currentGameId, answerIndex: idx });
}

function showQuestion(question, options) {
  questionText.textContent = question;
  answerOptionsDiv.innerHTML = '';
  roundResultP.textContent = '';

  options.forEach((option, idx) => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.style.display = 'block';
    btn.style.margin = '5px 0';
    btn.style.padding = '10px';
    btn.style.width = '100%';
    btn.style.borderRadius = '5px';
    btn.style.border = '1px solid #005a9c';
    btn.style.backgroundColor = '#e6f0ff';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => answerClickHandler(idx));
    answerOptionsDiv.appendChild(btn);
  });

  startTimer();  // 启动倒计时
}

// 更新分数显示文本
function updateScoreText(opponentName, opponentScore, yourScore) {
  scoreInfo.textContent = `${opponentName}: ${opponentScore} , you: ${yourScore} `;
}

// 显示本轮结果
socket.on('roundResult', (data) => {
  const correctAnswerText = answerOptionsDiv.children[data.correctAnswer]?.textContent || '';
  const yourAnswerText = answerOptionsDiv.children[data.yourAnswer]?.textContent || 'No answer.';

  let resultMsg = `Correct answer: "${correctAnswerText}"。\nYou chose "${yourAnswerText}".`;

  if (data.yourAnswerCorrect) {
    resultMsg += ' Right answer! 🥳';
  } else {
    resultMsg += ' Wrong answer! 😵';
  }

  resultMsg += `\nCurrent score: you: ${data.yourScore} , opponent: ${data.opponentScore} .`;

  roundResultP.textContent = resultMsg;
});

// 对手断线通知
socket.on('opponentDisconnected', () => {
  alert('Opponent disconnected, game over.');
  resetToStart();
});

// 游戏结束
socket.on('gameOver', (data) => {
  gameSection.classList.add('hidden');
  gameOverSection.classList.remove('hidden');
  finalResultText.textContent = `${data.resultText}\nfinal score: you: ${data.yourScore}   opponent: ${data.opponentScore}`;
});

// 返回起始页面按钮
backToStartBtn.addEventListener('click', () => {
  resetToStart();
});

// 重置到初始状态：显示输入名字和玩家列表，隐藏游戏相关区
function resetToStart() {
  currentGameId = null;
  playerName = '';
  hasAnswered = false;

  gameOverSection.classList.add('hidden');
  gameSection.classList.add('hidden');
  challengeSection.classList.add('hidden');
  displayList.style.display = 'block';
  inputBoxDiv.style.display = 'block';

  displayList.innerHTML = '';
  playerInput.value = '';
}

// 页面加载时，确保动态区块隐藏
window.addEventListener('load', () => {
  challengeSection.classList.add('hidden');
  gameSection.classList.add('hidden');
  gameOverSection.classList.add('hidden');
});

// 计时器相关
function startTimer() {
  const timerBar = document.getElementById('timerBar');
  let timeLeft = TIMER_DURATION;
  timerBar.style.width = '100%';

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft -= 0.1;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerBar.style.width = '0%';
      if (!hasAnswered) {
        hasAnswered = true;           // 标记已处理，防止重复
        disableAnswerButtons();
        showTimeoutMessage();
        // 关键：告诉服务器你超时没答题，提交一个特殊值（例如 -1）
        socket.emit('submitAnswer', { gameId: currentGameId, answerIndex: -1 });
      }
    } else {
      const percent = (timeLeft / TIMER_DURATION) * 100;
      timerBar.style.width = percent + '%';
    }
  }, 100);
}


function disableAnswerButtons() {
  const buttons = document.querySelectorAll('#answerOptions button');
  buttons.forEach(btn => btn.disabled = true);
}

function showTimeoutMessage() {
  roundResultP.textContent = 'Time out! ⏰';
}