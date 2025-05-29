# Report

## 1. Overview

This web aplication contains two static pages and a quiz game. They are implemented by **HTML**, **CSS** and **JavaScript**. 
As for the quiz game, it is implemented by **Socket.io** and **Express**. 
Users can challenge other online users on this page.

### Introduction Page

This page contains **static content** of the **introduction** about the web application and its structure and my personal introduction.
To implement the function of navigating to the other two pages, a **sidebar** is constructed on the left of the page.
Inside the sidebar there is a **real-time update message board** implemented by Socket.io, users can leave their messages and check others messages.

### About Page

The content of this page is about my **private interests**.
There is a **navigate bar** on the top which enables users navigate to corresponding interest.
Users can click the **buttons** on the right side of the bottom of the page to navigate to Introduction Page or About Page.


### Quiz Page (Front-end)

The client is a single-page application built with **HTML**, **CSS**, and **JavaScript**. 
After loading, users can **register their name** and they will be shown a **list of online players**. 
Players can challenge others by **clicking on their names**, prompting the challenged player to **accept or reject the invitation**. 
When player accepted the challenge, the game interface will load and begin displaying questions. 
Each question has **multiple-choice options** and an eight-second **countdown timer**. 
At the end of each question session, there will be a **feedback** about current score and the result of answer displaying on the page. 
**After submission or timeout**, the UI will disable answer selection, so it allows only one answer per player per round. 
If a player fails to answer before the timer expires, the client automatically submits a timeout response. 
Real-time feedback is provided throughout the game to keep players informed of round results and overall standings.

### Quiz Page (Back-end)

The server is developed with **Node.js** and **Express**, serving static files and using **Socket.io** for WebSocket communication. It manages:

- A registry of online players, tracking their **socket IDs** and **names**.
- Active game sessions identified by unique **game IDs**, which store player sockets, current questions, submitted answers, timestamps, and scores.

When the challenge receiver accept, the server creates a new game, and notifies both players to start. The server enforces game logic by:

- Preventing answer submissions once the first player submits to avoid late or duplicate answers.
- Calculating scores according to the rules: the first correct answer earns 2 points, the opponent earns 0 points; if no correct answers, the fastest wrong answer’s opponent receives 1 point.
- Broadcasting round results and updating scores.
- Progressing through questions or ending the game with final results.
- Handling player disconnections by notifying opponents and cleaning up game sessions.

## 2. Client-Server Communication

- **Registration:**
  1. Clients emit `register` with their username after submitting.
  2. The server broadcasts `playerList` updates to all clients.

- **Challenge:**
  1. lients emit `challenge` with the target username.
  2. The server sends `challenged` to the target client.
  3. The challenged client responds with `challengeResponse` indicating acceptance or rejection.
  4. The server emits `gameStart` to both players if accepted, or `challengeRejected` if declined.

- **Gameplay:**
  1. Clients submit answers via `submitAnswer` with game ID and chosen answer index.
  2. The server verifies the submission, locks the round by setting a `roundEnded` flag, and emits `roundEnded` to the opponent to disable further answers.
  3. After scoring, the server sends `roundResult` to both clients with detailed outcomes.
  4. The server emits `nextQuestion` for subsequent rounds or `gameOver` when the quiz ends.

- **Reject and disconnection:**
  - `answerRejected` notifies clients if their submission is late or duplicate.
  - `opponentDisconnected` alerts players when their opponent disconnects mid-game.

## 3. Reflection

### Challenges Faced

- Implement both front-end client and back-end server simultaneously. When creating `socket.emit()`, I need to create a corresponding `socket.on()`.
- Learning the usage of Socket.io in a week. In my view, the course provides too little introduction to Node.js and Socket.io.
- Implement page layout and responsive design. I spend more time on design the style of the pages than completing the content of the pages.

### Lessons Learned

- **More HTML elemnts** like `<svg>`, `<footer>`.
- **Advanced CSS** like 'transition' and 'transform' which can implement the smooth change of a block in page.
- **Advanced JavaScript**.
- **Socket.io** is a very powerful tool to implement real-time communication among website users. It is simple to use, for example, `socket.on()` means listening for event and `socket.emit()` means sending message to other. However, the call back function is really hard to read.
- **Detecting and handling web application error** by using webpage inspector. I have encountered many situations where certain page elements or functions failed to display properly. By checking error messages and asking AI tools, I finally solved these problems.
- **Using GitHub and git to manage the project**. This is my first time using GitHub and git to manage the complete project, I used command line instructions like `git add .`, `git commit` and `git push` to upload my work to remote repository. It is very convenient that I can run `git clone` on the terminal in Codio to move my project from remote repository to Codio environment.
- **Keep calm when facing errors, and stay patient while solving problems**. To be honest, I have faced many runtime errors and knowledge gaps. The only way to solve is staying calm and patient to search for methods.

## 4. References

- [Runoob, a programming tutorial website](www.runoob.com): Used for learning basic knowledge of HTML, CSS and JavaScript.
- [MDN Web Docs on WebSocket and real-time communication](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API): Used for learning basic methods of Socket.io.
- The courseware of JC2503

## 5. Acknowledgements

I thank the **OpenAI GPT models** for helping me detect runtime and code errors, especially when developing the communication and scoring logic. The icon of GitHub in Introduction Page is generated by GPT. And thanks to **W3C** for providing tools to validate HTML and CSS files. 