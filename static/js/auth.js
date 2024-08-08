export async function registerUser() {
  const formData = new FormData(document.getElementById("register-form"));
  const data = {};
  formData.forEach((value, key) => {
    if (key === "age") data[key] = parseInt(value, 10);
    // if the field is age convert the value to a number
    else data[key] = value;
  });

  const jsonData = JSON.stringify(data);

  try {
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
    console.error("Registration error:", error);
    return false;
  }
}

export async function loginUser() {
  const formData = new FormData(document.querySelector("#login-form"));
  const data = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });

  const jsonData = JSON.stringify(data);

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
    localStorage.setItem("username", body.username);
    return true;
  } catch (error) {
    console.error("Login error:", error);
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

    if (response.status === 401) {
      return false;
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return true;
  } catch (error) {
    console.error("Check login status error:", error);
    return false;
  }
}
