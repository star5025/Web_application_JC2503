const socket = io();
    
// === 页面元素引用 ===
const contentDiv = document.querySelector('.container .content');

const playerNameForm = document.getElementById('playerName');     // 你的名字输入表单
const playerInput = document.getElementById('player');             // 你的名字输入框
const displayList = document.getElementById('displayList');        // 在线玩家列表容器
const inputBoxDiv = document.querySelector('.inputBox');           // 输入名字的整体区域
const TIMER_DURATION = 5; // 秒数，可自行修改
let timerInterval = null;

// 动态创建挑战提示区，放在 content 内，初始隐藏
const challengeSection = document.createElement('div');
challengeSection.id = 'challengeSection';
challengeSection.classList.add('hidden');
challengeSection.innerHTML = `
  <h2>有人挑战你！</h2>
  <p id="challengerName"></p>
  <button id="acceptChallengeBtn">接受</button>
  <button id="rejectChallengeBtn">拒绝</button>
`;
contentDiv.appendChild(challengeSection);

// 动态创建游戏进行区，初始隐藏
const gameSection = document.createElement('div');
gameSection.id = 'gameSection';
gameSection.classList.add('hidden');
gameSection.innerHTML = `
  <h2>游戏进行中</h2>
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
  <h2>游戏结束</h2>
  <p id="finalResult"></p>
  <button id="backToStartBtn">返回起始页面</button>
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
    alert('请输入你的名字');
    return;
  }
  playerName = name;
  socket.emit('register', playerName);

  // 隐藏输入名字区域，显示玩家列表
  inputBoxDiv.style.display = 'none';
  displayList.innerHTML = '<p>等待在线玩家列表更新...</p>';
});

// 更新在线玩家列表
socket.on('playerList', (list) => {
  // 过滤掉自己
  const otherPlayers = list.filter(name => name !== playerName);
  displayList.innerHTML = '';

  if (otherPlayers.length === 0) {
    displayList.innerHTML = '<p>当前没有其他玩家在线</p>';
  } else {
    otherPlayers.forEach(name => {
      const playerItem = document.createElement('div');
      playerItem.textContent = name;
      playerItem.classList.add('playerItem');
      playerItem.style.cursor = 'pointer';
      playerItem.style.padding = '5px 10px';
      playerItem.style.border = '1px solid #ccc';
      playerItem.style.margin = '5px 0';
      playerItem.style.borderRadius = '4px';
      playerItem.addEventListener('click', () => {
        if (confirm(`你确定要挑战玩家 ${name} 吗？`)) {
          socket.emit('challenge', name);
          alert(`已向 ${name} 发出挑战请求，请等待回应`);
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
  challengerNameP.textContent = `玩家 ${challengerName} 挑战你！`;
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
  alert(`玩家 ${responderName} 拒绝了你的挑战`);
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
  updateScoreText('对手', data.opponentScore, data.yourScore);
  showQuestion(data.question, data.options);
});

// 点击答案按钮提交答案
function answerClickHandler(idx) {
  if (hasAnswered) return;
  hasAnswered = true;
  clearInterval(timerInterval); // 停止倒计时
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
  scoreInfo.textContent = `${opponentName}: ${opponentScore} 分, 你: ${yourScore} 分`;
}

// 显示本轮结果
socket.on('roundResult', (data) => {
  const correctAnswerText = answerOptionsDiv.children[data.correctAnswer]?.textContent || '';
  const yourAnswerText = answerOptionsDiv.children[data.yourAnswer]?.textContent || '无答案';

  let resultMsg = `本轮正确答案是 "${correctAnswerText}"。\n你选择了 "${yourAnswerText}"。`;

  if (data.yourAnswerCorrect) {
    resultMsg += ' 你答对了！';
  } else {
    resultMsg += ' 你答错了。';
  }

  resultMsg += `\n当前比分：你 ${data.yourScore} 分， 对手 ${data.opponentScore} 分。`;

  roundResultP.textContent = resultMsg;
});

// 对手断线通知
socket.on('opponentDisconnected', () => {
  alert('对手已断线，游戏结束');
  resetToStart();
});

// 游戏结束
socket.on('gameOver', (data) => {
  gameSection.classList.add('hidden');
  gameOverSection.classList.remove('hidden');
  finalResultText.textContent = `${data.resultText}\n最终比分：你 ${data.yourScore} 分， 对手 ${data.opponentScore} 分。`;
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
      disableAnswerButtons();
      showTimeoutMessage();
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
  roundResultP.textContent = '时间到！本轮未作答。';
}



