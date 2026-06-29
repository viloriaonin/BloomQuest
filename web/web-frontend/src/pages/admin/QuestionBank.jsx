import React from "react";

const QuestionBankBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "question-bank";

  return (
    <button
      onClick={() => setActiveTab("question-bank")}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-left transition-all duration-200 ${
        isActive
          ? "bg-red-600 text-white"
          : "text-red-50 hover:bg-red-600"
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

export const QuestionBankContent = () => (
  <div className="space-y-6 bg-[#f7f4f4] p-6 min-h-[calc(100vh-96px)]">
    <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-red-700">Question Bank</p>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">Manage exam questions and bank items</h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-600">
            Draft admin screen layout from the screenshot. This is a static visual mock for the admin question bank.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 transition">
            Add Question
          </button>
          <button className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            Import Bank
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-[32px] bg-gray-50 p-6">
        <div className="flex flex-wrap gap-3">
          {['All', 'Remember', 'Understand', 'Apply', 'Analyze', 'Create'].map((tab) => (
            <button
              key={tab}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total questions</p>
          <p className="mt-3 text-4xl font-bold text-gray-900">520</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Ready for review</p>
          <p className="mt-3 text-4xl font-bold text-gray-900">124</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">High-order items</p>
          <p className="mt-3 text-4xl font-bold text-gray-900">68</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          {
            title: 'What is a variable in programming?',
            chips: ['Remember', 'Multiple Choice', 'Programming'],
          },
          {
            title: 'Explain hash table collision handling.',
            chips: ['Understand', 'Essay', 'Data Structures'],
          },
          {
            title: 'Write a function to reverse a string.',
            chips: ['Apply', 'Coding', 'Algorithms'],
          },
          {
            title: 'Describe the purpose of a syllabus.',
            chips: ['Remember', 'Short Answer', 'Curriculum'],
          },
        ].map((item) => (
          <div key={item.title} className="rounded-3xl bg-[#faf7f7] p-6 shadow-sm border border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-900">{item.title}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.chips.map((chip) => (
                    <span key={chip} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <button className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[32px] bg-white p-8 shadow-sm border border-gray-200">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-red-700">Bank activity</p>
            <h2 className="mt-3 text-2xl font-bold text-gray-900">Recent question changes</h2>
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              Preview the latest additions and updates to the question bank in an admin-friendly layout.
            </p>
          </div>
          <button className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            View all activity
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {[
            { label: 'Added', detail: '8 new questions from Programming 1', time: '2h ago' },
            { label: 'Reviewed', detail: '12 questions marked for review', time: '5h ago' },
            { label: 'Tagged', detail: '5 questions assigned to Apply level', time: '1d ago' },
          ].map((item) => (
            <div key={item.detail} className="flex flex-col gap-3 rounded-3xl bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
              </div>
              <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-500 shadow-sm">
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default QuestionBankBtn;
