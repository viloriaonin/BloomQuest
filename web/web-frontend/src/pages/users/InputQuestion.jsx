import React, { useState } from 'react';

const InputQuestion = () => {
  const [activeTab, setActiveTab] = useState('manual');
  
  // State for Manual Input
  const [questionText, setQuestionText] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState(null);

  const handleClassify = async () => {
    if (!questionText.trim()) return;
    
    setIsClassifying(true);
    setClassificationResult(null);

    try {
      // Make sure your Python Flask/FastAPI server is running on port 5000
      const response = await fetch('http://localhost:5000/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText }) 
      });

      const result = await response.json();
      setClassificationResult(result.predicted_level || "Analyzed successfully");
    } catch (error) {
      console.error("Error connecting to backend:", error);
      setClassificationResult("Error: Backend offline");
    } finally {
      setIsClassifying(false);
    }
  };

  const handleGenerateTOS = () => {
    console.log("Preparing files for Table of Specifications generation...");
    // Future file upload logic goes here
  };

  return (
    <div className="max-w-5xl w-full p-2">
      
      {/* Main Container matching the screenshot */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
              activeTab === 'manual'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('manual')}
          >
            Input Manually
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
              activeTab === 'upload'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            Upload File / Module
          </button>
        </div>

        {/* --- TAB CONTENT: MANUAL INPUT --- */}
        {activeTab === 'manual' && (
          <div className="space-y-6 animate-fade-in">
            {/* Text Area */}
            <div className="relative">
              <textarea
                className="w-full h-48 p-4 border border-gray-200 rounded-md focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none resize-none text-gray-700"
                placeholder="Type your question here..."
                maxLength={500}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              ></textarea>
              <div className="absolute bottom-3 right-4 text-xs font-medium text-gray-400">
                {questionText.length} / 500
              </div>
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">SUBJECT</label>
                <select className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-600 focus:outline-none focus:border-red-400 cursor-pointer">
                  <option value="">Select subject</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button 
                onClick={handleClassify}
                disabled={isClassifying}
                className={`text-white font-medium text-sm py-2.5 px-6 rounded-md transition-all ${
                  isClassifying ? 'bg-red-300 cursor-not-allowed' : 'bg-[#db7a7c] hover:bg-[#c96264]'
                }`}
              >
                {isClassifying ? 'Classifying...' : 'Classify Question'}
              </button>
            </div>

            {/* Temporary Results Display */}
            {classificationResult && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                <strong>Result:</strong> {classificationResult}
              </div>
            )}
          </div>
        )}

        {/* --- TAB CONTENT: FILE UPLOAD --- */}
        {activeTab === 'upload' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Modules/PPT Upload Box */}
              <div className="border border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
                <div className="w-14 h-14 bg-red-50 text-red-400 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">Upload Modules or PPT</h3>
                <p className="text-xs text-gray-500 mb-5">Lesson files, slides, or reading materials</p>
                <div className="flex gap-2 mb-6">
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">PDF</span>
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">PPTX</span>
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">DOCX</span>
                </div>
                <button className="bg-[#b90000] hover:bg-[#990000] text-white text-sm font-medium py-2 px-8 rounded-md transition-colors">
                  Browse Files
                </button>
              </div>

              {/* Syllabus Upload Box */}
              <div className="border border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
                <div className="w-14 h-14 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">Upload Course Syllabus</h3>
                <p className="text-xs text-gray-500 mb-5">Course outline or curriculum document</p>
                <div className="flex gap-2 mb-6">
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">PDF</span>
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">DOCX</span>
                </div>
                <button className="bg-white border border-blue-500 text-blue-500 hover:bg-blue-50 text-sm font-medium py-2 px-8 rounded-md transition-colors">
                  Browse Files
                </button>
              </div>
            </div>

            {/* Generate Button */}
            <button 
              onClick={handleGenerateTOS}
              className="w-full bg-[#b90000] hover:bg-[#990000] text-white font-medium py-3 rounded-md transition-colors text-sm"
            >
              Generate Table of Specifications
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default InputQuestion;