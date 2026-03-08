import React from "react";

function MetricCard({ label, value, subtext, className = "" }) {
  const classes = ["kpi-card", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className="overview-label">{label}</div>
      <div className="overview-value">{value}</div>
      {subtext ? <div className="metric-card-subtext">{subtext}</div> : null}
    </div>
  );
}

export default MetricCard;
