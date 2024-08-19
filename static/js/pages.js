import {
  registerUser,
  loginUser,
  logoutUser,
  checkIfUserLoggedIn,
} from "./auth.js";
import { createPost, fetchPosts } from "./post.js";
import { navigateTo } from "./history.js";
import {
  getAllUsers,
  connectWebSocket,
  sendMessage,
  getUserMessages,
  getUserDetails,
  connectUserUpdateWebSocket,
  getLastMessage,
} from "./chat.js";

import { debounce, cleanupPage } from "./utils.js";

export function registerPage() {
  document.body.innerHTML = "";

  document.body.innerHTML = `
      <div class="form">
        <div class="login-page">
        <div class="error-message">
          <div class="error-text"></div>
          <div class="close-btn">&times;</div>
        </div>

          <form class="register-form" method="POST">
            <h2>Register</h2>
            <div class="name">
              <input type="text" id="first-name" placeholder="First Name *" required />
              <input type="text" id="last-name" placeholder="Last Name *" required />
            </div>
            <input type="number" id="age" placeholder="Age *" min="1" required />
            <select class="gender" id="gender">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <input type="text" id="username" placeholder="Username *" required />
            <input type="email" id="email" placeholder="Email *" required />
            <input type="password" id="password" placeholder="Password *" required />
            <a class="btn">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              Create
            </a>
            <span class="message">Already registered? <a class="signin-button">Sign In</a></span>
          </form>
        </div>
      </div>
    `;

  const userUpdateWs = connectUserUpdateWebSocket();

  document.querySelector(".signin-button").addEventListener("click", () => {
    navigateTo(loginPage);
  });

  document.querySelector(".btn").addEventListener("click", async (e) => {
    e.preventDefault();

    if (await registerUser()) {
      const currentUser = document.querySelector("#username");
      userUpdateWs.send(
        JSON.stringify({ type: "register", sender: currentUser })
      );
      navigateTo(mainPage);
    }
  });

  window.localStorage.setItem("currentPage", "register");
}

export function loginPage() {
  document.body.innerHTML = "";

  document.body.innerHTML = `
        <div class="login-box">
        <div class="error-message">
          <div class="error-text"></div>
          <div class="close-btn">&times;</div>
        </div>
          <h2>Login</h2>
          <form id="login-form">
            <div class="user-box">
              <input id="identifier" type="text" name="" required>
              <label>Username</label>
            </div>
            <div class="user-box">
              <input id="password" type="password" name="" required>
              <label>Password</label>
            </div>
            <a class="submit-link">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              Login
            </a>
            <span class="register-container">
              Don't have an account? register <a class="register-link">here</a>
            </span>
          </form>
        </div>
  `;

  const userUpdateWs = connectUserUpdateWebSocket();

  document.querySelector(".register-link").addEventListener("click", () => {
    navigateTo(registerPage);
  });

  document
    .querySelector(".submit-link")
    .addEventListener("click", async (e) => {
      e.preventDefault();
      if (await loginUser()) {
        const currentUser = document.querySelector("#identifier").value;

        userUpdateWs.send(
          JSON.stringify({ type: "login", sender: currentUser })
        );
        navigateTo(mainPage);
      }
    });

  window.localStorage.setItem("currentPage", "login");
}

