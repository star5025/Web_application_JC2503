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
        question: "下列哪种水果是红色的？",
        options: ["苹果", "香蕉", "葡萄", "橘子"],
        answerIndex: 0
    },
    {
        question: "世界上最高的山峰是？",
        options: ["珠穆朗玛峰", "乞力马扎罗山", "阿尔卑斯山", "富士山"],
        answerIndex: 0
    },
    {
        question: "JavaScript 是什么类型的语言？",
        options: ["编译型", "解释型", "汇编语言", "机器语言"],
        answerIndex: 1
    },
    {
        question: "HTML 用于什么？",
        options: ["结构化网页", "样式设计", "数据存储", "服务器编程"],
        answerIndex: 0
    },
    {
        question: "CSS 主要用于？",
        options: ["添加样式", "网页结构", "数据库操作", "逻辑编程"],
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
            socket.emit('challengeError', '玩家不存在或不在线');
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

        // 保存答案
        if (!game.answers) game.answers = {};
        game.answers[socket.id] = answerIndex;

        // 如果两人都答了，判断结果
        if (Object.keys(game.answers).length === 2) {
            const qIndex = game.currentQuestionIndex;
            const correctIndex = game.questions[qIndex].answerIndex;

            // 计算分数
            const p1 = game.players[0];
            const p2 = game.players[1];
            const a1 = game.answers[p1];
            const a2 = game.answers[p2];

            // 规则：
            // - 正确且更快的得2分，错的0分
            // - 错的对手得1分
            // 这里简化为同时提交，判断谁先提交可用时间戳，示例不实现时间判断，按提交顺序算

            // 按提交顺序得分（这里简化，实际需客户端发送时间戳）
            let firstCorrect = null;
            if (a1 === correctIndex && a2 === correctIndex) {
                // 两人都答对，平局各2分
                game.scores[p1] += 2;
                game.scores[p2] += 2;
            } else if (a1 === correctIndex) {
                // 玩家1答对
                game.scores[p1] += 2;
                game.scores[p2] += 0;
            } else if (a2 === correctIndex) {
                // 玩家2答对
                game.scores[p2] += 2;
                game.scores[p1] += 0;
            } else {
                // 两人都错，对方各得1分（按规则其实是错的人0分，另一方1分，均错就0分？这里按题目规则调整）
                // 题目中说答错0分，另一方得1分，所以双方都错 -> 都0分
            }

            // 发送本轮结果给双方
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

            // 清空答案，准备下一题或结束
            game.answers = {};
            game.currentQuestionIndex++;

            if (game.currentQuestionIndex >= game.questions.length) {
                // 游戏结束，发送结果
                game.players.forEach(playerId => {
                    const socketPlayer = players[playerId].socket;
                    const yourScore = game.scores[playerId];
                    const opponentScore = game.scores[game.players.find(id => id !== playerId)];
                    let resultText = '平局！';
                    if (yourScore > opponentScore) resultText = '你赢了，恭喜！';
                    else if (yourScore < opponentScore) resultText = '你输了，再接再厉！';

                    socketPlayer.emit('gameOver', {
                        yourScore,
                        opponentScore,
                        resultText
                    });
                });
                delete games[gameId];
            } else {
                // 发送下一题，延迟5秒后发
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
                }, 5000);
            }
        }
    });
});

