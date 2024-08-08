let ws;
let userUpdateWs;

export async function getAllUsers() {
  try {
    const response = await fetch("/fetch_users");
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log(error);
  }
}

export async function getUserDetails(username) {
  ws = new WebSocket('ws://localhost:8080/fetch_user_data');
  ws.onopen = function () {
    ws.send(JSON.stringify({ username: username }));
  };

  ws.onmessage = function (event) {
    const userDetails = JSON.parse(event.data);
    console.log(userDetails);
    // Update UI with user details
    window.handleUserDetails(userDetails);
  };

  ws.onclose = function (error) {
    console.log("WebSocket connection closed" + error);
  };
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

export function connectWebSocket() {
  const username = localStorage.getItem("username");
  ws = new WebSocket(`ws://localhost:8080/chat`);

  ws.onopen = function () {
    ws.send(JSON.stringify({ type: "init", sender: username }));
  };

  ws.onmessage = function (event) {
    const msg = JSON.parse(event.data);
    if (msg.error !== undefined) {
      console.error(msg.error);
    } else {
      console.log(msg);
      window.handleWebSocketMessage(msg);
    }
  };

  ws.onclose = function (error) {
    console.log("WebSocket connection closed" + error);
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
  console.log("hello")
  userUpdateWs = new WebSocket('ws://localhost:8080/ws');

  userUpdateWs.onopen = function () {
    console.log("Connected to user update WebSocket");
  };

  userUpdateWs.onmessage = function (event) {
    const update = JSON.parse(event.data);
    console.log("User update received:", update);
    window.handleUserUpdate(update);
  };

  userUpdateWs.onclose = function (error) {
    console.log("User update WebSocket connection closed" + error);
  };

  return userUpdateWs;
}
