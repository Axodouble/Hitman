// @ts-check

/**
 * @param {string} screenId
 */
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  const screenElement = document.getElementById(screenId);
  if (screenElement) {
    screenElement.classList.add("active");
  }
}


/**
 * @param {string | number | boolean} url
 */
function generateQRCode(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
}
