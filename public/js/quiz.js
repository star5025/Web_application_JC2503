// 前端代码
const socket = io();
    
// 页面元素
// Page elements
const contentDiv = document.querySelector('.container .content');
const playerNameForm = document.getElementById('playerName');
const playerInput = document.getElementById('player'); 
const displayList = document.getElementById('displayList'); 
const inputBoxDiv = document.querySelector('.inputBox'); 

// The time limit for answering each question is 8s
const TIMER_DURATION = 8;
let timerInterval = null;

// 动态创建挑战提示区，初始隐藏
// Display when receive a challenge
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
// Display when game starts
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
// Display when game is over
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
// When player inputs his/her name and click the submit button, the socket will emit the information of name to back-end server 
playerNameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = playerInput.value.trim();
  // Give a prompt when the information is blank.
  if (!name) {
    alert('Please enter your name.');
    return;
  }
  playerName = name;
  socket.emit('register', playerName);

  // 玩家注册名字后，隐藏输入名字区域，显示玩家列表
  // The name input section will be hidden after player submits the name
  inputBoxDiv.style.display = 'none';
  displayList.innerHTML = '<p>Waiting for online player list to be updated...</p>';
});

// 更新在线玩家列表
// Listening for online player list
socket.on('playerList', (list) => {
  // 过滤掉自己
  const otherPlayers = list.filter(name => name !== playerName);
  displayList.innerHTML = '';

  // If there is no other player
  if (otherPlayers.length === 0) {
    displayList.innerHTML = '<p>No online player.</p>';
  } else {
    otherPlayers.forEach(name => {
      const playerItem = document.createElement('div');
      playerItem.textContent = name;
      playerItem.classList.add('playerItem');
      // 玩家通过点击向在线玩家发起挑战
      // Click to select an online player to challenge
      playerItem.addEventListener('click', () => {
        if (confirm(`Are you sure to challenge the player, ${name}?`)) {
          // 将被挑战者的名字发给后端
          // Emit the information about the name of receiver to back-end server
          socket.emit('challenge', name);
          alert(`A challenge request has been sent to ${name}. Please wait for response.`);
        }
      });
      displayList.appendChild(playerItem);
    });
  }
});

// 收到挑战通知
// Listening for the events of receiving the challenge
socket.on('challenged', (challengerName) => {
  // 隐藏玩家列表和输入框区域
  // Hide the online player list and name input box
  displayList.style.display = 'none';
  inputBoxDiv.style.display = 'none';

  // 显示挑战提示区
  // Display challenge section
  challengeSection.classList.remove('hidden');
  challengerNameP.textContent = `Player ${challengerName} challenge you!`;
  acceptBtn.dataset.challenger = challengerName;
  rejectBtn.dataset.challenger = challengerName;
});

// 拒绝挑战按钮
// Receiver clicks reject button to emit information about rejection to server
rejectBtn.addEventListener('click', () => {
  const challengerName = rejectBtn.dataset.challenger;
  socket.emit('challengeResponse', { challengerName, accept: false });
  challengeSection.classList.add('hidden');
  // 恢复显示玩家列表和输入框区域
  // Restore the display of the player list and input box area
  displayList.style.display = 'block';
  inputBoxDiv.style.display = 'block';
});

// 接受挑战按钮
// Receiver clicks accept button to emit information about acceptance to server
acceptBtn.addEventListener('click', () => {
  const challengerName = acceptBtn.dataset.challenger;
  socket.emit('challengeResponse', { challengerName, accept: true });
  challengeSection.classList.add('hidden');
  // 游戏开始由后端通知显示
});

// 挑战被拒绝
// Listening for the events of rejection of the challenge
socket.on('challengeRejected', (responderName) => {
  alert(`Player ${responderName} reject you!`);
});

