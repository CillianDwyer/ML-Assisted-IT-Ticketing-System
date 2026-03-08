import React from "react";

function SectionCard({ title, action, className = "", children }) {
  const classes = ["section-card", className].filter(Boolean).join(" ");

  return (
    <section className={classes}>
      {(title || action) && (
        <div className="section-card-header">
          <h3>{title}</h3>
          {action ? <div className="section-card-action">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export default SectionCard;
