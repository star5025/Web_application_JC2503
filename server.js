// 后端代码
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

// 保存留言信息
const messages = [];

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
    console.log(`User connected: ${socket.id}`);

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
      const challengerEntry = Object.entries(players).find(([id, p]) => p.name === challengerName);
      if (!challengerEntry) return;
      const [challengerId, challenger] = challengerEntry;

      if (accept) {
        // 生成游戏ID，创建游戏数据
        const gameId = generateGameId();
        const player1 = challengerId;
        const player2 = socket.id;

        games[gameId] = {
          players: [player1, player2],
          scores: { [player1]: 0, [player2]: 0 },
          currentQuestionIndex: 0,
          questions: quizQuestions,
          answers: {},
          answerTimes: {},
          roundEnded: false,
        };

        // 通知双方游戏开始，发送第一题
        const firstQuestion = quizQuestions[0];
        players[player1].socket.emit('gameStart', {
          gameId,
          opponent: players[player2].name,
          question: firstQuestion.question,
          options: firstQuestion.options,
        });
        players[player2].socket.emit('gameStart', {
          gameId,
          opponent: players[player1].name,
          question: firstQuestion.question,
          options: firstQuestion.options,
        });
      } else {
        // 挑战被拒绝通知挑战者
        challenger.socket.emit('challengeRejected', players[socket.id].name);
      }
    });

    // 监听提交答案事件，判分逻辑
    socket.on('submitAnswer', ({ gameId, answerIndex }) => {
      const game = games[gameId];
      if (!game) return;
      if (!game.players.includes(socket.id)) return;

      // 初始化答案和时间戳存储
      // 'answers' is used to store each player's choice
      // 'answerTimes' is used to store the time when each player chose the option
      if (!game.answers) game.answers = {};
      if (!game.answerTimes) game.answerTimes = {};
      if (!game.scores) {
        // 初始化分数，确保有默认值
        game.scores = {};
        game.players.forEach(playerId => {
          if (game.scores[playerId] === undefined) game.scores[playerId] = 0;
        });
      }

      // 如果本轮已结束，拒绝提交
      if (game.roundEnded) {
        // 可以给客户端提示本轮已结束
        socket.emit('answerRejected', { reason: 'Round already ended.' });
        return;
      }

      // 如果已经提交答案就忽略
      // If player has already submitted an answer, then any subsequent answers they provide will be disregarded.
      if (game.answers[socket.id] !== undefined) return;

      // 保存玩家提交的选择以及提交的时间
      // Save the answer and the time
      game.answers[socket.id] = answerIndex;
      game.answerTimes[socket.id] = Date.now();

      // 一旦第一个玩家提交答案，标记本轮结束，阻止另一个玩家提交
      game.roundEnded = true;

      // 主动通知另一玩家本轮已结束，不能再答题
      const otherPlayerId = game.players.find(id => id !== socket.id);
      if (players[otherPlayerId] && players[otherPlayerId].socket) {
        players[otherPlayerId].socket.emit('roundEnded', {
          message: 'Opponent has answered, round ended. You cannot submit answer now.'
        });
      }

      // Find current question by index and then find its correct answer
      // 保存正确答案
      const qIndex = game.currentQuestionIndex;
      const correctIndex = game.questions[qIndex].answerIndex;

      // 计算当前两位玩家及其答案
      const p1 = game.players[0];
      const p2 = game.players[1];
      const a1 = game.answers[p1];
      const a2 = game.answers[p2];

      // 判断是否有至少一人答题
      const playersAnswered = Object.keys(game.answers);

      // 只要有一人答题，就开始判分（根据你想要的判分时机）
      if (playersAnswered.length >= 1) {
        // 找出答对且最快的玩家
        let winnerId = null;
        let winnerTime = Infinity;

        for (const playerId of game.players) {
          if (game.answers[playerId] === correctIndex) {
            if (game.answerTimes[playerId] < winnerTime) {
              winnerTime = game.answerTimes[playerId];
              winnerId = playerId;
            }
          }
        }

        // 清除本题临时分数防止累加重复
        // 注意这里是累加总分，故不清0，只是确保初始有值
        game.scores[p1] = game.scores[p1] || 0;
        game.scores[p2] = game.scores[p2] || 0;

        if (winnerId) {
          // 赢家得2分，对手0分
          // Player who has submitted right answer faster gets 2 points while his/her opponent gets 0 point
          game.scores[winnerId] += 2;
          const loserId = game.players.find(id => id !== winnerId);
          // 对手不得分
          // 明确给0分加法写上，但加0无影响
          game.scores[loserId] += 0;
        } else {
          // 无赢家：双方都答错或都未答
          // 找出最快答错者
          let firstWrongId = null;
          let firstWrongTime = Infinity;

          for (const playerId of game.players) {
            if (game.answers[playerId] !== correctIndex) {
              if (game.answerTimes[playerId] < firstWrongTime) {
                firstWrongTime = game.answerTimes[playerId];
                firstWrongId = playerId;
              }
            }
          }

          if (firstWrongId) {
            // 答错者0分
            game.scores[firstWrongId] += 0;
            // 对手得1分
            const opponentId = game.players.find(id => id !== firstWrongId);
            game.scores[opponentId] += 1;
          } else {
            // 两人都未答或其他情况，双方0分
            game.scores[p1] += 0;
            game.scores[p2] += 0;
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
        game.roundEnded = false; // 重置，准备下一题
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
    
  // 新连接时，发送当前留言板内容
  // When users are connected, emit the content of message board to them
  socket.emit('messageBoard', messages);

  // Listening for the events of leaving messages on message board
  socket.on('message', ({nickname, message}) => {
  // 保存留言
  messages.push({nickname, message});

  // 广播更新留言板给所有客户端
  io.emit('messageBoard', messages);
  });
});