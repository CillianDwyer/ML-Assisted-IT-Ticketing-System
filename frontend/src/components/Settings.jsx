import React, { useEffect, useState } from "react";
import PageHeader from "./PageHeader";
import SectionCard from "./SectionCard";
import {
  PREFERENCE_KEYS,
  getPreference,
  setMotionPreference,
  setStartPagePreference,
  setThemePreference,
} from "../utils/preferences";

const START_PAGE_OPTIONS = [
  {
    value: "overview",
    label: "Overview",
    description: "Open the main summary page after sign-in.",
  },
  {
    value: "my-tickets",
    label: "My Tickets",
    description: "Jump straight to your submitted tickets.",
  },
  {
    value: "new-ticket",
    label: "Submit Ticket",
    description: "Open the ticket form immediately.",
  },
  {
    value: "queue",
    label: "Role Dashboard",
    description: "Open the technician or admin queue when your role has one.",
  },
];

function Settings() {
  const role = localStorage.getItem("role") || "user";
  const email = localStorage.getItem("email") || "Account";
  const [theme, setTheme] = useState(() => getPreference(PREFERENCE_KEYS.theme, "light"));
  const [motion, setMotion] = useState(() =>
    getPreference(PREFERENCE_KEYS.motion, "standard")
  );
  const [startPage, setStartPage] = useState(() =>
    getPreference(PREFERENCE_KEYS.startPage, "overview")
  );

  useEffect(() => {
    const handlePreferenceChange = (event) => {
      const { key, value } = event.detail || {};
      if (key === PREFERENCE_KEYS.theme) setTheme(value);
      if (key === PREFERENCE_KEYS.motion) setMotion(value);
      if (key === PREFERENCE_KEYS.startPage) setStartPage(value);
    };

    window.addEventListener("app:preferences-changed", handlePreferenceChange);
    return () => {
      window.removeEventListener("app:preferences-changed", handlePreferenceChange);
    };
  }, []);

  const onThemeChange = (value) => {
    setTheme(value);
    setThemePreference(value);
  };

  const onMotionChange = (value) => {
    setMotion(value);
    setMotionPreference(value);
  };

  const onStartPageChange = (value) => {
    setStartPage(value);
    setStartPagePreference(value);
  };

  return (
    <div className="ticket-card dashboard-card settings-page">
      <PageHeader
        title="Settings"
        subtitle="Adjust the workspace behavior you use most often. Changes save immediately on this device."
      />

      <section className="settings-hero">
        <div className="settings-hero-main">
          <div className="settings-hero-eyebrow">Workspace preferences</div>
          <h2 className="settings-hero-title">Keep the app tuned to your workflow.</h2>
          <p className="settings-hero-copy">
            Choose how the interface looks, how much motion it uses, and which screen
            should open first when you come back.
          </p>
        </div>

        <aside className="settings-hero-side">
          <div className="settings-account-card">
            <span className="settings-account-label">Signed in as</span>
            <strong>{email}</strong>
            <span className="settings-account-role">{role}</span>
          </div>
        </aside>
      </section>

      <div className="settings-grid">
        <SectionCard title="Appearance" className="settings-card">
          <div className="settings-option-list">
            <div className="settings-option">
              <div className="settings-option-copy">
                <h4>Theme</h4>
                <p>Switch between light and dark mode across the app.</p>
              </div>
              <div className="settings-segmented-control" role="radiogroup" aria-label="Theme">
                <button
                  type="button"
                  className={`settings-segment ${theme === "light" ? "active" : ""}`}
                  onClick={() => onThemeChange("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={`settings-segment ${theme === "dark" ? "active" : ""}`}
                  onClick={() => onThemeChange("dark")}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="settings-option">
              <div className="settings-option-copy">
                <h4>Motion</h4>
                <p>Reduce transitions and animation if you prefer a calmer interface.</p>
              </div>
              <div className="settings-segmented-control" role="radiogroup" aria-label="Motion">
                <button
                  type="button"
                  className={`settings-segment ${motion === "standard" ? "active" : ""}`}
                  onClick={() => onMotionChange("standard")}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={`settings-segment ${motion === "reduced" ? "active" : ""}`}
                  onClick={() => onMotionChange("reduced")}
                >
                  Reduced
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Start page" className="settings-card">
          <div className="settings-radio-list" role="radiogroup" aria-label="Start page">
            {START_PAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`settings-radio-card ${startPage === option.value ? "active" : ""}`}
                onClick={() => onStartPageChange(option.value)}
              >
                <div className="settings-radio-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </div>
                <span className="settings-radio-indicator" aria-hidden="true" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default Settings;
