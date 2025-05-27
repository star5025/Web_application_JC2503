const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// 静态文件托管，假设前端文件放 public 文件夹
app.use(express.static('public'));

// 维护在线玩家列表，格式：{ socketId: { name, socket } }
const players = {};

// 维护正在进行的游戏，格式：{ gameId: { players: [socketId1, socketId2], scores, currentQuestionIndex, questions } }
const games = {};

// 简单题库示例，至少5题
const quizQuestions = [
    {
        question: "Which of the following landmark belongs to Singapore? 🇸🇬",
        options: ["The Merlion", "Buckingham Palace", "ICEHOTEL", "The Great Wall"],
        answerIndex: 0
    },
    {
        question: "Which of the following natural landscapes does not belong to the United Kingdom? 🇬🇧",
        options: ["Isle of Skye", "Stonehenge", "Giant's Causeway", "Mount Fuji"],
        answerIndex: 3
    },
    {
        question: "Which of the following mountain belongs to Europe? 🌍",
        options: ["Karakoram", "Himalayas", "Mont Blanc", "The Northern Alps"],
        answerIndex: 2
    },
    {
        question: "Which of the following national park does not belong to the United States? 🇺🇸",
        options: ["Yellostone", "Lake District", "Grand Canyon", "Yosemite"],
        answerIndex: 1
    },
    {
        question: "Which of the following historical building does not belong to China? 🇨🇳",
        options: ["Edinburgh Castle", "The Terracotta Army", "The Summer Palace", "The Forbidden City"],
        answerIndex: 0
    }
];

// 工具函数：广播当前在线玩家列表（只发送名字）
function broadcastPlayerList() {
    const list = Object.values(players).map(p => p.name);
    io.emit('playerList', list);
}

// 生成唯一游戏ID
function generateGameId() {
    return 'game-' + Math.random().toString(36).substr(2, 9);
}

