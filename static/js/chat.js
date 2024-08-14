let ws;
// let userUpdateWs;
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
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://localhost:8080/fetch_user_data");
    ws.onopen = function () {
      ws.send(JSON.stringify({ username: username }));
    };

    ws.onmessage = function (event) {
      const userDetails = JSON.parse(event.data);
      resolve(userDetails);
    };

    ws.onerror = function (error) {
      reject(error);
    };

    ws.onclose = function () {
      console.log("WebSocket connection closed");
    };
  });
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
      console.log("WebSocket message received:", msg);
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
    console.log(message);
    return;
  }

  console.error(
    "WebSocket is not open. Ready state is:",
    ws ? ws.readyState : "undefined"
  );
}

export function connectUserUpdateWebSocket() {
  const userUpdateWs = new WebSocket("ws://localhost:8080/ws");

  userUpdateWs.onopen = function () {
    console.log("websocket connected");
  };

  userUpdateWs.onmessage = async (event) => {
    const update = JSON.parse(event.data);
    console.log("User update received:", update);
    window.sortAndRender();
    updateUserStatusInDOM(update);
  };

  userUpdateWs.onclose = function () {
    console.log("User update WebSocket connection closed");
  };

  userUpdateWs.onerror = function (error) {
    console.error("WebSocket error:", error);
  };

  return userUpdateWs;
}

function updateUserStatusInDOM(update) {
  const { username, status } = update;

  const container =
    document.querySelector(`.user-container[data-username="${username}"]`) ||
    document.querySelector(`.user[data-username="${username}"]`);

  if (container) {
    // Update the status in the DOM
    const statusContainer = container.querySelector(".status");
    statusContainer.textContent = status;
  } else {
    // Optionally, handle cases where the user is not found in the DOM
    console.warn(`User container for ${username} not found`);
  }
}
