import React, { useState, useEffect, useRef } from 'react';
<<<<<<< HEAD
import { UploadCloud, FileText, FileSpreadsheet, Presentation, X, CheckCircle2, AlertCircle } from 'lucide-react';

const API_URL = '/api';
const BLOOMS_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
const QUESTION_TYPE_OPTIONS = [
  { label: 'Multiple Choice', value: 'MCQ' },
  { label: 'True or False', value: 'True or False' },
=======

const API_URL = 'http://localhost:8000';
const BLOOMS_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
const QUESTION_TYPE_OPTIONS = [
  { label: 'Multiple Choice', value: 'MCQ' },
  { label: 'True or False', value: 'True/False' },
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
  { label: 'Identification', value: 'Identification' },
  { label: 'Matching Type', value: 'Matching Type' },
  { label: 'Enumeration', value: 'Enumeration' },
  { label: 'Essay', value: 'Essay' },
  { label: 'Situational', value: 'Situational' },
];

<<<<<<< HEAD
// File-type policies for each upload slot. Extension is checked rather than
// relying purely on MIME type, since browsers/OS report MIME inconsistently
// for Office formats (especially on Windows).
const FILE_POLICIES = {
  module: {
    label: 'Module',
    instruction: 'Upload the learning module or lecture deck',
    formats: ['PDF', 'DOCX', 'PPTX'],
    extensions: ['.pdf', '.docx', '.pptx'],
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    accept: '.pdf,.docx,.pptx',
  },
  syllabus: {
    label: 'Course Information Sheet',
    instruction: 'Upload the CIS containing your syllabus topics',
    formats: ['XLSX', 'PDF', 'DOCX'],
    extensions: ['.xlsx', '.pdf', '.docx'],
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    accept: '.xlsx,.pdf,.docx',
  },
};

const getExtension = (filename = '') => {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx).toLowerCase();
};

const validateFile = (file, policyKey) => {
  const policy = FILE_POLICIES[policyKey];
  const ext = getExtension(file.name);
  const extOk = policy.extensions.includes(ext);
  // MIME check is a secondary signal only — some browsers leave it blank for
  // certain Office files, so we don't hard-fail on it alone.
  if (!extOk) {
    return `"${file.name}" isn't a supported format. ${policy.label} accepts ${policy.formats.join(', ')} only.`;
  }
  return null;
};