http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // 玩家注册用户名
    socket.on('register', (name) => {
        // 保存玩家
        players[socket.id] = { name, socket };
        console.log(`Player registered: ${name}`);
        broadcastPlayerList();
    });

    // 玩家断开连接
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        // 查找是否在游戏中，通知对手
        for (const [gameId, game] of Object.entries(games)) {
            if (game.players.includes(socket.id)) {
                // 通知对手游戏结束
                const otherId = game.players.find(id => id !== socket.id);
                if (players[otherId]) {
                    players[otherId].socket.emit('opponentDisconnected');
                }
                // 删除游戏
                delete games[gameId];
                break;
            }
        }
        delete players[socket.id];
        broadcastPlayerList();
    });

    // 发起挑战，参数：被挑战者名字
    socket.on('challenge', (opponentName) => {
        const challenger = players[socket.id];
        if (!challenger) return;
        const opponentEntry = Object.entries(players).find(([id, p]) => p.name === opponentName);
        if (!opponentEntry) {
            socket.emit('challengeError', 'Player dose not exit!');
            return;
        }
        const [opponentId, opponent] = opponentEntry;
        // 发送挑战通知给被挑战者
        opponent.socket.emit('challenged', challenger.name);
    });

    // 被挑战者回应挑战，参数：{ challengerName, accept: true/false }
    socket.on('challengeResponse', ({ challengerName, accept }) => {
        const responder = players[socket.id];
        if (!responder) return;
        const challengerEntry = Object.entries(players).find(([id, p]) => p.name === challengerName);
        if (!challengerEntry) return;
        const [challengerId, challenger] = challengerEntry;

        if (accept) {
            // 创建游戏
            const gameId = generateGameId();
            games[gameId] = {
                players: [challengerId, socket.id],
                scores: { [challengerId]: 0, [socket.id]: 0 },
                currentQuestionIndex: 0,
                questions: quizQuestions
            };

            // 通知双方游戏开始
            [challenger.socket, responder.socket].forEach(s => {
                s.emit('gameStart', {
                    opponent: (s.id === challengerId) ? responder.name : challenger.name,
                    question: quizQuestions[0].question,
                    options: quizQuestions[0].options,
                    scores: { you: 0, opponent: 0 },
                    gameId
                });
            });
        } else {
            // 拒绝挑战，通知挑战者
            challenger.socket.emit('challengeRejected', responder.name);
        }
    });

    // 玩家提交答案，参数：{ gameId, answerIndex }
    socket.on('submitAnswer', ({ gameId, answerIndex }) => {
      const game = games[gameId];
      if (!game) return;
      if (!game.players.includes(socket.id)) return;
  
      // 初始化答案和时间戳存储
      if (!game.answers) game.answers = {};
      if (!game.answerTimes) game.answerTimes = {};
  
      // 如果已经提交答案就忽略
      if (game.answers[socket.id] !== undefined) return;
  
      game.answers[socket.id] = answerIndex;
      game.answerTimes[socket.id] = Date.now();
  
      const qIndex = game.currentQuestionIndex;
      const correctIndex = game.questions[qIndex].answerIndex;
  
      // 判断是否有答案提交
      const playersAnswered = Object.keys(game.answers);
  
      // 一旦有玩家提交答案，就尝试判分，本逻辑中第一提交的正确答者得分
      if (playersAnswered.length >= 1) {
          // 只要有一人答对就立即判分
          let winnerId = null;
          let winnerAnswerTime = Infinity;
  
          // 先找出答对玩家中最早提交者
          for (const playerId of playersAnswered) {
              if (game.answers[playerId] === correctIndex) {
                  if (game.answerTimes[playerId] < winnerAnswerTime) {
                      winnerAnswerTime = game.answerTimes[playerId];
                      winnerId = playerId;
                  }
              }
          }
  
          // 计算分数
          const p1 = game.players[0];
          const p2 = game.players[1];
          const a1 = game.answers[p1];
          const a2 = game.answers[p2];
  
          // 如果有赢家（答对且最先提交）
          if (winnerId) {
              // 赢家得2分，对手0分
              game.scores[winnerId] += 2;
              const loserId = game.players.find(id => id !== winnerId);
              game.scores[loserId] += 0;
          } else {
              // 无赢家：双方都答错，双方0分
              // 题目规则中答错玩家0分，对方1分，但双方都错，则都0分
              game.scores[p1] += 0;
              game.scores[p2] += 0;
          }
  
          // 对于答错玩家，对手得1分（如果对手没得2分的情况下）
          for (const playerId of game.players) {
              if (game.answers[playerId] !== correctIndex) {
                  const opponentId = game.players.find(id => id !== playerId);
                  // 仅当对手不是赢家时，给对手加1分
                  if (winnerId !== opponentId) {
                      game.scores[opponentId] += 1;
                  }
              }
          }
  
          // 给双方发送本轮结果
          game.players.forEach(playerId => {
              const socketPlayer = players[playerId].socket;
              const youAnswer = game.answers[playerId];
              const youCorrect = (youAnswer === correctIndex);
              const opponentId = game.players.find(id => id !== playerId);
              const opponentScore = game.scores[opponentId];
              const yourScore = game.scores[playerId];
  
              socketPlayer.emit('roundResult', {
                  correctAnswer: correctIndex,
                  yourAnswer: youAnswer,
                  yourScore,
                  opponentScore,
                  yourAnswerCorrect: youCorrect
              });
          });
  
          // 清空答案和时间戳，准备下一题
          game.answers = {};
          game.answerTimes = {};
          game.currentQuestionIndex++;
  
          if (game.currentQuestionIndex >= game.questions.length) {
              // 游戏结束
              game.players.forEach(playerId => {
                  const socketPlayer = players[playerId].socket;
                  const yourScore = game.scores[playerId];
                  const opponentScore = game.scores[game.players.find(id => id !== playerId)];
                  let resultText = 'Draw! 😮';
                  if (yourScore > opponentScore) resultText = 'You win! Congratulation! 🍾';
                  else if (yourScore < opponentScore) resultText = 'You lose. Keep trying! 💪';
  
                  socketPlayer.emit('gameOver', {
                      yourScore,
                      opponentScore,
                      resultText
                  });
              });
              delete games[gameId];
          } else {
              setTimeout(() => {
                  const q = game.questions[game.currentQuestionIndex];
                  game.players.forEach(playerId => {
                      const socketPlayer = players[playerId].socket;
                      const yourScore = game.scores[playerId];
                      const opponentScore = game.scores[game.players.find(id => id !== playerId)];
                      socketPlayer.emit('nextQuestion', {
                          question: q.question,
                          options: q.options,
                          yourScore,
                          opponentScore
                      });
                  });
              }, 2500);
          }
      }
  });  
});