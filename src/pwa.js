import { registerSW } from "virtual:pwa-register";

function showPwaStatus(message, action = null) {
  const status = document.querySelector("#persistentStatus");
  if (!status) return;

  status.replaceChildren();
  status.hidden = !message;
  if (!message) return;

  const text = document.createElement("span");
  text.textContent = message;
  status.append(text);

  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button compact";
    button.textContent = action.label;
    button.addEventListener("click", action.run, { once: true });
    status.append(button);
  }
}

export function setupPwa() {
  if (!("serviceWorker" in navigator)) return;

  let updateServiceWorker = () => Promise.resolve();
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      showPwaStatus("A Liftwise update is ready. Save any open workout, then update.", {
        label: "Update now",
        run: () => updateServiceWorker(true),
      });
    },
    onOfflineReady() {
      showPwaStatus("Liftwise is ready to work offline.");
    },
    onRegisterError(error) {
      console.warn("Offline support could not be registered", error);
    },
  });
}
