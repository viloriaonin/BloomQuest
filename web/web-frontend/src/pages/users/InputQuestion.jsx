import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, FileSpreadsheet, Presentation, X, CheckCircle2, AlertCircle } from 'lucide-react';

const API_URL = '/api';
const BLOOMS_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
const QUESTION_TYPE_OPTIONS = [
  { label: 'Multiple Choice', value: 'MCQ' },
  { label: 'True or False', value: 'True or False' },
  { label: 'Identification', value: 'Identification' },
  { label: 'Matching Type', value: 'Matching Type' },
  { label: 'Enumeration', value: 'Enumeration' },
  { label: 'Essay', value: 'Essay' },
  { label: 'Situational', value: 'Situational' },
];

// File-type policies for each upload slot. Extension is checked rather than
// relying purely on MIME type, since browsers/OS report MIME inconsistently
// for Office formats (especially on Windows).
const FILE_POLICIES = {
  module: {
    label: 'Module',
    instruction: 'Upload the learning module or instructional content file',
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
    instruction: 'Upload the Course Information Syllabus',
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

const INPUT_QUESTION_SESSION_KEY = 'bloomquest_input_question_session';

const serializeFile = (file) => {
  if (!file) return null;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
};

const restoreFile = (fileData) => {
  if (!fileData) return null;
  return new File([], fileData.name, {
    type: fileData.type || '',
    lastModified: fileData.lastModified || Date.now(),
  });
};

const getExtension = (filename = '') => {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx).toLowerCase();
};

const isImageFile = (file) => {
  const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
  return imageTypes.includes(file.type) || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff'].includes(getExtension(file.name));
};

const validateFile = (file, policyKey) => {
  const policy = FILE_POLICIES[policyKey];
  const ext = getExtension(file.name);
  const extOk = policy.extensions.includes(ext);
  if (isImageFile(file)) {
    return `"${file.name}" is an image file. Please upload a ${policy.formats.join(', ')} document instead.`;
  }
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

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  if (typeof error?.detail === 'string') return error.detail;
  if (Array.isArray(error?.detail)) {
    return error.detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.msg === 'string') return item.msg;
        if (typeof item?.detail === 'string') return item.detail;
        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join(' ');
  }
  if (Array.isArray(error)) {
    return error
      .map((item) => getErrorMessage(item))
      .filter(Boolean)
      .join(' ');
  }
  if (typeof error?.detail === 'object') {
    return JSON.stringify(error.detail);
  }
  if (typeof error === 'object') {
    return JSON.stringify(error);
  }
  return 'An unexpected error occurred.';
};

const fileIconFor = (filename = '') => {
  const ext = getExtension(filename);
  if (ext === '.pptx') return { Icon: Presentation, tint: 'text-orange-600', bg: 'bg-orange-50' };
  if (ext === '.xlsx') return { Icon: FileSpreadsheet, tint: 'text-emerald-600', bg: 'bg-emerald-50' };
  return { Icon: FileText, tint: 'text-red-600', bg: 'bg-red-50' }; 
};

const safeRenderValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(safeRenderValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return Object.values(value).map(safeRenderValue).filter(Boolean).join(' / ');
  return String(value);
};

// Professional drag-and-drop upload slot with inline validation
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