export async function mainPage() {
  const isLoggedIn = await checkIfUserLoggedIn();

  if (!isLoggedIn) {
    window.localStorage.setItem("currentPage", "login");
    window.location.reload();
  }

  document.body.innerHTML = "";
  document.body.innerHTML = `
        <div class="nav"></div>
        <div class="notification">
          <div class="sender-name"></div>
          <div class="message-content"></div>
        </div>

        <div class="main-content">
          <div class="forum-container">
            <form id="post-form">
              <h2>Create Post</h2>
              <input type="text" maxlength="100" name="category" placeholder="Category" required />
              <textarea name="content" placeholder="Content" required></textarea>
              <button type="submit" class="main-button">Post</button>
            </form>

            <h2>Posts</h2>

            <div id="posts">
            <!-- Posts will be dynamically loaded here -->
            </div>
          </div>
            <div class="user-list"></div>
        </div>
  `;

  const currentUser = localStorage.getItem("username");

  const userUpdateWs = connectUserUpdateWebSocket();

  window.sortAndRender = async function sortAndRender() {
    const users = await getAllUsers();
    const userList = document.querySelector(".user-list");
    userList.innerHTML = "";

    const userDetails = await Promise.all(
      users.map(async (user) => {
        const details = await getUserDetails(user);
        const lastMessage = await getLastMessage(user);

        return {
          username: user,
          status: details.status,
          lastLogin: details.last_login,
          state: lastMessage ? lastMessage["is_read"] : null,
          lastMessageTime: lastMessage
            ? new Date(lastMessage["created_at"])
            : null,
        };
      })
    );

    userDetails.sort((a, b) => {
      // If both users have the same online status, sort by lastMessageTime (most recent first)
      if (a.lastMessageTime && b.lastMessageTime) {
        return b.lastMessageTime - a.lastMessageTime;
      }

      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;

      // sort by username alphabetically
      if (a.username.toLowerCase() < b.username.toLowerCase()) return -1;
      if (a.username.toLowerCase() > b.username.toLowerCase()) return 1;

      // Otherwise, maintain their original order
      return 0;
    });

    userList.innerHTML = "";

    userDetails.forEach(async (user) => {
      // const details = await getUserDetails(user);
      const userContainer = document.createElement("div");
      userContainer.className = "user-container";
      userContainer.setAttribute("data-username", user["username"]);

      const usernameContainer = document.createElement("div");
      usernameContainer.className = "username";

      const statusContainer = document.createElement("div");
      statusContainer.className = "status";

      usernameContainer.textContent = user["username"];
      statusContainer.textContent = user["status"];

      userContainer.append(usernameContainer, statusContainer);

      if (user.state === "UNREAD") {
        const messageCircle = document.createElement("div");
        messageCircle.className = "message-circle";
        usernameContainer.appendChild(messageCircle);
      }

      userList.appendChild(userContainer);
    });
  };

  if (isLoggedIn) {
    document.querySelector(".nav").innerHTML = `
    <button id="logout-button" disabled>Logout</button>
    <button id="chat" disabled>Chat</div>
    `;

    document
      .querySelector("#logout-button")
      .addEventListener("click", async () => {
        if (await logoutUser()) {
          userUpdateWs.send(
            JSON.stringify({ type: "logout", sender: currentUser })
          );
          cleanupPage(userUpdateWs, null);
          navigateTo(loginPage);
        }
      });

    document.querySelector("#chat").addEventListener(
      "click",
      debounce(() => {
        cleanupPage(userUpdateWs, null);
        navigateTo(messagePage);
      }, 100)
    );
  } else {
    document.querySelector(
      ".nav"
    ).innerHTML = `<button id="login-button">Login</button>`;

    document.querySelector("#login-button").addEventListener("click", () => {
      navigateTo(loginPage);
    });
  }

  fetchPosts();

  document.querySelector("#post-form").addEventListener("submit", (e) => {
    e.preventDefault();
    createPost();
  });

  await window.sortAndRender();
  document.getElementById("logout-button").disabled = false;
  document.getElementById("chat").disabled = false;

  // when the user refreshes re-connect the websocket connection
  userUpdateWs.send(JSON.stringify({ type: "init", sender: currentUser }));

  window.localStorage.setItem("currentPage", "main");
}

