import React from "react";

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export default PageHeader;
