// Welcome card — shown until the user clicks (or until auto-restart fires
// because mic permission is already granted).

const startElNullable = document.getElementById("start");
if (!startElNullable) throw new Error("#start element not found");
const startEl: HTMLElement = startElNullable;

export function hideWelcomeCard(): void {
  startEl.classList.add("hidden");
  setTimeout(() => {
    if (startEl.parentNode) startEl.remove();
  }, 800);
}

export function onUserGesture(handler: () => void): void {
  startEl.addEventListener("click", handler);
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") handler();
    },
    { once: true },
  );
}