const formatFileSize = (bytes) => {
  if (bytes === 0 || bytes === undefined) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const fileIconFor = (filename = '') => {
  const ext = getExtension(filename);
  if (ext === '.pptx') return { Icon: Presentation, tint: 'text-orange-600', bg: 'bg-orange-50' };
  if (ext === '.xlsx') return { Icon: FileSpreadsheet, tint: 'text-emerald-600', bg: 'bg-emerald-50' };
  return { Icon: FileText, tint: 'text-red-600', bg: 'bg-red-50' }; // pdf / docx
};

// Professional drag-and-drop upload slot with inline validation, a file
// preview card once a file is attached, and format badges so the
// requirement is visible before the person even clicks.
const UploadSlot = ({ policyKey, file, onFileSelected, onRemove, stepBadge, locked }) => {
  const policy = FILE_POLICIES[policyKey];
  const inputRef = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleFiles = (fileList) => {
    if (locked) return;
    const selected = fileList?.[0];
    if (!selected) return;
    const err = validateFile(selected, policyKey);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError('');
    onFileSelected(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  if (file) {
    const { Icon, tint, bg } = fileIconFor(file.name);
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${bg}`}>
            <Icon className={`w-5 h-5 ${tint}`} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" strokeWidth={2} />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${file.name}`}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => !locked && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (!locked) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (!locked && (e.key === 'Enter' || e.key === ' ')) inputRef.current.click(); }}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${locked ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50/50' :
            isDragging ? 'border-red-500 bg-red-50/60 scale-[1.01] cursor-pointer' :
            localError ? 'border-orange-300 bg-orange-50/30 cursor-pointer' :
            'border-gray-300 bg-gray-50/50 hover:border-red-300 hover:bg-red-50/20 cursor-pointer'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={policy.accept}
          className="hidden"
          disabled={locked}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{stepBadge}</span>
        </div>
        <div className={`mx-auto w-11 h-11 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragging ? 'bg-red-100' : 'bg-white border border-gray-200'}`}>
          <UploadCloud className={`w-5 h-5 ${isDragging ? 'text-red-600' : 'text-gray-400'}`} strokeWidth={1.75} />
        </div>
        <p className="font-semibold text-gray-800 text-sm">{policy.instruction}</p>
        <p className="text-xs text-gray-400 mt-1">Drag & drop, or click to browse</p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {policy.formats.map((f) => (
            <span key={f} className="text-[10px] font-bold tracking-wide text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>
      {localError && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-orange-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {localError}
        </p>
      )}
    </div>
  );
};

=======
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
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
<<<<<<< HEAD

  // Interactive Step Variables for TOS
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [totalPoints, setTotalPoints] = useState('50');
  const [subcolumnAValues, setSubcolumnAValues] = useState({});

=======
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
  const [totalItems, setTotalItems] = useState('');
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
<<<<<<< HEAD
  const [previewBloomTab, setPreviewBloomTab] = useState('Remember');

=======

  const moduleInputRef = useRef();
  const syllabusInputRef = useRef();

  // Load active global subject filters from question bank configurations on tab mounts
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
<<<<<<< HEAD
      const response = await fetch(`${API_URL}/subjects`);
=======
      const response = await fetch(`${API_URL}/api/subjects`);
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
      if (!response.ok) throw new Error('Failed to synchronize subject matrix context data records.');
      const data = await response.json();
      setSubjects(data);
    } catch (err) {
      setError('Could not establish persistent communication hooks with active subjects database schemas.');
    }
  };

<<<<<<< HEAD
  // Continuous loopahead verification check to eliminate identical duplicate item additions
=======
  // Perform continuous lookahead checking on keystroke breaks to ensure "same thoughts" don't match existing vectors
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
  useEffect(() => {
    if (manualQuestion.trim().length < 10 || !selectedSubject) {
      setDuplicateWarning('');
      return;
    }
<<<<<<< HEAD

    const delayDebounceCheck = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/questions?subject_id=${selectedSubject}`);
        if (response.ok) {
          const matchingQuestionBankItems = await response.json();
          const targetInputText = manualQuestion.trim().toLowerCase();

          const isDuplicateThought = matchingQuestionBankItems.some(q =>
            q.question.toLowerCase().includes(targetInputText) ||
=======
    
    const delayDebounceCheck = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/questions?subject_id=${selectedSubject}`);
        if (response.ok) {
          const matchingQuestionBankItems = await response.json();
          const targetInputText = manualQuestion.trim().toLowerCase();
          
          // Checks for exact or close structural sentence phrasing similarities matching bank schemas
          const isDuplicateThought = matchingQuestionBankItems.some(q => 
            q.question.toLowerCase().includes(targetInputText) || 
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
            targetInputText.includes(q.question.toLowerCase())
          );

          if (isDuplicateThought) {
            setDuplicateWarning('⚠️ A question item with this identical concept or matching core text already exists within this subject layout block.');
          } else {
            setDuplicateWarning('');
          }
        }
      } catch (err) {
<<<<<<< HEAD
        console.error("Lookahead query safety verification exception:", err);
      }
    }, 600);
=======
        console.error("Lookahead query safety verification check encountered an unexpected routing exception:", err);
      }
    }, 600); // 600ms input debounce delay tracker
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843

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