const InputQuestion = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

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

  // Interactive Step Variables for TOS
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [totalPoints, setTotalPoints] = useState('50');
  const [subcolumnAValues, setSubcolumnAValues] = useState({});
  const [totalItems, setTotalItems] = useState('');
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [previewBloomTab, setPreviewBloomTab] = useState('Remember'); // Syntax Error Fixed Here
  const uploadAbortControllerRef = useRef(null);

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    return () => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(INPUT_QUESTION_SESSION_KEY);
      if (!stored) {
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(stored);
      if (parsed.activeTab) setActiveTab(parsed.activeTab);
      if (parsed.moduleFile) setModuleFile(restoreFile(parsed.moduleFile));
      if (parsed.syllabusFile) setSyllabusFile(restoreFile(parsed.syllabusFile));
      if (parsed.uploadResult) setUploadResult(parsed.uploadResult);
      if (parsed.generationResult) setGenerationResult(parsed.generationResult);
      if (Array.isArray(parsed.selectedTopics)) setSelectedTopics(parsed.selectedTopics);
      if (parsed.subcolumnAValues) setSubcolumnAValues(parsed.subcolumnAValues);
      if (Array.isArray(parsed.selectedQuestionTypes)) setSelectedQuestionTypes(parsed.selectedQuestionTypes);
      if (parsed.totalPoints !== undefined) setTotalPoints(parsed.totalPoints);
      if (parsed.totalItems !== undefined) setTotalItems(parsed.totalItems);
      if (parsed.previewBloomTab) setPreviewBloomTab(parsed.previewBloomTab);
      if (parsed.uploading !== undefined) setUploading(parsed.uploading);
      if (parsed.generating !== undefined) setGenerating(parsed.generating);
      if (parsed.error) setError(parsed.error);
      if (parsed.successMessage) setSuccessMessage(parsed.successMessage);
    } catch (err) {
      console.error('Failed to restore input question session state:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const persistInputQuestionSession = React.useCallback((overrides = {}) => {
    const snapshot = {
      activeTab,
      moduleFile: serializeFile(moduleFile),
      syllabusFile: serializeFile(syllabusFile),
      uploading,
      generating,
      uploadResult,
      generationResult,
      selectedTopics,
      subcolumnAValues,
      selectedQuestionTypes,
      totalPoints,
      totalItems,
      previewBloomTab,
      error,
      successMessage,
      ...overrides,
    };

    sessionStorage.setItem(INPUT_QUESTION_SESSION_KEY, JSON.stringify(snapshot));
  }, [
    activeTab,
    moduleFile,
    syllabusFile,
    uploading,
    generating,
    uploadResult,
    generationResult,
    selectedTopics,
    subcolumnAValues,
    selectedQuestionTypes,
    totalPoints,
    totalItems,
    previewBloomTab,
    error,
    successMessage,
  ]);

  useEffect(() => {
    if (!isHydrated) return;
    persistInputQuestionSession();
  }, [
    isHydrated,
    activeTab,
    moduleFile,
    syllabusFile,
    uploadResult,
    generationResult,
    selectedTopics,
    subcolumnAValues,
    selectedQuestionTypes,
    totalPoints,
    totalItems,
    previewBloomTab,
    uploading,
    generating,
    error,
    successMessage,
    persistInputQuestionSession,
  ]);

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`${API_URL}/subjects`);
      if (!response.ok) throw new Error('Failed to synchronize subject matrix context data records.');
      const data = await response.json();
      setSubjects(data);
    } catch (err) {
      setError('Could not establish persistent communication hooks with active subjects database schemas.');
    }
  };

  // Continuous loopahead verification check to eliminate identical duplicate item additions
  useEffect(() => {
    if (manualQuestion.trim().length < 10 || !selectedSubject) {
      setDuplicateWarning('');
      return;
    }

    const delayDebounceCheck = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/questions?subject_id=${selectedSubject}`);
        if (response.ok) {
          const matchingQuestionBankItems = await response.json();
          const targetInputText = manualQuestion.trim().toLowerCase();

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
        console.error("Lookahead query safety verification exception:", err);
      }
    }, 600);

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
      const response = await fetch(`${API_URL}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubjectName.trim(),
          code: newSubjectCode.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to register subject.');

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
      setError('Question workspace cannot be submitted while empty.');
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
      const response = await fetch(`${API_URL}/questions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const cancelActiveAnalysis = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }

    setUploading(false);
    setGenerating(false);
    setUploadResult(null);
    setGenerationResult(null);
    setSelectedTopics([]);
    setSubcolumnAValues({});
    setError('Analysis cancelled. You can remove the uploaded files and try again.');
    persistInputQuestionSession({
      activeTab: 'upload',
      uploading: false,
      generating: false,
      uploadResult: null,
      generationResult: null,
      selectedTopics: [],
      subcolumnAValues: {},
      error: 'Analysis cancelled. You can remove the uploaded files and try again.',
    });
  };

  const resetUploadState = () => {
    setUploadResult(null);
    setGenerationResult(null);
    setSelectedTopics([]);
    setSubcolumnAValues({});
    persistInputQuestionSession({
      uploadResult: null,
      generationResult: null,
      selectedTopics: [],
      subcolumnAValues: {},
    });
  };

  const handleFileRemove = (policyKey) => {
    if (policyKey === 'module') {
      setModuleFile(null);
    } else {
      setSyllabusFile(null);
    }

    if (uploading || generating) {
      cancelActiveAnalysis();
      setModuleFile(null);
      setSyllabusFile(null);
      return;
    }

    resetUploadState();
  };

  const handleUpload = async () => {
    if (!moduleFile || !syllabusFile) {
      setError('Please upload both module and syllabus files.');
      return;
    }
    
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
    persistInputQuestionSession({
      activeTab: 'upload',
      uploading: true,
      generating: false,
      uploadResult: null,
      generationResult: null,
      selectedTopics: [],
      subcolumnAValues: {},
    });

    try {
      const formData = new FormData();
      formData.append('module_file', moduleFile);
      formData.append('syllabus_file', syllabusFile);

      uploadAbortControllerRef.current = new AbortController();
      const response = await fetch(`${API_URL}/questions/upload`, {
        method: 'POST',
        body: formData,
        signal: uploadAbortControllerRef.current.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(data) || 'Upload failed');

      setUploadResult(data);
      if (data.topics) {
        const nextSelectedTopics = data.topics.map((_, idx) => idx);
        const initialHours = {};
        data.topics.forEach((_, idx) => { initialHours[idx] = '3.0'; });
        setSelectedTopics(nextSelectedTopics);
        setSubcolumnAValues(initialHours);
      }
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
        uploadResult: data,
        generationResult: null,
        selectedTopics: data.topics ? data.topics.map((_, idx) => idx) : [],
        subcolumnAValues: data.topics ? Object.fromEntries(data.topics.map((_, idx) => [idx, '3.0'])) : {},
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Analysis cancelled. You can remove the uploaded files and try again.');
        persistInputQuestionSession({
          activeTab: 'upload',
          uploading: false,
          generating: false,
          error: 'Analysis cancelled. You can remove the uploaded files and try again.',
        });
        return;
      }

      setError(err.message);
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
        error: err.message,
      });
    } finally {
      setUploading(false);
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current = null;
      }
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
      });
    }
  };

  const toggleTopicSelection = (index) => {
    setSelectedTopics(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleSubcolumnAChange = (index, value) => {
    setSubcolumnAValues(prev => ({ ...prev, [index]: value }));
  };

  const handleGenerate = async () => {
    const intTotalItems = parseInt(totalItems, 10);
    const intTotalPoints = parseInt(totalPoints, 10);

    if (!Number.isInteger(intTotalItems) || intTotalItems < 1) {
      setError('Please enter a valid number of items.');
      return;
    }
    if (!Number.isInteger(intTotalPoints) || intTotalPoints < 1 || intTotalPoints > 1000) {
      setError('Please enter a valid total points value between 1 and 1000.');
      return;
    }
    if (selectedTopics.length === 0) {
      setError('Please select at least one Main Topic to include in the TOS layout matrix.');
      return;
    }
    if (selectedQuestionTypes.length === 0) {
      setError('Please select at least one question type to include in the generated assessment.');
      return;
    }
    const allowedQuestionTypes = QUESTION_TYPE_OPTIONS.map((opt) => opt.value);
    if (!selectedQuestionTypes.every((type) => allowedQuestionTypes.includes(type))) {
      setError('One or more selected question types are invalid.');
      return;
    }
    const invalidHours = Object.entries(subcolumnAValues).some(([, value]) => {
      const num = parseFloat(value);
      return Number.isNaN(num) || num <= 0;
    });
    if (invalidHours) {
      setError('Please enter a valid positive number of hours for each selected topic.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setGenerating(true);
    persistInputQuestionSession({
      activeTab: 'upload',
      uploading: false,
      generating: true,
    });

    try {
      const payload = {
        upload_id: uploadResult.upload_id,
        total_items: intTotalItems,
        whole_total_points: intTotalPoints,
        question_types: selectedQuestionTypes,
        selected_topic_indices: selectedTopics,
        subcolumn_a_hours: Object.fromEntries(
          Object.entries(subcolumnAValues).map(([key, value]) => [String(key), String(value)])
        ),
      };

      const response = await fetch(`${API_URL}/questions/generate-with-tos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message = getErrorMessage(errData) || `Generation failed with server status code: ${response.status}`;
        if (response.status === 502) {
          throw new Error(message || 'The AI Service is currently rate-limited or timed out. Please wait a few moments and try generating again.');
        }
        throw new Error(message);
      }

      const data = await response.json();
      setGenerationResult(data);
      setSuccessMessage('🎉 Matrix TOS mapped and questions populated to the database store successfully!');
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
        generationResult: data,
      });
    } catch (err) {
      const normalizedError = getErrorMessage(err) || 'An unexpected error occurred during matrix generation.';
      setError(normalizedError);
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
        error: normalizedError,
      });
      console.error("TOS Generation Error:", err);
    } finally {
      setGenerating(false);
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
      });
    }
  };

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

  return (
    <div className="max-w-5xl w-full p-2 h-full flex flex-col min-h-0 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex-1 mb-6">

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${activeTab === 'manual' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => {
              setActiveTab('manual');
              setError('');
              setSuccessMessage('');
            }}
          >
            Input Manually
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${activeTab === 'upload' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => {
              setActiveTab('upload');
              setError('');
              setSuccessMessage('');
            }}
          >
            Upload File & Generate TOS
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>}
        {successMessage && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">{successMessage}</div>}

        {/* MANUAL WORKSPACE TAB */}
        {activeTab === 'manual' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Target Course Subject</label>
                <select
                  className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400 cursor-pointer"
                  value={selectedSubject}
                  onChange={handleSubjectDropdownChange}
                >
                  <option value="">— Select Associated Subject —</option>
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
                </div>
              </div>
            )}

            <div className="relative">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Question Input Content Area</label>
              <textarea
                className={`w-full h-44 p-4 border rounded-md focus:ring-1 outline-none resize-none text-gray-700 text-sm transition-all ${duplicateWarning ? 'border-orange-400 bg-orange-50/10' : 'border-gray-200 focus:border-red-500'}`}
                placeholder="Type your manual assessment question here..."
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
              <button onClick={handleManualClassification} disabled={classifying || !!duplicateWarning || !manualQuestion.trim() || !selectedSubject} className="bg-[#b90000] hover:bg-[#990000] text-white font-medium text-sm py-2.5 px-6 rounded-md disabled:bg-gray-200 disabled:text-gray-400 transition-colors flex items-center gap-2">
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

        {/* AUTOMATED UPLOAD & GEN TAB */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            
            {/* Step 1: Upload Files */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                Upload Educational Material Assets
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UploadSlot
                  policyKey="module"
                  file={moduleFile}
                  stepBadge="Module"
                  locked={!!uploadResult}
                  onFileSelected={(f) => { setModuleFile(f); setError(''); }}
                  onRemove={() => handleFileRemove('module')}
                />
                <UploadSlot
                  policyKey="syllabus"
                  file={syllabusFile}
                  stepBadge="CIS / Syllabus"
                  locked={!!uploadResult}
                  onFileSelected={(f) => { setSyllabusFile(f); setError(''); }}
                  onRemove={() => handleFileRemove('syllabus')}
                />
              </div>
              {uploading && (
                <div className="mt-4 flex items-center justify-between rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
                  <p className="text-sm text-orange-700">Analysis is still running. You can stop it and reset the upload.</p>
                  <button
                    type="button"
                    onClick={cancelActiveAnalysis}
                    className="text-sm font-semibold text-orange-700 hover:text-orange-800"
                  >
                    Cancel Analysis
                  </button>
                </div>
              )}
              <button
                onClick={handleUpload}
                disabled={uploading || !moduleFile || !syllabusFile || !!uploadResult}
                className="mt-4 w-full bg-[#b90000] text-white py-3 rounded-md text-sm font-medium disabled:bg-gray-300 transition-colors flex justify-center items-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Processing & Analyzing Core Documents...
                  </>
                ) : uploadResult ? '✓ Files Analyzed — Remove a file above to redo' : 'Analyze Files'}
              </button>
            </div>

            {/* Config Steps appear ONLY after successful upload */}
            {uploadResult && (
              <div className="space-y-6">
                
                {/* Step 2: Question Types Selection */}
                <div className="border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                    Question Types Selection
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUESTION_TYPE_OPTIONS.map((option) => {
                      const isChecked = selectedQuestionTypes.includes(option.value);
                      return (
                        <label key={option.value} className={`flex items-center gap-2 text-xs font-medium rounded-md border p-3 cursor-pointer transition-colors ${isChecked ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => {
                              setSelectedQuestionTypes(curr => curr.includes(option.value) ? curr.filter(x => x !== option.value) : [...curr, option.value]);
                            }} 
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" 
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Number of Items & Points */}
                <div className="border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                    Number of Items & Points
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Total Points</label>
                      <input type="number" value={totalPoints} onChange={(e) => setTotalPoints(e.target.value)} placeholder="e.g. 50" className="w-full border border-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Total Intended Test Items</label>
                      <input type="number" value={totalItems} onChange={(e) => setTotalItems(e.target.value)} placeholder="e.g. 50" className="w-full border border-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Step 4: Detected Subject & Main Topics */}
                <div className="border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
                    Detected Subject & Main Topics
                  </h3>
                  
                  {uploadResult.subject && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Subject Detected</p>
                      <p className="font-semibold text-gray-800 text-base">{uploadResult.subject.name}</p>
                      {uploadResult.subject.code && <p className="text-xs text-gray-500 mt-0.5">{uploadResult.subject.code}</p>}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase mb-3">Topics Detected & Hours Covered (A)</p>
                    <div className="space-y-3">
                      {uploadResult.topics.map((topic, i) => (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-3 gap-3">
                          <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-gray-700 flex-1 min-w-0">
                            <input type="checkbox" checked={selectedTopics.includes(i)} onChange={() => toggleTopicSelection(i)} className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500" disabled={!!generationResult} />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 truncate">{safeRenderValue(topic.name)}</p>
                              <p className="text-xs text-gray-400 italic font-normal truncate">ILO: {safeRenderValue(topic.ilo) || 'None'}</p>
                            </div>
                          </label>
                          {selectedTopics.includes(i) && (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Hours:</span>
                              <input type="number" step="0.5" value={subcolumnAValues[i] || ''} onChange={(e) => handleSubcolumnAChange(i, e.target.value)} className="w-16 border border-gray-200 rounded-md p-1.5 text-center text-sm outline-none focus:border-red-400" disabled={!!generationResult} />
                            </div>
                          )}
                          <div className="shrink-0 w-12 text-right">
                            <span className="text-xs font-bold text-red-600">{Math.round((topic.weight || 0) * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={generating || selectedTopics.length === 0 || !totalItems || !!generationResult}
                    className="mt-6 w-full bg-green-700 hover:bg-green-800 text-white py-3.5 rounded-md text-sm font-bold transition-colors disabled:bg-gray-300 flex justify-center items-center gap-2 shadow-sm"
                  >
                    {generating ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> 
                        Running Deep Taxonomy Synthesis...
                      </>
                    ) : generationResult ? '✓ Matrix TOS & Assessment Generated' : 'Generate Matrix TOS & Assessment Instruments'}
                  </button>
                </div>
              </div>
            )}

            {/* Output Previews & Download Links */}
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
                              <p className="text-sm font-semibold text-gray-800">{safeRenderValue(topic.topic)}</p>
                              <p className="text-xs text-gray-500 mt-1">{safeRenderValue(topic.ilo) || 'No ILO provided'}</p>
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
                        </div>
                      ))}
                    </div>
                  </div>
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
                            <span>Syllabus Reference: <strong className="text-gray-600">{safeRenderValue(q.topic_name)}</strong></span>
                            <span className="bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded uppercase">{safeRenderValue(q.type)}</span>
                          </div>
                          <p className="font-medium text-gray-800">{idx + 1}. {safeRenderValue(q.question)}</p>
                          <p className="text-xs text-green-700 font-bold mt-2 bg-green-50 border border-green-100 inline-block px-2 py-0.5 rounded">✓ Answer Key: {safeRenderValue(q.correct_answer)}</p>
                        </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default InputQuestion;