import React, { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:8000';
const BLOOMS_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
const QUESTION_TYPE_OPTIONS = [
  { label: 'Multiple Choice', value: 'MCQ' },
  { label: 'True or False', value: 'True/False' },
  { label: 'Identification', value: 'Identification' },
  { label: 'Matching Type', value: 'Matching Type' },
  { label: 'Enumeration', value: 'Enumeration' },
  { label: 'Essay', value: 'Essay' },
  { label: 'Situational', value: 'Situational' },
];

const InputQuestion = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Shared Core States
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isAddingNewSubject, setIsAddingNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');

  // Manual Tab States
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualQuestionType, setManualQuestionType] = useState('MCQ');
  const [classifying, setClassifying] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Upload & Auto-Gen Tab States
  const [moduleFile, setModuleFile] = useState(null);
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [totalItems, setTotalItems] = useState('');
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);

  const moduleInputRef = useRef();
  const syllabusInputRef = useRef();

  // Load active global subject filters from question bank configurations on tab mounts
  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`${API_URL}/api/subjects`);
      if (!response.ok) throw new Error('Failed to synchronize subject matrix context data records.');
      const data = await response.json();
      setSubjects(data);
    } catch (err) {
      setError('Could not establish persistent communication hooks with active subjects database schemas.');
    }
  };

  // Perform continuous lookahead checking on keystroke breaks to ensure "same thoughts" don't match existing vectors
  useEffect(() => {
    if (manualQuestion.trim().length < 10 || !selectedSubject) {
      setDuplicateWarning('');
      return;
    }
    
    const delayDebounceCheck = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/questions?subject_id=${selectedSubject}`);
        if (response.ok) {
          const matchingQuestionBankItems = await response.json();
          const targetInputText = manualQuestion.trim().toLowerCase();
          
          // Checks for exact or close structural sentence phrasing similarities matching bank schemas
          const isDuplicateThought = matchingQuestionBankItems.some(q => 
            q.question.toLowerCase().includes(targetInputText) || 
            targetInputText.includes(q.question.toLowerCase())
          );

          if (isDuplicateThought) {
            setDuplicateWarning('⚠️ A question item with this identical concept or matching core text already exists within this subject layout block.');
          } else {
            setDuplicateWarning('');
          }
        }
      } catch (err) {
        console.error("Lookahead query safety verification check encountered an unexpected routing exception:", err);
      }
    }, 600); // 600ms input debounce delay tracker

    return () => clearTimeout(delayDebounceCheck);
  }, [manualQuestion, selectedSubject]);

  const handleSubjectDropdownChange = (e) => {
    const val = e.target.value;
    if (val === 'add_new') {
      setIsAddingNewSubject(true);
      setSelectedSubject('');
    } else {
      setIsAddingNewSubject(false);
      setSelectedSubject(val);
    }
  };

const handleCreateCustomSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    setError('');
    setSuccessMessage('');
    try {
      // Pointing cleanly to your new dedicated API endpoint handler
      const response = await fetch(`${API_URL}/api/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newSubjectName.trim(),
          code: newSubjectCode.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to register subject.');

      // Capture the exact database structural id from the response payload
      setSubjects(prev => [...prev, data]);
      setSelectedSubject(data.id); 
      setIsAddingNewSubject(false);
      setNewSubjectName('');
      setNewSubjectCode('');
      setSuccessMessage('🎉 Course area injected into registry framework layout records successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleManualClassification = async () => {
    if (!selectedSubject) {
      setError('You must select a subject tracking reference framework before classifying items.');
      return;
    }
    if (!manualQuestion.trim()) {
      setError('Question block workspace cannot be submitted while empty.');
      return;
    }
    if (duplicateWarning) {
      setError('Cannot proceed: Conceptual duplicate detected within this course pool.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setClassifying(true);

    try {
      const response = await fetch(`${API_URL}/api/questions/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: manualQuestion.trim(),
          question_type: manualQuestionType,
          subject_id: parseInt(selectedSubject),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Classification engine execution failed.');
      
      setSuccessMessage(`🎉 Success! Machine Learning model analyzed the structure and placed the item into the "${data.bloom_level}" taxonomy rank tier inside your question bank.`);
      setManualQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setClassifying(false);
    }
  };

  const toggleQuestionType = (value) => {
    setSelectedQuestionTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleUpload = async () => {
    if (!moduleFile || !syllabusFile) {
      setError('Please upload both module and syllabus files.');
      return;
    }
    setError('');
    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('module_file', moduleFile);
      formData.append('syllabus_file', syllabusFile);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');
      setUploadResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!totalItems || totalItems < 1) {
      setError('Please enter a valid number of items.');
      return;
    }
    setError('');
    setGenerating(true);
    setGenerationResult(null);

    try {
      const formData = new FormData();
      formData.append('upload_id', uploadResult.upload_id);
      formData.append('total_items', totalItems);
      formData.append('question_types', selectedQuestionTypes.join(','));

      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Generation failed');
      setGenerationResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl w-full p-2">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-3 px-6 font-medium text-sm transition-colors ${
              activeTab === 'manual'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              setActiveTab('manual');
              setError('');
              setSuccessMessage('');
            }}
          >
            Input Manually
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm transition-colors ${
              activeTab === 'upload'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              setActiveTab('upload');
              setError('');
              setSuccessMessage('');
            }}
          >
            Upload File / Module
          </button>
        </div>

        {/* Diagnostic Status Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {/* MANUAL TAB */}
        {activeTab === 'manual' && (
          <div className="space-y-6">
            
            {/* Subject Selector and Target Type Deck Configs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Target Course Subject</label>
                <select
                  className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400 cursor-pointer"
                  value={selectedSubject}
                  onChange={handleSubjectDropdownChange}
                >
                  <option value="">— Select Associated Subject Framework —</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                  ))}
                  <option value="add_new" className="text-red-600 font-semibold">+ Add New Subject Option...</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Intended Item Assessment Type</label>
                <select
                  className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400 cursor-pointer"
                  value={manualQuestionType}
                  onChange={(e) => setManualQuestionType(e.target.value)}
                >
                  {QUESTION_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dynamic Inline Subject Registry Creation Dock Section */}
            {isAddingNewSubject && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 animation-fade-in">
                <h4 className="text-xs font-bold text-gray-700 uppercase">Register New Curricular Course Component</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Subject Title (e.g., Software Engineering)" 
                    className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="Subject Key Code (e.g., COMSCI302)" 
                    className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setIsAddingNewSubject(false)}
                    className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateCustomSubject}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md font-medium"
                  >
                    Save Subject
                  </button>
                </div>
              </div>
            )}

            {/* Primary Question Entry Frame Workspace */}
            <div className="relative">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Question Input Content Area</label>
              <textarea
                className={`w-full h-44 p-4 border rounded-md focus:ring-1 outline-none resize-none text-gray-700 text-sm transition-all ${
                  duplicateWarning 
                    ? 'border-orange-400 focus:ring-orange-400 focus:border-orange-400 bg-orange-50/20' 
                    : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                }`}
                placeholder="Type the unique draft assessment question parameters here..."
                maxLength={500}
                value={manualQuestion}
                onChange={(e) => setManualQuestion(e.target.value)}
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs font-medium text-orange-600">{duplicateWarning}</span>
                <span className="text-xs text-gray-400 ml-auto">{manualQuestion.length} / 500 characters</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={handleManualClassification}
                disabled={classifying || !!duplicateWarning || !manualQuestion.trim() || !selectedSubject}
                className="bg-[#b90000] hover:bg-[#990000] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 px-6 rounded-md transition-colors flex items-center gap-2"
              >
                {classifying ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Running ML Classifiers...
                  </>
                ) : 'Classify & Save Question'}
              </button>
            </div>
          </div>
        )}

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div className="space-y-6">

            {/* Step 1: Upload Files */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                Upload Files
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Module Upload */}
                <div
                  onClick={() => moduleInputRef.current.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    moduleFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={moduleInputRef}
                    type="file"
                    accept=".pdf,.pptx,.ppt,.docx"
                    className="hidden"
                    onChange={(e) => setModuleFile(e.target.files[0])}
                  />
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                    moduleFile ? 'bg-green-100 text-green-500' : 'bg-red-50 text-red-400'
                  }`}>
                    {moduleFile ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">Upload Modules or PPT</h3>
                  {moduleFile ? (
                    <p className="text-xs text-green-600 font-medium">{moduleFile.name}</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-4">Lesson files, slides, or reading materials</p>
                      <div className="flex gap-2">
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">PDF</span>
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">PPTX</span>
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">DOCX</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Syllabus Upload */}
                <div
                  onClick={() => syllabusInputRef.current.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    syllabusFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={syllabusInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setSyllabusFile(e.target.files[0])}
                  />
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                    syllabusFile ? 'bg-green-100 text-green-500' : 'bg-blue-50 text-blue-400'
                  }`}>
                    {syllabusFile ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">Upload Course Syllabus</h3>
                  {syllabusFile ? (
                    <p className="text-xs text-green-600 font-medium">{syllabusFile.name}</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-4">Course outline or curriculum document</p>
                      <div className="flex gap-2">
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">PDF</span>
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">DOCX</span>
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-1 rounded">XLSX</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={uploading || !moduleFile || !syllabusFile}
                className="mt-4 w-full bg-[#b90000] hover:bg-[#990000] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-md transition-colors text-sm"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Analyzing files...
                  </span>
                ) : 'Upload & Analyze Files'}
              </button>
            </div>

            {/* Step 2: Show detected subject and topics */}
            {uploadResult && (
              <div className="border border-gray-200 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                  Detected Subject & Topics
                </h3>

                {/* Subject Info */}
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Subject Detected</p>
                  <p className="font-semibold text-gray-800">{uploadResult.subject.name}</p>
                  {uploadResult.subject.code && (
                    <p className="text-xs text-gray-500">{uploadResult.subject.code}</p>
                  )}
                  {uploadResult.subject.description && (
                    <p className="text-xs text-gray-500 mt-1">{uploadResult.subject.description}</p>
                  )}
                </div>

                {/* Topics */}
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold mb-2">Topics Detected</p>
                  <div className="space-y-2">
                    {uploadResult.topics.map((topic, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-md px-4 py-2">
                        <span className="text-sm text-gray-700">{topic.name}</span>
                        <span className="text-xs font-semibold text-red-600">{Math.round(topic.weight * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 3: Enter total items */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                    Number of Items
                  </h3>
                  <div className="flex gap-3 items-center">
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={totalItems}
                      onChange={(e) => setTotalItems(e.target.value)}
                      placeholder="Enter total number of questions (e.g. 50)"
                      className="flex-1 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Questions will be auto-distributed across the selected Bloom's Taxonomy levels and question types.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-bold text-gray-600 uppercase mb-3">Question Types</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {QUESTION_TYPE_OPTIONS.map((option) => {
                      const checked = selectedQuestionTypes.includes(option.value);
                      return (
                        <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700 rounded-md border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleQuestionType(option.value)}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !totalItems || selectedQuestionTypes.length === 0}
                  className="w-full bg-[#b90000] hover:bg-[#990000] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-md transition-colors text-sm"
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Generating questions... This may take a minute
                    </span>
                  ) : 'Generate Questions'}
                </button>
              </div>
            )}

            {/* Step 4: Show TOS and results */}
            {generationResult && (
              <div className="border border-green-200 bg-green-50 rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <h3 className="text-sm font-bold text-green-700">
                    {generationResult.message}
                  </h3>
                </div>

                {/* TOS Table */}
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">Table of Specification</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-800 text-white">
                          <th className="px-3 py-2 text-left">Topic</th>
                          <th className="px-3 py-2 text-center">Weight</th>
                          <th className="px-3 py-2 text-center">Total</th>
                          {BLOOMS_LEVELS.map(level => (
                            <th key={level} className="px-3 py-2 text-center">{level}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {generationResult.tos.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 font-medium">{row.topic}</td>
                            <td className="px-3 py-2 text-center">{row.weight}%</td>
                            <td className="px-3 py-2 text-center font-bold">{row.total_items}</td>
                            {BLOOMS_LEVELS.map(level => (
                              <td key={level} className="px-3 py-2 text-center">
                                {row.bloom_breakdown[level]?.total || 0}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-bold text-gray-600 uppercase mb-3">Question Preview</p>
                    <div className="max-h-80 overflow-y-auto space-y-3">
                      {(generationResult.questions_preview || []).map((question, idx) => (
                        <div key={`${question.type}-${idx}`} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[11px] font-semibold uppercase text-red-600">{question.type}</span>
                            <span className="text-[11px] text-gray-500">{question.bloom_level}</span>
                          </div>
                          <p className="text-sm text-gray-700">{question.question}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                    <p className="text-xs font-bold text-gray-600 uppercase">Bloom Distribution</p>
                    <div className="space-y-2">
                      {Object.entries(generationResult.bloom_distribution || {}).map(([level, count]) => (
                        <div key={level}>
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>{level}</span>
                            <span>{count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-red-600" style={{ width: `${Math.max(8, (count / Math.max(1, generationResult.total_questions)) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-bold text-gray-600 uppercase mb-2">Question Type Distribution</p>
                      <div className="space-y-1">
                        {Object.entries(generationResult.question_type_distribution || {}).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between text-xs text-gray-600">
                            <span>{type}</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-green-600 font-medium">
                  ✅ {generationResult.total_questions} questions saved to Question Bank!
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default InputQuestion;