<<<<<<< HEAD
  const handleCreateCustomSubject = async (e) => {
=======
const handleCreateCustomSubject = async (e) => {
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    setError('');
    setSuccessMessage('');
    try {
<<<<<<< HEAD
      const response = await fetch(`${API_URL}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
=======
      // Pointing cleanly to your new dedicated API endpoint handler
      const response = await fetch(`${API_URL}/api/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
        body: JSON.stringify({
          name: newSubjectName.trim(),
          code: newSubjectCode.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to register subject.');

<<<<<<< HEAD
      setSubjects(prev => [...prev, data]);
      setSelectedSubject(data.id);
=======
      // Capture the exact database structural id from the response payload
      setSubjects(prev => [...prev, data]);
      setSelectedSubject(data.id); 
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
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
<<<<<<< HEAD
      setError('Question workspace cannot be submitted while empty.');
=======
      setError('Question block workspace cannot be submitted while empty.');
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
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
<<<<<<< HEAD
      const response = await fetch(`${API_URL}/questions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
=======
      const response = await fetch(`${API_URL}/api/questions/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
        body: JSON.stringify({
          question: manualQuestion.trim(),
          question_type: manualQuestionType,
          subject_id: parseInt(selectedSubject),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Classification engine execution failed.');
<<<<<<< HEAD

=======
      
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
      setSuccessMessage(`🎉 Success! Machine Learning model analyzed the structure and placed the item into the "${data.bloom_level}" taxonomy rank tier inside your question bank.`);
      setManualQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setClassifying(false);
    }
  };

<<<<<<< HEAD
  // Clears everything downstream of the upload step, so the person can
  // swap a file and re-run analysis from scratch.
  const resetUploadState = () => {
    setUploadResult(null);
    setGenerationResult(null);
    setSelectedTopics([]);
    setSubcolumnAValues({});
=======
  const toggleQuestionType = (value) => {
    setSelectedQuestionTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
  };

  const handleUpload = async () => {
    if (!moduleFile || !syllabusFile) {
      setError('Please upload both module and syllabus files.');
      return;
    }
<<<<<<< HEAD
    // Defense in depth: re-validate right before submitting, in case a file
    // was attached programmatically or the input's accept filter was bypassed.
    const moduleErr = validateFile(moduleFile, 'module');
    const syllabusErr = validateFile(syllabusFile, 'syllabus');
    if (moduleErr || syllabusErr) {
      setError(moduleErr || syllabusErr);
      return;
    }

    setError('');
    setUploading(true);
    setUploadResult(null);
    setGenerationResult(null);
=======
    setError('');
    setUploading(true);
    setUploadResult(null);
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843

    try {
      const formData = new FormData();
      formData.append('module_file', moduleFile);
      formData.append('syllabus_file', syllabusFile);

<<<<<<< HEAD
      const response = await fetch(`${API_URL}/questions/upload`, {
=======
      const response = await fetch(`${API_URL}/api/upload`, {
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');
<<<<<<< HEAD

      setUploadResult(data);
      if (data.topics) {
        setSelectedTopics(data.topics.map((_, idx) => idx));
        const initialHours = {};
        data.topics.forEach((_, idx) => { initialHours[idx] = '3.0'; });
        setSubcolumnAValues(initialHours);
      }
=======
      setUploadResult(data);
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

<<<<<<< HEAD
  const toggleTopicSelection = (index) => {
    setSelectedTopics(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleSubcolumnAChange = (index, value) => {
    setSubcolumnAValues(prev => ({ ...prev, [index]: value }));
  };

=======
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
  const handleGenerate = async () => {
    if (!totalItems || totalItems < 1) {
      setError('Please enter a valid number of items.');
      return;
    }
<<<<<<< HEAD
    if (selectedTopics.length === 0) {
      setError('Please select at least one Main Topic to include in the TOS layout matrix.');
      return;
    }
    if (selectedQuestionTypes.length === 0) {
      setError('Please select at least one question type to include in the generated assessment.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setGenerating(true);

    try {
      const payload = {
        upload_id: uploadResult.upload_id,
        total_items: parseInt(totalItems),
        whole_total_points: parseInt(totalPoints),
        question_types: selectedQuestionTypes,
        selected_topic_indices: selectedTopics,
        subcolumn_a_hours: subcolumnAValues,
      };

      const response = await fetch(`${API_URL}/questions/generate-with-tos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // CATCH STATUS ERRORS BEFORE PARSING
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 502) {
          throw new Error(errData.detail || 'The AI Service is currently rate-limited or timed out. Please wait a few moments and try generating again.');
        }
        throw new Error(errData.detail || `Generation failed with server status code: ${response.status}`);
      }

      const data = await response.json();
      setGenerationResult(data);
      setSuccessMessage('🎉 Matrix TOS mapped and questions populated to the database store successfully!');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during matrix generation.');
      console.error("TOS Generation Error:", err);
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
    } finally {
      setGenerating(false);
    }
  };

<<<<<<< HEAD
  const downloadFile = async (endpoint, filename) => {
    try {
      const response = await fetch(`${API_URL}/questions/export/${endpoint}?upload_id=${uploadResult.upload_id}`, {
        method: 'GET',
      });
      if (!response.ok) throw new Error('Failed to retrieve file asset binary records.');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    }
  };

=======
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
  return (
    <div className="max-w-5xl w-full p-2">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
<<<<<<< HEAD
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${activeTab === 'manual' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
=======
            className={`py-3 px-6 font-medium text-sm transition-colors ${
              activeTab === 'manual'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
            onClick={() => {
              setActiveTab('manual');
              setError('');
              setSuccessMessage('');
            }}
          >
            Input Manually
          </button>
          <button
<<<<<<< HEAD
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${activeTab === 'upload' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
=======
            className={`py-3 px-6 font-medium text-sm transition-colors ${
              activeTab === 'upload'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
            onClick={() => {
              setActiveTab('upload');
              setError('');
              setSuccessMessage('');
            }}
          >
<<<<<<< HEAD
            Upload File & Generate TOS
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>}
        {successMessage && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">{successMessage}</div>}

        {/* MANUAL WORKSPACE TAB */}
        {activeTab === 'manual' && (
          <div className="space-y-6">
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Target Course Subject</label>
                <select
                  className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400 cursor-pointer"
                  value={selectedSubject}
                  onChange={handleSubjectDropdownChange}
                >
<<<<<<< HEAD
                  <option value="">— Select Associated Subject —</option>
=======
                  <option value="">— Select Associated Subject Framework —</option>
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
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

<<<<<<< HEAD
            {isAddingNewSubject && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase">Register New Curricular Course Component</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Subject Title (e.g., Software Engineering)" className="border rounded px-3 py-2 text-sm focus:border-red-400 outline-none" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
                  <input type="text" placeholder="Subject Key Code (e.g., COMSCI302)" className="border rounded px-3 py-2 text-sm focus:border-red-400 outline-none" value={newSubjectCode} onChange={(e) => setNewSubjectCode(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsAddingNewSubject(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md font-medium">Cancel</button>
                  <button onClick={handleCreateCustomSubject} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-md font-medium">Save Subject</button>
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
                </div>
              </div>
            )}

<<<<<<< HEAD
            <div className="relative">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Question Input Content Area</label>
              <textarea
                className={`w-full h-44 p-4 border rounded-md focus:ring-1 outline-none resize-none text-gray-700 text-sm transition-all ${duplicateWarning ? 'border-orange-400 bg-orange-50/10' : 'border-gray-200 focus:border-red-500'}`}
                placeholder="Type your manual assessment question here..."
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
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
<<<<<<< HEAD
              <button onClick={handleManualClassification} disabled={classifying || !!duplicateWarning || !manualQuestion.trim() || !selectedSubject} className="bg-[#b90000] hover:bg-[#990000] text-white font-medium text-sm py-2.5 px-6 rounded-md disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {classifying ? 'Running ML Classifiers...' : 'Classify & Save Question'}
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
              </button>
            </div>
          </div>
        )}

<<<<<<< HEAD
        {/* AUTOMATED UPLOAD & GEN TAB */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
=======
        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div className="space-y-6">

>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
            {/* Step 1: Upload Files */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
<<<<<<< HEAD
                Upload Educational Material Assets
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UploadSlot
                  policyKey="module"
                  file={moduleFile}
                  stepBadge="Module"
                  locked={!!uploadResult}
                  onFileSelected={(f) => { setModuleFile(f); setError(''); }}
                  onRemove={() => { setModuleFile(null); resetUploadState(); }}
                />
                <UploadSlot
                  policyKey="syllabus"
                  file={syllabusFile}
                  stepBadge="CIS / Syllabus"
                  locked={!!uploadResult}
                  onFileSelected={(f) => { setSyllabusFile(f); setError(''); }}
                  onRemove={() => { setSyllabusFile(null); resetUploadState(); }}
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading || !moduleFile || !syllabusFile || !!uploadResult}
                className="mt-4 w-full bg-[#b90000] text-white py-3 rounded-md text-sm font-medium disabled:bg-gray-300 transition-colors"
              >
                {uploading
                  ? 'Processing & Analyzing Core Documents...'
                  : uploadResult
                    ? '✓ Files Analyzed — Remove a file above to redo'
                    : 'Upload & Analyze Files'}
              </button>
            </div>

            {/* Step 2: Topics Isolation */}
            {uploadResult && (
              <div className="border border-gray-200 rounded-lg p-5 space-y-6">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                  Configure Target Blueprint Parameters
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Whole Total Number of Points</label>
                    <input type="number" value={totalPoints} onChange={(e) => setTotalPoints(e.target.value)} className="w-full border border-gray-200 rounded-md p-2 text-sm focus:ring-1 focus:ring-red-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Total Intended Test Items</label>
                    <input type="number" value={totalItems} onChange={(e) => setTotalItems(e.target.value)} placeholder="e.g. 50" className="w-full border border-gray-200 rounded-md p-2 text-sm focus:ring-1 focus:ring-red-500 outline-none" />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-bold text-gray-600 uppercase mb-3">Target Question Formats</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUESTION_TYPE_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 text-xs text-gray-700 rounded-md border p-2 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={selectedQuestionTypes.includes(option.value)} onChange={() => {
                          setSelectedQuestionTypes(curr => curr.includes(option.value) ? curr.filter(x => x !== option.value) : [...curr, option.value]);
                        }} className="h-4 w-4 rounded text-red-600" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-3">Isolate Main Syllabus Topics & Input Subcolumn A (Hours Taught)</p>
                  <div className="space-y-3">
                    {uploadResult.topics.map((topic, i) => (
                      <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-3 gap-3 last:border-0">
                        <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-gray-700 max-w-xl">
                          <input type="checkbox" checked={selectedTopics.includes(i)} onChange={() => toggleTopicSelection(i)} className="h-4 w-4 text-red-600 rounded" disabled={!!generationResult} />
                          <div>
                            <p className="font-semibold text-gray-800">{topic.name}</p>
                            <p className="text-xs text-gray-400 italic font-normal">Extracted ILO: {topic.ilo}</p>
                          </div>
                        </label>
                        {selectedTopics.includes(i) && (
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <span className="text-xs text-gray-500 font-semibold">Hours Covered (A):</span>
                            <input type="number" step="0.5" value={subcolumnAValues[i] || ''} onChange={(e) => handleSubcolumnAChange(i, e.target.value)} className="w-16 border rounded p-1 text-center text-sm outline-none" disabled={!!generationResult} />
                          </div>
                        )}
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
                      </div>
                    ))}
                  </div>
                </div>

<<<<<<< HEAD
                <button
                  onClick={handleGenerate}
                  disabled={generating || selectedTopics.length === 0 || !totalItems || !!generationResult}
                  className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-md text-sm font-medium transition-colors disabled:bg-gray-300"
                >
                  {generating
                    ? 'Running Deep Taxonomy Synthesis...'
                    : generationResult
                      ? '✓ Matrix TOS & Assessment Generated'
                      : 'Generate Matrix TOS & Assessment Instruments'}
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
                </button>
              </div>
            )}

<<<<<<< HEAD
            {/* Step 3: Outputs Preview & Download Links */}
            {generationResult && (
              <div className="border border-green-200 bg-green-50/30 rounded-lg p-5 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3">
                  <div>
                    <h3 className="font-bold text-green-800 text-sm">✓ Table of Specifications & Question Sheets Matrix Saved</h3>
                    <p className="text-xs text-gray-500">Items successfully saved inside the primary Question Bank registry rows.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => downloadFile('tos', 'BatStateU_Standard_TOS.xlsx')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded font-medium shadow-sm transition-colors">Download Institutional TOS (.xlsx)</button>
                    <button onClick={() => downloadFile('assessment/docx', 'Exam_Paper_With_Keys.docx')} className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 rounded font-medium shadow-sm transition-colors">Download Test (.docx)</button>
                    <button onClick={() => downloadFile('assessment/pdf', 'Exam_Paper_With_Keys.pdf')} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded font-medium shadow-sm transition-colors">Download Test (.pdf)</button>
                  </div>
                </div>

                {/* TOS Summary Section */}
                {generationResult.tos && generationResult.tos.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">Table of Specifications Summary</h4>
                        <p className="text-xs text-gray-500">This summary reflects the topic distribution, Bloom&apos;s taxonomy weights, and item counts used to generate the assessment.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total Generated Questions</p>
                        <p className="text-lg font-semibold text-green-700">{generationResult.total_questions}</p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {generationResult.tos.map((topic, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{topic.topic}</p>
                              <p className="text-xs text-gray-500 mt-1">{topic.ilo || 'No ILO provided'}</p>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              <p><span className="font-semibold text-gray-700">Items:</span> {topic.total_items}</p>
                              <p><span className="font-semibold text-gray-700">Weight:</span> {topic.weight}%</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            {Object.entries(topic.bloom_breakdown || {}).map(([bloom, row]) => (
                              <div key={bloom} className="rounded-md border border-gray-200 bg-white px-2 py-1">
                                <p className="font-semibold text-gray-800">{bloom}</p>
                                <p>{row.total} item{row.total === 1 ? '' : 's'}</p>
                              </div>
                            ))}
                          </div>
=======
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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
                        </div>
                      ))}
                    </div>
                  </div>
<<<<<<< HEAD
                )}

                {/* Cognitive Taxonomy Group Preview Tabs */}
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-3">Generated Preview Segmented By Cognitive Taxonomy Tier</p>
                  <div className="flex border-b overflow-x-auto gap-2 bg-gray-100/50 p-1 rounded-t-md">
                    {BLOOMS_LEVELS.map(level => {
                      const count = (generationResult.questions_preview || []).filter(q => q.bloom_level === level).length;
                      return (
                        <button key={level} onClick={() => setPreviewBloomTab(level)} className={`py-2 px-4 text-xs font-semibold rounded-t transition-all min-w-max ${previewBloomTab === level ? 'bg-white text-red-600 shadow-sm font-bold border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
                          {level} <span className="ml-1 bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bg-white p-4 border-x border-b rounded-b-md max-h-80 overflow-y-auto space-y-4 shadow-inner">
                    {(generationResult.questions_preview || [])
                      .filter(q => q.bloom_level === previewBloomTab)
                      .map((q, idx) => (
                        <div key={idx} className="p-3 border rounded-md bg-gray-50/50 text-sm">
                          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                            <span>Syllabus Reference: <strong className="text-gray-600">{q.topic_name}</strong></span>
                            <span className="bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded uppercase">{q.type}</span>
                          </div>
                          <p className="font-medium text-gray-800">{idx + 1}. {q.question}</p>
                          <p className="text-xs text-green-700 font-bold mt-2 bg-green-50 border border-green-100 inline-block px-2 py-0.5 rounded">✓ Answer Key: {q.correct_answer}</p>
                        </div>
                    ))}
                  </div>
                </div>

=======

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
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default InputQuestion;