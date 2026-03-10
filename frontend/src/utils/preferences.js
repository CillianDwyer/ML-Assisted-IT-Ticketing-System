export const PREFERENCE_KEYS = {
  theme: "theme",
  motion: "motionPreference",
  startPage: "startPagePreference",
};

export function getPreference(key, fallback) {
  const value = localStorage.getItem(key);
  return value ?? fallback;
}

function broadcastPreferenceChange(key, value) {
  window.dispatchEvent(
    new CustomEvent("app:preferences-changed", {
      detail: { key, value },
    })
  );
}

export function setThemePreference(theme, { broadcast = true } = {}) {
  localStorage.setItem(PREFERENCE_KEYS.theme, theme);
  document.body.classList.toggle("dark", theme === "dark");

  if (broadcast) {
    broadcastPreferenceChange(PREFERENCE_KEYS.theme, theme);
  }
}

export function setMotionPreference(motion, { broadcast = true } = {}) {
  localStorage.setItem(PREFERENCE_KEYS.motion, motion);
  document.body.classList.toggle("reduce-motion", motion === "reduced");

  if (broadcast) {
    broadcastPreferenceChange(PREFERENCE_KEYS.motion, motion);
  }
}

export function setStartPagePreference(startPage, { broadcast = true } = {}) {
  localStorage.setItem(PREFERENCE_KEYS.startPage, startPage);

  if (broadcast) {
    broadcastPreferenceChange(PREFERENCE_KEYS.startPage, startPage);
  }
}

export function initializeStoredPreferences() {
  setThemePreference(getPreference(PREFERENCE_KEYS.theme, "light"), { broadcast: false });
  setMotionPreference(getPreference(PREFERENCE_KEYS.motion, "standard"), {
    broadcast: false,
  });
}

export function getPreferredHomeRoute(role) {
  const startPage = getPreference(PREFERENCE_KEYS.startPage, "overview");

  if (startPage === "new-ticket") {
    return "/tickets/new";
  }

  if (startPage === "my-tickets") {
    return "/mytickets";
  }

  if (startPage === "queue") {
    if (role === "admin") return "/admin";
    if (role === "technician") return "/tech";
    return "/mytickets";
  }

  return "/overview";
}
