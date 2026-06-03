import React, { useEffect } from "react";
import SectionCard from "./SectionCard";

const MODELS = [
  {
    name: "LinearSVC",
    summary: "A linear support vector machine that works well on sparse text features.",
    benefits: [
      "Usually performs strongly on high-dimensional text classification tasks.",
      "Fast to train and predict compared with heavier models.",
      "Handles TF-IDF feature spaces well.",
    ],
    drawbacks: [
      "Less interpretable than simpler probabilistic models.",
      "Does not return native probability scores by default.",
    ],
    selected: true,
  },
  {
    name: "Logistic Regression",
    summary: "A linear classifier often used as a reliable baseline for text problems.",
    benefits: [
      "Easy to reason about and widely trusted for classification baselines.",
      "Can produce probability-style outputs in many setups.",
    ],
    drawbacks: [
      "May underperform the best linear margin methods on some text tasks.",
      "Can need more tuning for class imbalance and regularization.",
    ],
  },
  {
    name: "Multinomial Naive Bayes",
    summary: "A lightweight probabilistic model commonly used for document classification.",
    benefits: [
      "Very fast and simple.",
      "Often gives decent results on bag-of-words style text data.",
    ],
    drawbacks: [
      "Uses stronger assumptions about feature independence.",
      "Often less accurate than stronger linear classifiers on richer datasets.",
    ],
  },
  {
    name: "SGDClassifier (hinge)",
    summary: "An efficient large-scale linear classifier trained with stochastic gradient descent.",
    benefits: [
      "Scales well to large text datasets.",
      "Fast and memory-efficient.",
    ],
    drawbacks: [
      "More sensitive to parameter choices and training setup.",
      "Can be less stable than LinearSVC for final results.",
    ],
  },
  {
    name: "RandomForestClassifier",
    summary: "An ensemble of decision trees tested as a non-linear alternative.",
    benefits: [
      "Can model non-linear patterns.",
      "Useful as a comparison against linear text models.",
    ],
    drawbacks: [
      "Usually not the best fit for sparse high-dimensional TF-IDF text data.",
      "Heavier and less efficient for this kind of classification problem.",
    ],
  },
];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ModelDetailsModal({ onClose, onBack }) {
  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      className="settings-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-modal settings-modal--wide" role="dialog" aria-label="ML Model Details">
        <div className="settings-modal-header">
          <div>
            <div className="settings-modal-eyebrow">Admin only · Prediction pipeline</div>
            <h2 className="settings-modal-title">ML Model Details</h2>
            <p className="settings-modal-subtitle">
              How ticket issue-type classification was tested and why the current model was selected.
            </p>
          </div>
          <div className="settings-modal-header-right">
            {onBack && (
              <button className="settings-modal-back" onClick={onBack} aria-label="Back to settings">
                <BackIcon /> Settings
              </button>
            )}
            <button className="settings-modal-close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="settings-modal-body">
          <section className="model-details-hero">
            <div className="model-details-hero-copy">
              <h3 className="model-details-title" style={{ fontSize: "clamp(1.4rem, 2.5vw, 2rem)" }}>
                TF-IDF features + LinearSVC power the issue-type prediction.
              </h3>
              <p className="model-details-text">
                Ticket text is converted into TF-IDF features, then classified into an issue type.
                That predicted issue type drives team routing and the starting priority.
              </p>
            </div>
            <div className="model-details-summary">
              <div className="model-summary-card">
                <span>Input</span>
                <strong>Ticket title + description text</strong>
              </div>
              <div className="model-summary-card">
                <span>Feature extraction</span>
                <strong>TF-IDF with unigrams and bigrams</strong>
              </div>
              <div className="model-summary-card">
                <span>Chosen classifier</span>
                <strong>LinearSVC</strong>
              </div>
              <div className="model-summary-card">
                <span>Prediction effect</span>
                <strong>Issue type, team routing, starting priority</strong>
              </div>
            </div>
          </section>

          <div className="model-details-grid">
            <SectionCard title="Why this model was chosen" className="settings-card">
              <div className="settings-option">
                <div className="settings-option-copy">
                  <h4>Reason for selection</h4>
                  <p>
                    The project compares several text classifiers, but the deployed model uses
                    TF-IDF features with LinearSVC because that combination is a strong fit for
                    sparse ticket text, offers solid performance, and stays simple to run in the app.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Pipeline overview" className="settings-card">
              <div className="model-flow-list">
                <div className="model-flow-step">
                  <strong>1. Text input</strong>
                  <span>The ticket description is collected when the user submits a ticket.</span>
                </div>
                <div className="model-flow-step">
                  <strong>2. TF-IDF features</strong>
                  <span>Important words and short phrases are converted into numeric features.</span>
                </div>
                <div className="model-flow-step">
                  <strong>3. LinearSVC prediction</strong>
                  <span>The classifier predicts the most likely issue type label.</span>
                </div>
                <div className="model-flow-step">
                  <strong>4. Business logic</strong>
                  <span>The predicted issue type is used for team assignment and base priority.</span>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Tested models" className="settings-card">
            <div className="model-cards">
              {MODELS.map((model) => (
                <article key={model.name} className={`model-card ${model.selected ? "selected" : ""}`}>
                  <div className="model-card-header">
                    <div>
                      <h4>{model.name}</h4>
                      <p>{model.summary}</p>
                    </div>
                    {model.selected ? <span className="model-chip">Selected</span> : null}
                  </div>
                  <div className="model-card-section">
                    <strong>Benefits</strong>
                    <ul>
                      {model.benefits.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div className="model-card-section">
                    <strong>Disadvantages</strong>
                    <ul>
                      {model.drawbacks.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default ModelDetailsModal;
