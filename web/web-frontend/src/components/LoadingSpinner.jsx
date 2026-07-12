import React from "react";

const LoadingSpinner = ({ size = "w-5 h-5", label = "Loading...", spinnerColor = "border-white" }) => (
  <span className="inline-flex items-center gap-2">
    <span className={`inline-block ${size} rounded-full border-2 border-t-transparent animate-spin ${spinnerColor}`} />
    <span>{label}</span>
  </span>
);

export default LoadingSpinner;
