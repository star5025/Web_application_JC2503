const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// 静态文件托管，假设前端文件放 public 文件夹
app.use(express.static('public'));

// 维护在线玩家列表，格式：{ socketId: { name, socket } }
// Record online player's name and socketID
const players = {};

// 维护正在进行的游戏，格式：{ gameId: { players: [socketId1, socketId2], scores, currentQuestionIndex, questions } }
// Record game room's information like two participants' socketD, their current scores, the progress of quiz and questions
const games = {};

// 游戏题目
// Store questions of the quiz game, there are 5 questions in total
const quizQuestions = [
    {
      // 题干
      // Question
        question: "Which of the following landmark belongs to Singapore? 🇸🇬",
      // 选项
      // Options
        options: ["The Merlion", "Buckingham Palace", "ICEHOTEL", "The Great Wall"],
      // 答案在选项数组中的索引
      // The index of the answer in the 'option' array
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

// 广播当前在线玩家列表
// Emit the list of online players to front-end
function broadcastPlayerList() {
    const list = Object.values(players).map(p => p.name);
    io.emit('playerList', list);
}

// 生成唯一游戏ID
// Create a unique ID for each game
function generateGameId() {
    return 'game-' + Math.random().toString(36).substr(2, 9);
}

// 让服务器开始监听端口号3000的信息
// Start the server to listen message on port 3000 
http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// 监听玩家上线的事件，一般在玩家进入网页时触发
// Listening for events of the connection of new player
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // 监听玩家注册用户名的事件
    // Listening for events of registration of names
    socket.on('register', (name) => {
        // 保存玩家
        // Save new player's information to 'players' array
        players[socket.id] = { name, socket };
        console.log(`Player registered: ${name}`);
        // 广播在线玩家列表
        broadcastPlayerList();
    });

    // 监听玩家断开连接的事件
    // Listening for events of disconnection of player
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        // 查找是否在游戏中，通知对手
        // If the player who has left is currently in a game, emit message to his/her opponent
        for (const [gameId, game] of Object.entries(games)) {
            if (game.players.includes(socket.id)) {
                // 通知对手游戏结束
                const otherId = game.players.find(id => id !== socket.id);
                if (players[otherId]) {
                    players[otherId].socket.emit('opponentDisconnected');
                }
                // 删除游戏
                // Delete current game
                delete games[gameId];
                break;
            }
        }
        // 在在线玩家列表中删除已离线玩家
        // Delete the information of player who has left
        delete players[socket.id];
        // 因为此时在线玩家列表更新，需要广播一次最新的玩家列表
        // Emit the updated player list to front-end
        broadcastPlayerList();
    });

    // 监听玩家发起挑战的事件
    // Listening for events of player challenging other player 
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
        // Emit the event of being challenged to the challenged player
        opponent.socket.emit('challenged', challenger.name);
    });

    // 监听被挑战者回应挑战的事件
    // Listening for events of whether the challenged player accepts the challenge
    socket.on('challengeResponse', ({ challengerName, accept }) => {
        const responder = players[socket.id];
        if (!responder) return;
        const challengerEntry = Object.entries(players).find(([id, p]) => p.name === challengerName);
        if (!challengerEntry) return;
        const [challengerId, challenger] = challengerEntry;
        // 接受挑战
        // Accept
        if (accept) {
            // 创建游戏
            // Create a new game
            const gameId = generateGameId();
            games[gameId] = {
                players: [challengerId, socket.id],
                scores: { [challengerId]: 0, [socket.id]: 0 },
                currentQuestionIndex: 0,
                questions: quizQuestions
            };

            // 通知双方游戏开始
            // Emit the event of game has begun to both challenger and responder
            [challenger.socket, responder.socket].forEach(s => {
                s.emit('gameStart', {
                  // 初始化游戏信息
                  // Initiate the information of new game
                    opponent: (s.id === challengerId) ? responder.name : challenger.name,
                    question: quizQuestions[0].question,
                    options: quizQuestions[0].options,
                    scores: { you: 0, opponent: 0 },
                    gameId
                });
            });
        } else {
            // 拒绝挑战，通知挑战者
            // If the responder rejects the challenge, emit the event of challenge has been rejected to the challenger
            challenger.socket.emit('challengeRejected', responder.name);
        }
    });

    // 监听玩家提交答案的事件
    // Listening the event of submitting answer (player has clicked the option button)
    socket.on('submitAnswer', ({ gameId, answerIndex }) => {
      const game = games[gameId];
      if (!game) return;
      if (!game.players.includes(socket.id)) return;
  
      // 初始化答案和时间戳存储
      // 'answers' is used to store each player's choice
      // 'answerTimes' is used to store the time when each player chose the option
      if (!game.answers) game.answers = {};
      if (!game.answerTimes) game.answerTimes = {};
  
      // 如果已经提交答案就忽略
      // If player has already submitted an answer, then any subsequent answers they provide will be disregarded.
      if (game.answers[socket.id] !== undefined) return;
  
      // 保存玩家提交的选择以及提交的时间
      // Save the answer and the time
      game.answers[socket.id] = answerIndex;
      game.answerTimes[socket.id] = Date.now();
  
      // Find current question by index and then find its correct answer
      // 保存正确答案
      const qIndex = game.currentQuestionIndex;
      const correctIndex = game.questions[qIndex].answerIndex;
  
      // 判断是否有答案提交
      const playersAnswered = Object.keys(game.answers);
  
      // 一旦有玩家提交答案，就尝试判分
      // If a player has already made a choice, then start to score
      if (playersAnswered.length >= 1) {
          // 只要有一人答对就立即判分
          let winnerId = null;
          let winnerAnswerTime = Infinity;
  
          // 先找出答对玩家中最早提交者
          // Identify the earliest submitter among the players who answered correctly
          for (const playerId of playersAnswered) {
              if (game.answers[playerId] === correctIndex) {
                  if (game.answerTimes[playerId] < winnerAnswerTime) {
                      winnerAnswerTime = game.answerTimes[playerId];
                      winnerId = playerId;
                  }
              }
          }
  
          // 计算分数
          // p1 and p2 represent the players, a1 and a2 represent their choices
          const p1 = game.players[0];
          const p2 = game.players[1];
          const a1 = game.answers[p1];
          const a2 = game.answers[p2];
  
          // 如果有赢家（答对且最先提交）
          if (winnerId) {
              // 赢家得2分，对手0分
              // Player who has submitted right answer faster gets 2 points while his/her opponent gets 0 point
              game.scores[winnerId] += 2;
              const loserId = game.players.find(id => id !== winnerId);
              game.scores[loserId] += 0;
          } else {
              // 无赢家：双方都答错，双方0分
              // If both players chose the wrong answer
              // 题目规则中答错玩家0分，对方1分，但双方都错，则都0分
              // Both of them get 0 point
              game.scores[p1] += 0;
              game.scores[p2] += 0;
          }
  
          // 对于答错玩家，对手得1分（如果对手没得2分的情况下）
          // Player who has submitted the answer faster but has submitted wrong answer gets 0 point while his/her opponent gets 1 point
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
          // Emit the information about this round to both players in the same game
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
          // Clear the variable to prepare for next round
          game.answers = {};
          game.answerTimes = {};
          game.currentQuestionIndex++;
  
          // 如果问题已经全部问完，游戏结束
          // If all the questions in 'questions' array have already been asked, then the game is over
          if (game.currentQuestionIndex >= game.questions.length) {
              game.players.forEach(playerId => {
                  const socketPlayer = players[playerId].socket;
                  const yourScore = game.scores[playerId];
                  const opponentScore = game.scores[game.players.find(id => id !== playerId)];
                  // 平局文本
                  // resultText will be shown on front-end
                  let resultText = 'Draw! 😮';
                  // 胜利文本
                  if (yourScore > opponentScore) resultText = 'You win! Congratulation! 🍾';
                  // 失败文本
                  else if (yourScore < opponentScore) resultText = 'You lose. Keep trying! 💪';
  
                  // Emit the information about the result (scores) and the corresponding text to players
                  socketPlayer.emit('gameOver', {
                      yourScore,
                      opponentScore,
                      resultText
                  });
              });
              // 删除当前游戏
              delete games[gameId];
          } 
          // 如果问题还没被问完，准备进入下一个问题
          // If the question has not been fully answered, prepare to move on to the next question
          else {
            // The next question will be sent after 2500ms
              setTimeout(() => {
                  const q = game.questions[game.currentQuestionIndex];
                  game.players.forEach(playerId => {
                      const socketPlayer = players[playerId].socket;
                      const yourScore = game.scores[playerId];
                      const opponentScore = game.scores[game.players.find(id => id !== playerId)];
                      // Emit next question to players
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