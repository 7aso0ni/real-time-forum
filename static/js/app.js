import { registerPage, loginPage, mainPage, messagePage } from "./pages.js";

// render last page before page refresh
document.addEventListener("DOMContentLoaded", () => {
  // get last page rendered from the localStorage
  const currentPage = window.localStorage.getItem("currentPage");

  switch (currentPage) {
    case "register":
      registerPage();
      break;
    case "login":
      loginPage();
      break;
    case "main":
      mainPage();
      break;
    case "chat":
      messagePage();
      break;
    default:
      loginPage();
      break;
  }
});
