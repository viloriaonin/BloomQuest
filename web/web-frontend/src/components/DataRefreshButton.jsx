import React from "react";
import { RefreshCw } from "lucide-react";
import { clearApiResponseCache } from "../utils/apiCache";

const DataRefreshButton = ({ className = "", style }) => (
  <button
    type="button"
    aria-label="Refresh data"
    title="Refresh data"
    onClick={() => {
      clearApiResponseCache();
      window.location.reload();
    }}
    className={className}
    style={style}
  >
    <RefreshCw size={16} />
  </button>
);

export default DataRefreshButton;
