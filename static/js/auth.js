export async function registerUser() {
  const formData = {
    firstName: document.getElementById("first-name").value,
    lastName: document.getElementById("last-name").value,
    age: Number(document.getElementById("age").value),
    gender: document.getElementById("gender").value,
    nickname: document.getElementById("username").value,
    email: document.getElementById("email").value,
    password: document.getElementById("password").value,
  };

  const jsonData = JSON.stringify(formData);

  try {
    // validators
    if (!formData.firstName) throw new Error("First name can't be empty");
    if (!formData.lastName) throw new Error("Last name can't be empty");
    if (!formData.email) throw new Error("Email can't be empty");
    if (!formData.password) throw new Error("Password can't be empty");
    if (formData.age <= 0) throw new Error("Invalid age");
    // if (formData.gender !== "Male" || formData.gender !== "Female")
    //   throw new Error("You are gay");

    const response = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const body = await response.json();
    localStorage.setItem("username", body.username);

    return true;
  } catch (error) {
    const errorMessageContainer = document.querySelector(".error-message");
    errorMessageContainer.style.display = "flex";

    const errorMessageText = document.querySelector(".error-text");
    errorMessageText.textContent = error;

    document.querySelector(".close-btn").addEventListener("click", () => {
      errorMessageContainer.style.display = "none";
    });

    return false;
  }
}

export async function loginUser() {
  const identifier = document.querySelector("#identifier").value;
  const password = document.querySelector("#password").value;

  const jsonData = JSON.stringify({ identifier, password });

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonData,
      credentials: "include", // Ensure cookies are included in the request
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const body = await response.json();
    console.log(body);
    localStorage.setItem("username", body.username);
    return true;
  } catch (error) {
    const errorMessageContainer = document.querySelector(".error-message");
    errorMessageContainer.style.display = "flex";

    const errorMessageText = document.querySelector(".error-text");
    errorMessageText.textContent = error;

    document.querySelector(".close-btn").addEventListener("click", () => {
      errorMessageContainer.style.display = "none";
    });

    return false;
  }
}

export async function logoutUser() {
  try {
    const response = await fetch("/logout", {
      method: "POST",
      credentials: "include", // Ensure cookies are included in the request
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    localStorage.removeItem("username");
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

export async function checkIfUserLoggedIn() {
  try {
    const response = await fetch("/is_logged_in", {
      method: "GET",
      credentials: "include", // Ensure cookies are included in the request
    });

    const userContainer = document.getElementById(
      `user-${localStorage.getItem("username")}`
    );
    const statusContainer = userContainer
      ? userContainer.querySelector(".status")
      : null;

    if (response.status === 401) {
      if (statusContainer) {
        statusContainer.textContent = "OFFLINE";
      }
      return false;
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (statusContainer) {
      statusContainer.textContent = "ONLINE";
    }

    return true;
  } catch (error) {
    console.error("Check login status error:", error);
    return false;
  }
}
