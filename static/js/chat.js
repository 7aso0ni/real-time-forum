let ws;

// import { sortAndRender } from "./pages.js";

export async function getAllUsers() {
  const username = localStorage.getItem("username");

  try {
    const response = await fetch("/fetch_users", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();

    // Filter out the current user
    // const filteredUsers = data.filter((user) => user.username !== username);

    return data;
  } catch (error) {
    console.log(error);
  }
}

export async function getUserDetails(username) {
  try {
    const response = await fetch(`/fetch_user_data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: username }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const userDetails = await response.json();
    return userDetails;
  } catch (error) {
    throw new Error(`Failed to fetch user details: ${error.message}`);
  }
}

export async function getUserMessages(user) {
  try {
    const response = await fetch("/get_messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: localStorage.getItem("username"),
        receiver: user,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error(error);
  }
}

export async function getLastMessage(username) {
  try {
    const response = await fetch("/last_message", {
      method: "POST",
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      const error = await response.text();
      // ignore this message
      if (error === "No messages found") return null;

      throw new Error(`${error} for ${username}`);
    }

    return await response.json();
  } catch (error) {
    console.error(error);
  }
}

export function connectWebSocket() {
  // // close the previous connection before opening a new one
  // if (ws && ws.readyState === WebSocket.OPEN) ws.close();

  const username = localStorage.getItem("username");
  if (!username) {
    console.error("Username not found");
    return;
  }

  ws = new WebSocket(`ws://localhost:8080/chat`);

  ws.onopen = function () {
    console.log("WebSocket connection opened");
    ws.send(JSON.stringify({ type: "init", sender: username }));
  };

  ws.onerror = function (error) {
    console.error("WebSocket error:", error);
  };

  ws.onmessage = function (event) {
    const msg = JSON.parse(event.data);

    if (msg.error !== undefined) {
      if (msg.error.includes("sql: no rows in result set")) {
        console.warn("No data found for the query.");
      } else {
        console.error("WebSocket message error:", msg.error);
      }
    } else {
      window.handleWebSocketMessage(msg);
    }
  };

  ws.onclose = function (event) {
    console.log("WebSocket connection closed:", event);
  };

  return ws;
}

export function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    // console.log(message);
    return;
  }

  console.error(
    "WebSocket is not open. Ready state is:",
    ws ? ws.readyState : "undefined"
  );
}

export function connectUserUpdateWebSocket() {
  // if (userUpdateWs && userUpdateWs.readyState === WebSocket.OPEN)
  //   userUpdateWs.close();

  const userUpdateWs = new WebSocket("ws://localhost:8080/ws");

  userUpdateWs.onopen = function () {
    console.log("websocket connected");
  };

  userUpdateWs.onmessage = async (event) => {
    const update = JSON.parse(event.data);
    const currentUser = localStorage.getItem("username");
    console.log("User update received:", update);

    // if it's a message and not an update on a user status
    if (update.content) {
      console.log(update);
      if (update.receiver === currentUser)
        showNotification(update.sender, update.content);
    }
    window.sortAndRender();
    // updateUserStatusInDOM(update);
  };

  userUpdateWs.onclose = function () {
    console.log("User update WebSocket connection closed");
  };

  userUpdateWs.onerror = function (error) {
    console.error("WebSocket error:", error);
  };

  return userUpdateWs;
}

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
