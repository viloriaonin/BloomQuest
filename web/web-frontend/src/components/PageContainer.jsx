import React from "react";

const PageContainer = ({ children, className = "" }) => {
  return (
    <div className={`min-h-full w-full page-transition ${className}`.trim()}>
      {children}
    </div>
  );
};

export default PageContainer;
