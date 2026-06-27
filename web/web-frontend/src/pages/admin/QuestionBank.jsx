import React from "react";

const QuestionBankBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "question-bank";

  return (
    <button
      onClick={() => setActiveTab("question-bank")}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-left transition-all duration-200 ${
        isActive
          ? "bg-red-600 text-white shadow-lg"
          : "text-red-50 hover:bg-red-600 hover:shadow-md"
      }`}
    >
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.669 0-3.218.51-4.5 1.385A7.968 7.968 0 009 4.804z" />
      </svg>
      <span>Question Bank</span>
    </button>
  );
};

export default QuestionBankBtn;
