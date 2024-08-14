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
  getLastMessage,
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

  const userUpdateWs = connectUserUpdateWebSocket();
  const currentUser = localStorage.getItem("username");

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
          lastMessageTime: lastMessage
            ? new Date(lastMessage["created_at"])
            : null,
        };
      })
    );

    userDetails.sort((a, b) => {
      // First, sort by online status
      if (a.status === "ONLINE" && b.status !== "ONLINE") return -1;
      if (a.status !== "ONLINE" && b.status === "ONLINE") return 1;

      // If both users have the same online status, sort by lastMessageTime (most recent first)
      if (a.lastMessageTime && b.lastMessageTime) {
        return b.lastMessageTime - a.lastMessageTime;
      }

      // If one has a lastMessageTime and the other doesn't, the one with a message goes first
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;

      // Otherwise, maintain their original order
      return 0;
    });

    console.log(userDetails);

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

      userList.appendChild(userContainer);
    });
  };

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

  sortAndRender();

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
  const connect = connectWebSocket();

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
          connect.send(JSON.stringify({ type: "init", sender: currentUser }));
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

  async function initializeUsers() {
    usersContainer.innerHTML = "";
    const allUsers = await getAllUsers();

    const userDetails = await Promise.all(
      allUsers.map(async (user) => {
        const details = await getUserDetails(user);
        const lastMessage = await getLastMessage(user);

        return {
          username: user,
          status: details.status,
          lastLogin: details.last_login,
          lastMessageTime: lastMessage
            ? new Date(lastMessage["created_at"])
            : null,
        };
      })
    );

    userDetails.sort((a, b) => {
      // First, sort by online status
      if (a.status === "ONLINE" && b.status !== "ONLINE") return -1;
      if (a.status !== "ONLINE" && b.status === "ONLINE") return 1;

      // If both users have the same online status, sort by lastMessageTime (most recent first)
      if (a.lastMessageTime && b.lastMessageTime) {
        return b.lastMessageTime - a.lastMessageTime;
      }

      // If one has a lastMessageTime and the other doesn't, the one with a message goes first
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;

      // Otherwise, maintain their original order
      return 0;
    });

    // Clear and re-render the users list
    usersContainer.innerHTML = "";

    // Re-render the users list
    userDetails.forEach((user) => {
      console.log(user);
      const userContainer = document.createElement("div");
      userContainer.className = "user";
      userContainer.setAttribute("data-username", user["username"]);

      const nameContainer = document.createElement("div");
      nameContainer.className = "user-name";
      nameContainer.textContent = user["username"];

      const statusContainer = document.createElement("div");
      statusContainer.className = "status";
      statusContainer.textContent = user["status"];

      userContainer.appendChild(nameContainer);
      userContainer.appendChild(statusContainer);

      usersContainer.appendChild(userContainer);

      userContainer.addEventListener("click", async () => {
        currentIndex = 0;
        activeChatUser = user["username"];

        const selectedUsername = document.querySelector(".selected-username");
        const lastLoginContainer = document.querySelector(".last-login");

        selectedUsername.textContent = user["username"];

        if (user["status"] === "ONLINE" && userStatus) {
          lastLoginContainer.textContent = "Online";
        } else {
          const lastLoginToDate = new Date(user.lastLogin);
          lastLoginContainer.textContent = lastLoginToDate.toLocaleDateString();
        }

        isUserClicked = true;
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
    const formatteDate = `${date.getDate()}/${date.getMonth() + 1}`;

    const messageContainer = document.createElement("div");

    // create the div that will contain the text of the message
    const currentMessage = document.createElement("div");
    currentMessage.className = "message-content";
    currentMessage.textContent = message.content;

    // div that will contain the timestamp of the message
    const messageTimeStamp = document.createElement("div");
    messageTimeStamp.className = "timestamp";
    messageTimeStamp.textContent = formatteDate;

    messageContainer.appendChild(currentMessage);
    messageContainer.appendChild(messageTimeStamp);

    // check if the sender is the current user or another user and have an appropirate classname
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
    // initializeUsers()
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
