export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function cleanupPage(userUpdateWs, ws) {
  if (userUpdateWs) {
    userUpdateWs.close();
    userUpdateWs = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  // Clear any other resources or event listeners
}
