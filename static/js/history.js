// Helper function to navigate to a specific page and update the history stack
export function navigateTo(pageFunction) {
  if (typeof pageFunction !== "function") {
    console.error("pageFunction is not a valid function:", pageFunction);
    return;
  }
  pageFunction(); // Call the page rendering function
  history.pushState({ page: pageFunction.name }, null, ""); // Update the history stack
}

// Event handler for popstate event to manage browser navigation (back/forward)
export function handlePopState(event) {
  if (event.state && event.state.page) {
    const pageFunction = window[event.state.page];
    if (typeof pageFunction === "function") {
      pageFunction(); // Call the page function stored in the state
    }
  }
}

// Attach the popstate event handler to manage navigation
window.addEventListener("popstate", handlePopState);
