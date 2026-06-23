import React, { useState } from 'react';

// Mock data to populate the question bank
const mockQuestions = [
  {
    id: 1,
    text: "What is a variable in programming?",
    level: "Remember",
    type: "Multiple Choice",
    topic: "Programming Fundamentals",
  },
  {
    id: 2,
    text: "Define a data structure.",
    level: "Remember",
    type: "Multiple Choice",
    topic: "Data Structures",
  },
  {
    id: 3,
    text: "Explain how a hash table handles collisions.",
    level: "Understand",
    type: "Essay",
    topic: "Data Structures",
  },
  {
    id: 4,
    text: "Write a function to reverse a string in Python.",
    level: "Apply",
    type: "Coding",
    topic: "Algorithms",
  }
];

// Tab definitions to match your color scheme
const taxonomyTabs = [
  { name: 'Remember', count: 2, dotColor: 'bg-red-400' },
  { name: 'Understand', count: 1, dotColor: 'bg-rose-400' },
  { name: 'Apply', count: 1, dotColor: 'bg-orange-300' },
  { name: 'Analyze', count: 0, dotColor: 'bg-teal-400' },
  { name: 'Evaluate', count: 0, dotColor: 'bg-blue-400' },
  { name: 'Create', count: 0, dotColor: 'bg-purple-500' },
];

const QuestionBank = () => {
  const [activeTab, setActiveTab] = useState('Remember');
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  
  // Filter states
  const [subject, setSubject] = useState('');

  // Handle individual checkbox toggles
  const toggleSelection = (id) => {
    setSelectedQuestions(prev => 
      prev.includes(id) 
        ? prev.filter(qId => qId !== id) 
        : [...prev, id]
    );
  };

  // Filter the displayed questions based on the active tab
  const displayedQuestions = mockQuestions.filter(q => q.level === activeTab);

  return (
    <div className="max-w-5xl w-full p-2 h-full flex flex-col relative">
      
      {/* Top Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-4">
        <span className="text-gray-600 font-medium text-sm">Filter by:</span>
        <select 
          className="border border-gray-200 rounded-md p-2 text-sm text-gray-600 focus:outline-none focus:border-red-400 min-w-[180px]"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">Select subject</option>
          <option value="prog1">Programming 1</option>
          <option value="ds">Data Structures</option>
        </select>
      </div>

      {/* Main Content Area (Tabs + Questions) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden mb-20">
        
        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto hide-scrollbar">
          <div className="flex px-4 min-w-max">
            {taxonomyTabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex items-center gap-2 py-4 px-6 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.name
                    ? 'border-red-600 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.dotColor}`}></span>
                {tab.name}
                <span className="bg-gray-100 text-gray-500 text-xs py-0.5 px-2 rounded-full ml-1">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          {/* Custom decorative scrollbar line from screenshot */}
          <div className="h-2 bg-gray-400 mx-4 rounded-full flex items-center justify-between px-1 mb-2">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-r-[6px] border-r-white border-b-[4px] border-b-transparent"></div>
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent"></div>
          </div>
        </div>

        {/* Question List Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-gray-50/30">
          {displayedQuestions.length > 0 ? (
            displayedQuestions.map((q) => (
              <div 
                key={q.id} 
                className="bg-white border border-gray-200 rounded-lg p-5 flex gap-4 transition-all hover:border-red-200 hover:shadow-sm"
              >
                <div className="pt-1">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer accent-red-500"
                    checked={selectedQuestions.includes(q.id)}
                    onChange={() => toggleSelection(q.id)}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 font-medium mb-3">{q.text}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-md">
                      {q.level}
                    </span>
                    <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-md">
                      {q.type}
                    </span>
                    <span className="text-gray-400 px-1 py-1">
                      {q.topic}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-gray-500">
              No questions found for this cognitive level.
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-b-lg flex justify-between items-center z-10">
        <div className="text-gray-700 font-medium">
          Selected: <span className="text-red-600 font-bold text-lg">{selectedQuestions.length}</span>
        </div>
        <button 
          disabled={selectedQuestions.length === 0}
          className={`py-2 px-6 rounded-md font-medium text-sm transition-colors ${
            selectedQuestions.length > 0
              ? 'bg-[#b90000] hover:bg-[#990000] text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Generate Assessment
        </button>
      </div>

    </div>
  );
};

export default QuestionBank;