// 游戏开始
// Listening for the events of game
socket.on('gameStart', (data) => {
  currentGameId = data.gameId;

  // 隐藏其他区域，显示游戏区域
  // Display game section while hide other section
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
// Listening for the events of next question
socket.on('nextQuestion', (data) => {
  hasAnswered = false;
  roundResultP.textContent = '';
  updateScoreText('opponent', data.opponentScore, data.yourScore);
  showQuestion(data.question, data.options);
});

// 点击答案按钮提交答案
// Click the option block to submit answer to server
function answerClickHandler(idx) {
  if (hasAnswered) return;
  hasAnswered = true;
  clearInterval(timerInterval);
  disableAnswerButtons();
  socket.emit('submitAnswer', { gameId: currentGameId, answerIndex: idx });
}

// 展示问题和选项
// Show question and options on the page
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

  enableAnswerButtons();
  startTimer();
}

// 更新分数显示文本
// Update current score
function updateScoreText(opponentName, opponentScore, yourScore) {
  scoreInfo.textContent = `${opponentName}: ${opponentScore} , you: ${yourScore} `;
}

// 显示本轮结果
// Listening for the events of the result of a round
socket.on('roundResult', (data) => {
  const correctAnswerText = answerOptionsDiv.children[data.correctAnswer]?.textContent || '';
  const yourAnswerText = answerOptionsDiv.children[data.yourAnswer]?.textContent || 'No answer.';

  let resultMsg = `Correct answer: "${correctAnswerText}"。\nYou chose "${yourAnswerText}".`;

  if (data.yourAnswerCorrect) {
    resultMsg += ' Right! 🥳';
  }
  else {
    resultMsg += ' Wrong! 😵';
  }

  resultMsg += `\nCurrent score: you: ${data.yourScore} , opponent: ${data.opponentScore} .`;

  roundResultP.textContent = resultMsg;
});

// 对手断线通知
// Listening for the events of disconnection of the player in the same game
socket.on('opponentDisconnected', () => {
  alert('Opponent disconnected, game over.');
  resetToStart();
});

// 游戏结束
// Listening for the events of game over
socket.on('gameOver', (data) => {
  // Hide the game section and show result
  gameSection.classList.add('hidden');
  gameOverSection.classList.remove('hidden');
  finalResultText.textContent = `${data.resultText}\nfinal score: you: ${data.yourScore}   opponent: ${data.opponentScore}`;
});

// 返回起始页面按钮
// Click to restart the page
backToStartBtn.addEventListener('click', () => {
  resetToStart();
});

// 重置到初始状态：显示输入名字和玩家列表，隐藏游戏相关区
// Restart the page
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
// Timer in each round
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
        hasAnswered = true;           
        disableAnswerButtons();
        showTimeoutMessage();
        socket.emit('submitAnswer', { gameId: currentGameId, answerIndex: -1 });
      }
    } else {
      const percent = (timeLeft / TIMER_DURATION) * 100;
      timerBar.style.width = percent + '%';
    }
  }, 100);
}

// 每题做出选择后无法再次选择
// Player can not change their choice after submitting in a round
function disableAnswerButtons() {
  const buttons = document.querySelectorAll('#answerOptions button');
  buttons.forEach(btn => btn.disabled = true);
}

// 允许按钮点击（下一题时调用）
// Enable buttons so player can choose again
function enableAnswerButtons() {
  const buttons = document.querySelectorAll('#answerOptions button');
  buttons.forEach(btn => btn.disabled = false);
}

// 倒计时结束时展示文本
function showTimeoutMessage() {
  roundResultP.textContent = 'Time out! ⏰';
}

// 监听服务器通知本轮结束，不允许再答题
// When someone chose an answer, the other is not allow tp choose
socket.on('roundEnded', (data) => {
  if (!hasAnswered) {
    hasAnswered = true;
    clearInterval(timerInterval);
    disableAnswerButtons();
    roundResultP.textContent = 'Opponent answered first, round ended.';
  }
});

// 监听服务器拒绝答案提交（如重复提交或超时已结束）
socket.on('answerRejected', (data) => {
  alert(`Answer rejected: ${data.reason}`);
});