import React from "react";

function EmptyState({ title = "Nothing here yet", description }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export default EmptyState;
