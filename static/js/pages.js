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
} from "./chat.js";

const currentUser = localStorage.getItem("username");

export function registerPage() {
  // Clear all content from the body
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

  // render login page
  document.querySelector(".login-button").addEventListener("click", () => {
    navigateTo(loginPage);
  });

  document
    .querySelector("#register-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      // if no errors were found
      if (await registerUser()) {
        navigateTo(mainPage);
      }
    });

  // setting current page on local storage to make the page persist across page refresh
  window.localStorage.setItem("currentPage", "register");
}

export function loginPage() {
  document.body.innerHTML = "";

  document.body.innerHTML = `
        <div class="login-content">
          <form id="login-form">
          <h2>Login</h2>
          <input
            type="text"
            name="identifier"
            placeholder="Nickname or Email"
            required
          />
          <input
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

  // render register page
  document.querySelector(".register-button").addEventListener("click", () => {
    navigateTo(registerPage);
  });

  document
    .querySelector("#login-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await loginUser()) {
        navigateTo(mainPage);
      }
    });

  window.localStorage.setItem("currentPage", "login");
}

export async function mainPage() {
  document.body.innerHTML = "";
  document.body.innerHTML = `
        <div id="main-content">
          <div class="nav"></div>
          <form id="post-form">
            <h2>Create Post</h2>
            <input type="text" name="category" placeholder="Category" required />
            <textarea name="content" placeholder="Content" required></textarea>
            <button type="submit">Post</button>
          </form>

          <h2>Posts</h2>

          <div id="posts">
            <!-- Posts will be dynamically loaded here -->
          </div>
      </div>
  `;

  const isLoggedIn = await checkIfUserLoggedIn();

  if (isLoggedIn) {
    document.querySelector(".nav").innerHTML = `
    <button id="logout-button">Logout</button>
    <button id="chat">Chat</div>
    `;

    document.querySelector("#logout-button").addEventListener("click", () => {
      // logout the user
      logoutUser();

      // after logging out render login page (temporary)
      navigateTo(loginPage);
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
  document.body.innerHTML = `
    <div class="main-content">
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
            <button type="submit">Submit</button>
          </form>
      </div>
    </div>
  `;

  const messagesDiv = document.querySelector(".messages");
  const userContainer = document.querySelector(".all-users");
  const data = {};
  let isUserClicked = false;

  async function initializeUsers() {
    // get all the users from the backend
    const users = await getAllUsers();

    // remove the current username from the array
    const index = users.indexOf(currentUser);

    if (index > -1) users.splice(index, 1);
    users.forEach((user) => {
      const div = document.createElement("div");
      if (currentUser !== user) {
        div.className = "user";
        div.textContent = user;
        userContainer.appendChild(div);
      }

      // display the user and get the messages of that user
      div.addEventListener("click", async () => {
        const selectedUsername = document.querySelector(".selected-username");
        const lastLoginContainer = document.querySelector(".last-login");
        const userDetails = await getUserDetails(user);

        selectedUsername.textContent = userDetails["username"];

        // check if user online or offline
        if (userDetails["status"] === "ONLINE") {
          lastLoginContainer.textContent = "Online";
        } else {
          // convert the passed date into a javascript date
          const lastLoginToDate = new Date(userDetails["last_login"]);
          // format it into the current system date
          lastLoginContainer.textContent = lastLoginToDate.toLocaleDateString();
        }

        isUserClicked = true;
        data["receiver"] = user;
        // get the user messages
        const messages = await getUserMessages(user);
        messagesDiv.innerHTML = "";

        // if the array is empty exit
        if (messages.length === 0 || messages == null) return;

        messages.forEach((message) => {
          updateMessages(message);
        });
      });
    });
  }

  function updateMessages(message) {
    if (!isUserClicked) return;
    const messageContainer = document.createElement("div");

    const currentMessage = document.createElement("div");
    currentMessage.className = "message-content";
    currentMessage.textContent = message.content;

    messageContainer.appendChild(currentMessage);

    message.sender === localStorage.getItem("username")
      ? (messageContainer.className = "message-author")
      : (messageContainer.className = "message-receiver");

    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // WebSocket message handler
  window.handleWebSocketMessage = (message) => {
    updateMessages(message);
  };

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

// making the functions globally accessible to navigate forward and backwards
window.registerPage = registerPage;
window.loginPage = loginPage;
window.mainPage = mainPage;
window.messagePage = messagePage;
