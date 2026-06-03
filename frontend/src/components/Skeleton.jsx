import React from "react";

export function SkeletonTable({ rows = 6, cols = 8 }) {
  return (
    <div className="table-wrap">
      <div className="skeleton-table">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-table-row">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="skeleton-cell" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTicket() {
  return (
    <>
      <div className="skeleton-ticket-hero">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-ticket-stat">
            <div className="skeleton-cell skeleton-label" />
            <div className="skeleton-cell skeleton-value" />
          </div>
        ))}
      </div>
      <div className="skeleton-ticket-body">
        {[false, true, false, true, false].map((right, i) => (
          <div
            key={i}
            className={`skeleton-cell skeleton-msg ${right ? "skeleton-msg-right" : "skeleton-msg-left"}`}
          />
        ))}
      </div>
    </>
  );
}
