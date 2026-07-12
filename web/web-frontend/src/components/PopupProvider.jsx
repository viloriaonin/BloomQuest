import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const PopupContext = createContext(null);

export const PopupProvider = ({ children }) => {
  const [popup, setPopup] = useState({
    open: false,
    type: "alert",
    title: "",
    message: "",
  });
  const resolveRef = useRef(null);

  const openPopup = useCallback((config, resolve) => {
    resolveRef.current = resolve;
    setPopup({ open: true, ...config });
  }, []);

  const showAlert = useCallback((message, title = "Notice") => {
    return new Promise((resolve) => {
      openPopup({ type: "alert", title, message }, resolve);
    });
  }, [openPopup]);

  const showConfirm = useCallback((message, title = "Confirm") => {
    return new Promise((resolve) => {
      openPopup({ type: "confirm", title, message }, resolve);
    });
  }, [openPopup]);

  const closePopup = useCallback((result = false) => {
    setPopup((current) => ({ ...current, open: false }));
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
  }, []);

  const handleOk = useCallback(() => closePopup(true), [closePopup]);
  const handleCancel = useCallback(() => closePopup(false), [closePopup]);

  return (
    <PopupContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {popup.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-all duration-300">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#E5E7EB] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] transition-all duration-300 ease-out">
            <button
              type="button"
              onClick={handleCancel}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
              aria-label="Close popup"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#B01C1C]">{popup.type === "confirm" ? "Confirmation" : "Notice"}</p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-[#1E1113]">{popup.title}</h2>
              </div>
              <p className="text-sm leading-7 text-[#4B4B4B]">{popup.message}</p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {popup.type === "confirm" && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full rounded-full border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleOk}
                className="w-full rounded-full bg-[#B01C1C] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(176,28,28,0.25)] transition hover:bg-[#931616] sm:w-auto"
              >
                {popup.type === "confirm" ? "Confirm" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
};

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error("usePopup must be used within PopupProvider");
  }
  return context;
};
