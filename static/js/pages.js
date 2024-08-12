import {
  registerUser,
  loginUser,
  logoutUser,
  checkIfUserLoggedIn,
} from "./auth.js";
import {
  createPost,
  displayComments,
  fetchComments,
  fetchPosts,
} from "./post.js";
import { navigateTo } from "./history.js";
import {
  getAllUsers,
  connectWebSocket,
  sendMessage,
  getUserMessages,
  getUserDetails,
  connectUserUpdateWebSocket,
} from "./chat.js";

export function registerPage() {
  document.body.innerHTML = "";

  document.body.innerHTML = `
        <div class="register-content">
            <form id="register-form">
                <h2>Register</h2>
                <input type="text" name="nickname" placeholder="Nickname" required />
                <input type="number" name="age" placeholder="Age" required />
                <input type="text" name="gender" placeholder="Gender" required />
                <input type="text" name="first_name" placeholder="First Name" required />
                <input type="text" name="last_name" placeholder="Last Name" required />
                <input type="email" name="email" placeholder="Email" required />
                <input type="password" name="password" placeholder="Password" required />
                <button type="submit">Register</button>
            </form>

            <button class="login-button">Go to login</button>
        </div>
    `;

  document.querySelector(".login-button").addEventListener("click", () => {
    navigateTo(loginPage);
  });

  document
    .querySelector("#register-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      if (await registerUser()) {
        navigateTo(mainPage);
      }
    });

  window.localStorage.setItem("currentPage", "register");
}

export function loginPage() {
  document.body.innerHTML = "";

  document.body.innerHTML = `
        <div class="login-content">
          <form id="login-form">
          <h2>Login</h2>
          <input
            id="identifier"
            type="text"
            name="identifier"
            placeholder="Nickname or Email"
            required
          />
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Password"
            required
          />
          <button type="submit">Login</button>
        </form>

        <button class="register-button">Go to register</button>
      </div>
  `;

  const userUpdateWs = connectUserUpdateWebSocket();

  document.querySelector(".register-button").addEventListener("click", () => {
    navigateTo(registerPage);
  });

  document
    .querySelector("#login-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await loginUser()) {
        const currentUser = localStorage.getItem("username");

        console.log(currentUser);
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
  
        <div class="main-content">
          <div class="forum-container">
            <form id="post-form">
              <h2>Create Post</h2>
              <input type="text" name="category" placeholder="Category" required />
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

  const users = await getAllUsers();
  const userList = document.querySelector(".user-list");
  const userUpdateWs = connectUserUpdateWebSocket();
  const currentUser = localStorage.getItem("username");

  users.forEach(async (user) => {
    if (user === currentUser) {
      return;
    }
    const details = await getUserDetails(user);
    const userContainer = document.createElement("div");
    userContainer.className = "user-container";
    userContainer.setAttribute("data-username", details["username"]);

    const usernameContainer = document.createElement("div");
    usernameContainer.className = "username";
    const statusContainer = document.createElement("div");
    statusContainer.className = "status";

    usernameContainer.textContent = details["username"];
    statusContainer.textContent = details["status"];

    userContainer.append(usernameContainer, statusContainer);

    userList.appendChild(userContainer);
  });

  if (isLoggedIn) {
    document.querySelector(".nav").innerHTML = `
    <button id="logout-button">Logout</button>
    <button id="chat">Chat</div>
    `;

    document
      .querySelector("#logout-button")
      .addEventListener("click", async () => {
        if (await logoutUser()) {
          userUpdateWs.send(
            JSON.stringify({ type: "logout", sender: currentUser })
          );
          navigateTo(loginPage);
        }
      });

    document.querySelector("#chat").addEventListener("click", () => {
      navigateTo(messagePage);
    });
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
  `;

  const currentUser = localStorage.getItem("username");
  const userUpdateWs = connectUserUpdateWebSocket();
  const connect = connectWebSocket()

  if (userStatus) {
    document.querySelector(".nav").innerHTML = `
      <button id="logout-button">Logout</button>
      <button id="chat">Home</div>
      `;

    document
      .querySelector("#logout-button")
      .addEventListener("click", async () => {
        if (await logoutUser()) {
          userUpdateWs.send(
            JSON.stringify({ type: "logout", sender: currentUser })
          );
          connect.send(JSON.stringify({ type: "init", sender: currentUser }))
          navigateTo(loginPage);
        }
      });

    document.querySelector("#chat").addEventListener("click", () => {
      navigateTo(mainPage);
    });
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
  const users = await getAllUsers();

  async function initializeUsers() {

    const index = users.indexOf(currentUser);

    if (index > -1) users.splice(index, 1);
    users.forEach(async (user) => {
      const userContainer = document.createElement("div");
      const nameContainer = document.createElement("div");
      const statusContainer = document.createElement("div");

      const userDetails = await getUserDetails(user);

      if (currentUser !== user) {
        userContainer.className = "user";
        userContainer.setAttribute("data-username", userDetails["username"]);

        nameContainer.className = "user-name";
        statusContainer.className = "status";
        nameContainer.textContent = user;
        statusContainer.textContent = userDetails["status"];
        userContainer.appendChild(nameContainer);
        userContainer.appendChild(statusContainer);

        usersContainer.appendChild(userContainer);
      }

      userContainer.addEventListener("click", async () => {
        currentIndex = 0;
        activeChatUser = user;

        const selectedUsername = document.querySelector(".selected-username");
        const lastLoginContainer = document.querySelector(".last-login");

        selectedUsername.textContent = userDetails["username"];

        if (userDetails["status"] === "ONLINE" && userStatus) {
          lastLoginContainer.textContent = "Online";
        } else {
          const lastLoginToDate = new Date(userDetails["last_login"]);
          lastLoginContainer.textContent = lastLoginToDate.toLocaleDateString();
        }

        isUserClicked = true;
        data["receiver"] = user;
        allMessages = await getUserMessages(user);

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
    if (!isUserClicked) return;
    const messageContainer = document.createElement("div");

    const currentMessage = document.createElement("div");
    currentMessage.className = "message-content";
    currentMessage.textContent = message.content;

    messageContainer.appendChild(currentMessage);

    message.sender === localStorage.getItem("username")
      ? (messageContainer.className = "message-author")
      : (messageContainer.className = "message-receiver");

    if (prepend) {
      messagesDiv.prepend(messageContainer);
    } else {
      messagesDiv.appendChild(messageContainer);
    }
  }

  window.handleWebSocketMessage = (message) => {
    const username = message['username'];
    const status = message['status'];

    // Select the specific user div based on the data-username attribute
    const userContainer = document.querySelector(`.user[data-username="${username}"]`);

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
  };

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
  connectWebSocket();

  window.localStorage.setItem("currentPage", "chat");
}

window.registerPage = registerPage;
window.loginPage = loginPage;
window.mainPage = mainPage;
window.messagePage = messagePage;
