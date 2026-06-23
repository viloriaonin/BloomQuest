import React, { useState } from 'react';

// Mock data representing the user's activity log
const mockHistory = [
  {
    id: 1,
    action: "Generated Assessment",
    details: "Created 'Midterm Exam - Data Structures' with 25 questions.",
    date: "Today, 10:45 AM",
    type: "generate", 
    status: "success"
  },
  {
    id: 2,
    action: "Uploaded Module",
    details: "Processed 'Chapter_4_Trees.pdf' for Table of Specifications.",
    date: "Today, 09:30 AM",
    type: "upload",
    status: "success"
  },
  {
    id: 3,
    action: "Classified Question",
    details: "Manual Input: 'What is a binary tree?' → Categorized as Remember.",
    date: "Yesterday, 03:15 PM",
    type: "classify",
    status: "success"
  },
  {
    id: 4,
    action: "Failed Upload",
    details: "File 'corrupted_syllabus.docx' could not be read.",
    date: "Yesterday, 01:10 PM",
    type: "upload",
    status: "error"
  },
  {
    id: 5,
    action: "System Login",
    details: "Logged in securely from Chrome (Windows).",
    date: "Yesterday, 08:00 AM",
    type: "login",
    status: "info"
  }
];

// Helper function to render the correct icon based on the activity type
const getIcon = (type, status) => {
  if (status === 'error') {
    return (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    );
  }
  
  switch (type) {
    case 'generate':
      return (
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      );
    case 'upload':
      return (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
        </svg>
      );
    case 'classify':
      return (
        <svg className="w-5 h-5 text-[#b90000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
        </svg>
      );
    case 'login':
    default:
      return (
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
        </svg>
      );
  }
};

const History = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter history based on search input
  const filteredHistory = mockHistory.filter(item => 
    item.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl w-full p-2 h-full flex flex-col">
      
      {/* Header & Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Activity History</h2>
          <p className="text-sm text-gray-500 mt-1">Review your recent actions and system logs.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-gray-600 focus:outline-none focus:border-red-400"
            placeholder="Search activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Timeline Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 flex-1 overflow-y-auto">
        
        {filteredHistory.length > 0 ? (
          <div className="relative border-l-2 border-gray-100 ml-3 md:ml-6 space-y-8 pb-4">
            {filteredHistory.map((item) => (
              <div key={item.id} className="relative pl-8 md:pl-10">
                
                {/* Timeline Dot with Icon */}
                <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center
                  ${item.status === 'error' ? 'bg-red-50' : 'bg-gray-50'} shadow-sm`}
                >
                  {getIcon(item.type, item.status)}
                </div>

                {/* Activity Content Box */}
                <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                    <h3 className={`font-semibold text-base ${item.status === 'error' ? 'text-red-600' : 'text-gray-800'}`}>
                      {item.action}
                    </h3>
                    <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {item.date}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{item.details}</p>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p>No activity found matching "{searchTerm}"</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default History;