export async function messagePage() {
  const userStatus = await checkIfUserLoggedIn();

  if (!userStatus) {
    window.localStorage.setItem("currentPage", "login");
    window.location.reload();
  }

  document.body.innerHTML = `
  <div class="nav"></div>
  <div class="notification">
    <div class="sender-name"></div>
    <div class="message-content"></div>
  </div>

  <div class="background">
    <div class="main-container">
      <div class="all-users" id="all-users"></div>
      <div class="selected-user" id="selected-users">
          <div class="user-about">
              <img src="../profile.png"/>
              <div class="user-info">
                  <div class="selected-username"></div>
                  <div class="last-login"></div>
              </div>
          </div>
          <div class="messages" id="messages"></div>
          <form class="message-section" id="message-section">
            <input type="text" class="message-input" id="message-input"/>
            <button class="main-button" type="submit">Submit</button>
          </form>
      </div>
    </div>
  </div>
  `;

  const currentUser = localStorage.getItem("username");
  const userUpdateWs = connectUserUpdateWebSocket();
  const connect = connectWebSocket();

  if (userStatus) {
    document.querySelector(".nav").innerHTML = `
      <button id="logout-button">Logout</button>
      <button id="home">Home</div>
      `;

    document.querySelector("#logout-button").addEventListener(
      "click",
      debounce(async () => {
        if (await logoutUser()) {
          userUpdateWs.send(
            JSON.stringify({ type: "logout", sender: currentUser })
          );

          // cleanupPage(userUpdateWs, connect);
          navigateTo(loginPage);
        }
      }, 100)
    );

    document.querySelector("#home").addEventListener(
      "click",
      debounce(() => {
        userUpdateWs.send(
          JSON.stringify({ type: "login", sender: currentUser })
        );
        connect.send(JSON.stringify({ type: "init", sender: currentUser }));
        // cleanupPage(userUpdateWs, connect);
        navigateTo(mainPage);
      }, 100)
    );
  }

  const messagesDiv = document.querySelector(".messages");
  const usersContainer = document.querySelector(".all-users");
  const data = {};
  const increment = 10;
  let isUserClicked = false;
  let allMessages = [];
  let currentIndex = 0;
  let loadingMore = false;
  let activeChatUser = null;

  // hide the message form when the user is not clicked
  document.querySelector(".message-section").style.display = "none";

  async function initializeUsers() {
    usersContainer.innerHTML = "";
    const allUsers = await getAllUsers();

    const userDetails = await Promise.all(
      allUsers.map(async (user) => {
        const details = await getUserDetails(user);
        const lastMessage = await getLastMessage(user);

        return {
          username: user,
          receiver: lastMessage ? lastMessage["receiver"] : null,
          status: details.status,
          lastLogin: details.last_login,
          state: lastMessage ? lastMessage["is_read"] : null,
          lastMessageTime: lastMessage
            ? new Date(lastMessage["created_at"])
            : null,
        };
      })
    );

    userDetails.sort((a, b) => {
      // If both users have the same online status, sort by lastMessageTime (most recent first)
      if (a.lastMessageTime && b.lastMessageTime) {
        return b.lastMessageTime - a.lastMessageTime;
      }

      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;

      // sort by username alphabetically
      if (a.username.toLowerCase() < b.username.toLowerCase()) return -1;
      if (a.username.toLowerCase() > b.username.toLowerCase()) return 1;

      // Otherwise, maintain their original order
      return 0;
    });


    // Clear and re-render the users list
    usersContainer.innerHTML = "";

    // Re-render the users list
    userDetails.forEach((user) => {
      let messageCircle = null;
      const userContainer = document.createElement("div");
      userContainer.className = "user";
      userContainer.setAttribute("data-username", user["username"]);

      const nameContainer = document.createElement("div");
      nameContainer.className = "username";
      nameContainer.textContent = user["username"];

      const statusContainer = document.createElement("div");
      statusContainer.className = "status";
      statusContainer.textContent = user["status"];

      userContainer.appendChild(nameContainer);
      userContainer.appendChild(statusContainer);

      if (user.state === "UNREAD" && user.receiver === currentUser) {
        messageCircle = document.createElement("div");
        messageCircle.className = "message-circle";
        nameContainer.appendChild(messageCircle);
      }

      usersContainer.appendChild(userContainer);

      userContainer.addEventListener("click", async () => {
        currentIndex = 0;
        activeChatUser = user["username"];
        isUserClicked = true;
        // send that all of the messages are read
        userUpdateWs.send(
          JSON.stringify({
            type: "read",
            sender: currentUser,
            receiver: user.username,
          })
        );

        connect.send(
          JSON.stringify({
            type: "read",
            sender: currentUser,
            receiver: user.username,
          })
        );

        // remove the unread indicator if it exists
        if (messageCircle) {
          nameContainer.removeChild(messageCircle);
          messageCircle = null;
        }

        // re-display the message forms
        document.querySelector(".message-section").style.display = "flex";

        const selectedUsername = document.querySelector(".selected-username");
        const lastLoginContainer = document.querySelector(".last-login");

        selectedUsername.textContent = user["username"];

        if (user["status"] === "ONLINE" && userStatus) {
          lastLoginContainer.textContent = "Online";
        } else {
          const lastLoginToDate = new Date(user.lastLogin);
          lastLoginContainer.textContent = lastLoginToDate.toLocaleDateString();
        }

        data["receiver"] = user["username"];
        allMessages = await getUserMessages(user["username"]);

        if (allMessages === null) allMessages = [];
        allMessages.reverse();
        messagesDiv.innerHTML = "";

        renderMessages(true);
      });
    });
  }

  function renderMessages(scrollToBottom = false) {
    const endIndex = Math.min(currentIndex + increment, allMessages.length);
    const messagesToRender = allMessages.slice(currentIndex, endIndex);
    messagesToRender.reverse();

    messagesToRender.reverse().forEach((message) => {
      updateMessages(message, true);
    });

    currentIndex = endIndex;

    if (scrollToBottom) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  function updateMessages(message, prepend = false) {
    // don't display the sent/received message if the user didn't click on anyone
    if (!isUserClicked) return;

    // format the date to the desired formatting way
    const date = new Date(message.created_at);
    const formatDate = `${date.getDate()}/${date.getMonth() + 1}`;

    const messageContainer = document.createElement("div");

    // create the div that will contain the text of the message
    const currentMessage = document.createElement("div");
    currentMessage.className = "message-content";
    currentMessage.textContent = message.content;

    // div that will contain the timestamp of the message
    const messageTimeStamp = document.createElement("div");
    messageTimeStamp.className = "timestamp";
    messageTimeStamp.textContent = formatDate;

    messageContainer.appendChild(currentMessage);
    messageContainer.appendChild(messageTimeStamp);

    // check if the sender is the current user or another user and have an appropriate classname
    message.sender === localStorage.getItem("username")
      ? (messageContainer.className = "message-author")
      : (messageContainer.className = "message-receiver");

    if (prepend) {
      messagesDiv.prepend(messageContainer);
    } else {
      messagesDiv.appendChild(messageContainer);
    }
  }

  window.handleWebSocketMessage = async (message) => {
    const username = message["username"];
    const status = message["status"];

    // re-sort the list of users when a message is sent
    await initializeUsers();

    // Select the specific user div based on the data-username attribute
    const userContainer = document.querySelector(
      `.user[data-username="${username}"]`
    );

    if (userContainer) {
      // Find the status div within the selected user div
      const statusContainer = userContainer.querySelector(".status");

      if (statusContainer) {
        // Update the status text content
        statusContainer.textContent = status;
      }
    }

    if (
      (message.sender === activeChatUser && message.receiver === currentUser) ||
      (message.sender === currentUser && message.receiver === activeChatUser)
    ) {
      updateMessages(message);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    if (message.receiver === currentUser) {
      showNotification(message.sender, message.content);
    }
  };

  function showNotification(sender, messageContent) {
    const notif = document.querySelector(".notification");
    notif.style.display = "block";

    const senderName = document.querySelector(".sender-name");
    const content = document.querySelector(".message-content");

    senderName.textContent = sender;
    if (messageContent.length < 20)
      content.textContent = messageContent.slice(0, 20);
    // cut the message and display a portion of it in the notification
    else content.textContent = messageContent.slice(0, 20) + "...";

    setTimeout(() => {
      notif.style.display = "none";
      senderName.textContent = "";
      content.textContent = "";
    }, 3000);
  }

  messagesDiv.addEventListener("scroll", async () => {
    if (
      messagesDiv.scrollTop === 0 &&
      currentIndex < allMessages.length &&
      !loadingMore
    ) {
      loadingMore = true;
      const oldHeight = messagesDiv.scrollHeight;
      renderMessages();
      messagesDiv.scrollTop = messagesDiv.scrollHeight - oldHeight;
      loadingMore = false;
    }
  });

  document.querySelector(".message-section").addEventListener("submit", (e) => {
    e.preventDefault();
    const message = document.getElementById("message-input").value;
    data["sender"] = currentUser;
    data["content"] = message;

    const date = new Date();
    data["created_at"] = date;

    sendMessage(data);

    document.querySelector(".message-input").value = "";
  });

  await initializeUsers();

  document.getElementById("logout-button").disabled = false;
  document.getElementById("home").disabled = false;

  window.localStorage.setItem("currentPage", "chat");
}

window.registerPage = registerPage;
window.loginPage = loginPage;
window.mainPage = mainPage;
window.messagePage = messagePage;
