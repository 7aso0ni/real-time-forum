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
  const userStatus = await checkIfUserLoggedIn();

  // check if the user logged in and if not redirect
  if (!userStatus) {
    window.localStorage.setItem("currentPage", "login");
    window.location.reload();
  }

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
  const usersContainer = document.querySelector(".all-users");
  const data = {};
  const increment = 20;
  let isUserClicked = false;
  let allMessages = [];
  let currentIndex = 0;
  let loadingMore = false;
  let activeChatUser = null;

  async function initializeUsers() {
    // get all the users from the backend
    const users = await getAllUsers();

    // remove the current username from the array
    const index = users.indexOf(currentUser);

    if (index > -1) users.splice(index, 1);
    users.forEach(async (user) => {
      const userContainer = document.createElement("div");
      const nameContainer = document.createElement("div");
      const statusContainer = document.createElement("div");

      // get all relevant details of the user
      const userDetails = await getUserDetails(user);

      if (currentUser !== user) {
        userContainer.className = "user";

        nameContainer.className = "user-name";
        statusContainer.className = "status";
        nameContainer.textContent = user;
        statusContainer.textContent = userDetails["status"];
        userContainer.appendChild(nameContainer);
        userContainer.appendChild(statusContainer);

        usersContainer.appendChild(userContainer);
      }

      // display the user and get the messages of that user
      userContainer.addEventListener("click", async () => {
        // reset the index if the user is clicked again
        currentIndex = 0;
        activeChatUser = user;

        const selectedUsername = document.querySelector(".selected-username");
        const lastLoginContainer = document.querySelector(".last-login");

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
        allMessages = await getUserMessages(user);

        // if there are no previous chat set the array to empty instead of null
        if (allMessages === null) allMessages = [];
        allMessages.reverse();
        messagesDiv.innerHTML = "";

        // Render initial set of messages
        renderMessages(true); // Pass true to scroll to the bottom
      });
    });
  }

  function renderMessages(scrollToBottom = false) {
    const endIndex = Math.min(currentIndex + increment, allMessages.length);
    const messagesToRender = allMessages.slice(currentIndex, endIndex);
    messagesToRender.reverse();

    // Prepend messages in reverse order
    messagesToRender.reverse().forEach((message) => {
      updateMessages(message, true);
    });

    currentIndex = endIndex;

    if (scrollToBottom) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  function updateMessages(message, prepend = false) {
    // if the user did not click on any user don't display
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

  // WebSocket message handler
  window.handleWebSocketMessage = (message) => {
    // Check if the message is for the currently active chat
    if (
      (message.sender === activeChatUser && message.receiver === currentUser) ||
      (message.sender === currentUser && message.receiver === activeChatUser)
    ) {
      updateMessages(message);
      messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to the bottom on new message
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
      // Maintain scroll position
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

    // clear the input after sending the message
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
