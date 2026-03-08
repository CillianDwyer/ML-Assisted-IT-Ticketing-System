import React from "react";

function FilterBar({ children, className = "" }) {
  const classes = ["filter-bar", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}

export default FilterBar;
