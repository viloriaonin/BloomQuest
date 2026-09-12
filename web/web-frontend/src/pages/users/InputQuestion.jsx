import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, FileSpreadsheet, Presentation, X, CheckCircle2, AlertCircle, Sparkles, PencilLine, FolderUp, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePopup } from '../../components/PopupProvider';

const API_URL = '/api';
const EXAM_TYPE_OPTIONS = ['Midterm Exam', 'Preliminary Exam', 'Final Exam', 'Quiz', 'Long Exam'];
const SEMESTER_OPTIONS = ['First Semester', 'Second Semester', 'Midterm Class'];
const PRIMARY = '#8F1424';
const pageBg = '#F6F7F9';

// Design tokens matching the dashboard theme
const border = 'rgba(15, 23, 42, 0.08)';

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

const parseApiResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
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

// Indeterminate progress bar components
const GeneratingProgress = ({ label = 'Generating…' }) => (
  <span className="flex items-center gap-2 w-full">
    <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
    <span className="relative h-2 flex-1 min-w-[60px] overflow-hidden rounded-full bg-white/30">
      <span
        className="absolute top-0 h-full rounded-full bg-white"
        style={{ animation: 'bq-indeterminate 1.2s ease-in-out infinite' }}
      />
    </span>
  </span>
);

// Indeterminate progress bar styles
const GeneratingBarStyles = () => (
  <style>{`
    @keyframes bq-indeterminate {
      0%   { left: -40%; width: 40%; }
      50%  { left: 20%;  width: 60%; }
      100% { left: 100%; width: 40%; }
    }
  `}</style>
);


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
  const navigate = useNavigate();
  const { showAlert } = usePopup();
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
  const [manualAnswerKey, setManualAnswerKey] = useState('');
  const [manualQuestionType, setManualQuestionType] = useState('MCQ');
  const [manualQuestionPoints, setManualQuestionPoints] = useState('');
  const [classifying, setClassifying] = useState(false);

  // Upload & Auto-Gen Tab States
  const [moduleFile, setModuleFile] = useState(null);
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const WIZARD_STEPS = [
    { number: 1, label: 'Upload' },
    { number: 2, label: 'Question Types' },
    { number: 3, label: 'Assessment Details' },
    { number: 4, label: 'Topics & Generate' },
  ];

  // Interactive Step Variables for TOS
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [totalPoints, setTotalPoints] = useState('');
  const [subcolumnAValues, setSubcolumnAValues] = useState({});
  const [totalItems, setTotalItems] = useState('');
  const [examType, setExamType] = useState('Final Exam');
  const [semester, setSemester] = useState('First Semester');
  const [academicYear, setAcademicYear] = useState('');
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState([]);
  const [questionTypePoints, setQuestionTypePoints] = useState({});
  const [questionTypeItems, setQuestionTypeItems] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [excludedQuestionIds, setExcludedQuestionIds] = useState([]);
  const [previewBloomTab, setPreviewBloomTab] = useState('Remember'); // Syntax Error Fixed Here
  const [generationProgress, setGenerationProgress] = useState(0);
  const uploadAbortControllerRef = useRef(null);

  useEffect(() => {
    const calculatedTotalItems = selectedQuestionTypes.reduce(
      (sum, type) => sum + (Number.parseInt(questionTypeItems[type], 10) || 0),
      0,
    );
    const calculatedTotalPoints = selectedQuestionTypes.reduce(
      (sum, type) => {
        const points = Number(questionTypePoints[type]);
        const items = Number.parseInt(questionTypeItems[type], 10);
        return sum + (Number.isFinite(points) && Number.isInteger(items) ? points * items : 0);
      },
      0,
    );

    setTotalItems(calculatedTotalItems > 0 ? String(calculatedTotalItems) : '');
    setTotalPoints(calculatedTotalPoints > 0 ? String(calculatedTotalPoints) : '');
  }, [selectedQuestionTypes, questionTypePoints, questionTypeItems]);

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
      if (parsed.wizardStep) setWizardStep(parsed.wizardStep);
      if (parsed.moduleFile) setModuleFile(restoreFile(parsed.moduleFile));
      if (parsed.syllabusFile) setSyllabusFile(restoreFile(parsed.syllabusFile));
      if (parsed.uploadResult) setUploadResult(parsed.uploadResult);
      if (parsed.generationResult) setGenerationResult(parsed.generationResult);
      if (Array.isArray(parsed.excludedQuestionIds)) setExcludedQuestionIds(parsed.excludedQuestionIds);
      if (Array.isArray(parsed.selectedTopics)) setSelectedTopics(parsed.selectedTopics);
      if (parsed.subcolumnAValues) setSubcolumnAValues(parsed.subcolumnAValues);
      if (Array.isArray(parsed.selectedQuestionTypes)) setSelectedQuestionTypes(parsed.selectedQuestionTypes);
      if (parsed.totalPoints !== undefined) setTotalPoints(parsed.totalPoints);
      if (parsed.totalItems !== undefined) setTotalItems(parsed.totalItems);
      if (parsed.examType) setExamType(parsed.examType);
      if (parsed.semester) setSemester(parsed.semester);
      if (parsed.academicYear !== undefined) setAcademicYear(parsed.academicYear);
      if (parsed.questionTypePoints) setQuestionTypePoints(parsed.questionTypePoints);
      if (parsed.questionTypeItems) setQuestionTypeItems(parsed.questionTypeItems);
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
      wizardStep,
      moduleFile: serializeFile(moduleFile),
      syllabusFile: serializeFile(syllabusFile),
      uploading,
      generating,
      uploadResult,
      generationResult,
      excludedQuestionIds,
      selectedTopics,
      subcolumnAValues,
      selectedQuestionTypes,
      totalPoints,
      totalItems,
      examType,
      semester,
      academicYear,
      questionTypePoints,
      questionTypeItems,
      previewBloomTab,
      error,
      successMessage,
      ...overrides,
    };

    sessionStorage.setItem(INPUT_QUESTION_SESSION_KEY, JSON.stringify(snapshot));
  }, [
    activeTab,
    wizardStep,
    moduleFile,
    syllabusFile,
    uploading,
    generating,
    uploadResult,
    generationResult,
    excludedQuestionIds,
    selectedTopics,
    subcolumnAValues,
    selectedQuestionTypes,
    totalPoints,
    totalItems,
    examType,
    semester,
    academicYear,
    questionTypePoints,
    questionTypeItems,
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
    wizardStep,
    moduleFile,
    syllabusFile,
    uploadResult,
    generationResult,
    selectedTopics,
    subcolumnAValues,
    selectedQuestionTypes,
    totalPoints,
    totalItems,
    examType,
    semester,
    academicYear,
    questionTypePoints,
    questionTypeItems,
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
      if (!response.ok) {
        const errData = await parseApiResponse(response);
        throw new Error(getErrorMessage(errData) || 'Failed to synchronize subject matrix context data records.');
      }
      const data = await parseApiResponse(response);
      setSubjects(data);
    } catch (err) {
      setError(err.message || 'Could not establish persistent communication hooks with active subjects database schemas.');
    }
  };

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

      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data) || 'Failed to register subject.');

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
    const normalizedManualQuestion = manualQuestion.trim().replace(/\s+/g, ' ');
    if (!normalizedManualQuestion || normalizedManualQuestion.length < 10 || !/[A-Za-z]/.test(normalizedManualQuestion)) {
      setError('The question should be in a proper format or structure. This question will not be classified or saved in the Question Bank.');
      return;
    }
    const normalizedManualAnswerKey = manualAnswerKey.trim().replace(/\s+/g, ' ');
    if (!normalizedManualAnswerKey) {
      setError('Please enter an answer key before classifying and saving the question.');
      return;
    }
    const manualPoints = Number(manualQuestionPoints);
    if (!Number.isFinite(manualPoints) || manualPoints <= 0 || manualPoints > 1000) {
      setError('Enter a valid points value between 0.01 and 1000 for this question type.');
      return;
    }
    const choicesFromQuestion = (value) => {
      const choices = [];
      const choicePattern = /(?:^|\s)([A-H])[.)]\s+(.+?)(?=\s+[A-H][.)]\s+|$)/g;
      let match;
      while ((match = choicePattern.exec(value)) !== null) choices.push(match[2].trim());
      return choices;
    };
    let manualOptions = null;
    let answerKeyToSave = normalizedManualAnswerKey;
    let questionToSave = normalizedManualQuestion;
    if (manualQuestionType === 'MCQ') {
      const detectedChoices = choicesFromQuestion(normalizedManualQuestion);
      if (detectedChoices.length < 2) {
        setError('Include the multiple-choice options in the question using A. Choice, B. Choice, and so on. The answer key should be one letter.');
        return;
      }
      const firstChoiceMarker = normalizedManualQuestion.search(/(?:^|\s)[A-H][.)]\s+/i);
      if (firstChoiceMarker !== -1) {
        questionToSave = normalizedManualQuestion.slice(0, firstChoiceMarker).trim();
      }
      manualOptions = detectedChoices;
    }
    if (manualQuestionType === 'Matching Type') {
      if (!/^[A-Za-z](?:\s*,\s*[A-Za-z])*\s*$/.test(normalizedManualAnswerKey)) {
        setError('For Matching Type, enter answer letters only, such as A, C, B, D.');
        return;
      }
    }
    setError('');
    setSuccessMessage('');
    setClassifying(true);

    try {
      const response = await fetch(`${API_URL}/questions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionToSave,
          correct_answer: answerKeyToSave,
          question_type: manualQuestionType,
          options: manualOptions,
          points: manualPoints,
          exam_type: examType,
          semester,
          academic_year: academicYear.trim(),
          subject_id: parseInt(selectedSubject),
          user_id: Number(localStorage.getItem('user_id')) || null,
        }),
      });

      const data = await parseApiResponse(response);
      if (!response.ok) {
        const validationMessage = getErrorMessage(data);
        throw new Error(
          validationMessage ||
          'The question should be in a proper format or structure. It was not classified or saved in the Question Bank.'
        );
      }
      const savedMessage = `Question saved in the Question Bank under ${data.bloom_level}.`;
      setSuccessMessage(savedMessage);
      showAlert(savedMessage, 'Saved');
      setManualQuestion('');
      setManualAnswerKey('');
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
    setExcludedQuestionIds([]);
    setSelectedTopics([]);
    setSubcolumnAValues({});
    setWizardStep(1);
    setError('Analysis cancelled. You can remove the uploaded files and try again.');
    persistInputQuestionSession({
      activeTab: 'upload',
      uploading: false,
      generating: false,
      uploadResult: null,
      generationResult: null,
      excludedQuestionIds: [],
      wizardStep: 1,
      selectedTopics: [],
      subcolumnAValues: {},
      error: 'Analysis cancelled. You can remove the uploaded files and try again.',
    });
  };

  const resetUploadState = () => {
    setUploadResult(null);
    setGenerationResult(null);
    setExcludedQuestionIds([]);
    setSelectedTopics([]);
    setSubcolumnAValues({});
    setWizardStep(1);
    persistInputQuestionSession({
      uploadResult: null,
      generationResult: null,
      excludedQuestionIds: [],
      wizardStep: 1,
      selectedTopics: [],
      subcolumnAValues: {},
    });
  };

  const resetAssessmentProgress = () => {
    const confirmed = window.confirm('Reset this assessment and clear all uploaded files, selections, and progress?');
    if (!confirmed) return;

    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }

    setModuleFile(null);
    setSyllabusFile(null);
    setSelectedSubject('');
    setIsAddingNewSubject(false);
    setNewSubjectName('');
    setNewSubjectCode('');
    setManualQuestion('');
    setManualAnswerKey('');
    setManualQuestionType('MCQ');
    setManualQuestionPoints('');
    setUploadResult(null);
    setGenerationResult(null);
    setExcludedQuestionIds([]);
    setSelectedTopics([]);
    setSubcolumnAValues({});
    setTotalPoints('');
    setTotalItems('');
    setExamType('Final Exam');
    setSemester('First Semester');
    setAcademicYear('');
    setSelectedQuestionTypes([]);
    setQuestionTypePoints({});
    setQuestionTypeItems({});
    setWizardStep(1);
    setUploading(false);
    setGenerating(false);
    setError('');
    setSuccessMessage('');
    sessionStorage.removeItem(INPUT_QUESTION_SESSION_KEY);
  };

  const handleCreateTest = () => {
    navigate(selectedSubject ? `/question-bank/${selectedSubject}` : '/question-bank');
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
      excludedQuestionIds: [],
      selectedTopics: [],
      subcolumnAValues: {},
    });

    try {
      const formData = new FormData();
      formData.append('module_file', moduleFile);
      formData.append('syllabus_file', syllabusFile);
      const userId = localStorage.getItem('user_id');
      if (userId) formData.append('user_id', userId);

      uploadAbortControllerRef.current = new AbortController();
      const response = await fetch(`${API_URL}/questions/upload`, {
        method: 'POST',
        body: formData,
        signal: uploadAbortControllerRef.current.signal,
      });

      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data) || 'Upload failed');

      setUploadResult(data);
      if (data.topics) {
        const nextSelectedTopics = data.topics.map((_, idx) => idx);
        const initialHours = {};
        data.topics.forEach((_, idx) => { initialHours[idx] = '3.0'; });
        setSelectedTopics(nextSelectedTopics);
        setSubcolumnAValues(initialHours);
      }
      setWizardStep(2);
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
        uploadResult: data,
        generationResult: null,
        wizardStep: 2,
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
    if (!uploadResult?.upload_id) {
      setError('Please upload and analyze the module and syllabus before generating questions.');
      return;
    }
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
    const invalidQuestionTypePoints = selectedQuestionTypes.some((type) => {
      const points = Number(questionTypePoints[type]);
      return !Number.isFinite(points) || points <= 0 || points > 1000;
    });
    if (invalidQuestionTypePoints) {
      setError('Please enter a valid points value between 0.01 and 1000 for each selected question type.');
      return;
    }
    const questionTypeItemCounts = Object.fromEntries(
      selectedQuestionTypes.map((type) => [type, parseInt(questionTypeItems[type], 10)])
    );
    const invalidQuestionTypeItems = selectedQuestionTypes.some((type) => {
      const items = questionTypeItemCounts[type];
      return !Number.isInteger(items) || items < 1 || items > 200;
    });
    if (invalidQuestionTypeItems) {
      setError('Please enter a valid number of questions between 1 and 200 for each selected question type.');
      return;
    }
    if (Object.values(questionTypeItemCounts).reduce((sum, items) => sum + items, 0) !== intTotalItems) {
      setError('The total intended items must equal the sum of the questions entered for each question type.');
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
    setGenerationProgress(10); // Start progress bar

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
        exam_type: examType,
        semester,
        academic_year: academicYear.trim(),
        question_type_points: Object.fromEntries(
          selectedQuestionTypes.map((type) => [type, Number(questionTypePoints[type])])
        ),
        question_type_items: questionTypeItemCounts,
        user_id: Number(localStorage.getItem('user_id')) || null,
      };

      setGenerationProgress(20); // Progress: sending request
      const previewResponse = await fetch(`${API_URL}/questions/generate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setGenerationProgress(70); // Progress: received response

      if (!previewResponse.ok) {
        const errData = await parseApiResponse(previewResponse);
        const message = getErrorMessage(errData) || `Generation failed with server status code: ${previewResponse.status}`;
        if (previewResponse.status === 502) {
          throw new Error(message || 'The AI Service is currently rate-limited or timed out. Please wait a few moments and try generating again.');
        }
        throw new Error(message);
      }

      setGenerationProgress(85); // Preview received; wait for review.
      const data = await parseApiResponse(previewResponse);
      setGenerationResult(data);
      setExcludedQuestionIds([]);
      setGenerationProgress(100);
      setSuccessMessage('Review the generated questions. Similar questions are marked and can be excluded before saving.');
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
        generationResult: data,
        excludedQuestionIds: [],
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
      // Keep progress bar visible for 500ms after completion before hiding
      setTimeout(() => {
        setGenerationProgress(0);
      }, 500);
      persistInputQuestionSession({
        activeTab: 'upload',
        uploading: false,
        generating: false,
      });
    }
  };

  const handleConfirmGeneration = async () => {
    if (!uploadResult?.upload_id || !generationResult?.questions_preview?.length) return;
    const includedPreviewIds = generationResult.questions_preview
      .map((question) => question.preview_id)
      .filter((previewId) => !excludedQuestionIds.includes(previewId));
    if (!includedPreviewIds.length) {
      setError('Keep at least one question before saving the assessment.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setGenerating(true);
    setGenerationProgress(35);
    try {
      const response = await fetch(`${API_URL}/questions/confirm-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: uploadResult.upload_id, included_preview_ids: includedPreviewIds }),
      });
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data) || `Saving failed with server status code: ${response.status}`);
      setGenerationResult(data);
      setGenerationProgress(100);
      setSuccessMessage('Questions saved successfully to the Question Bank.');
      persistInputQuestionSession({ generationResult: data, excludedQuestionIds });
    } catch (err) {
      setError(getErrorMessage(err) || 'Unable to save the generated questions.');
    } finally {
      setGenerating(false);
      setTimeout(() => setGenerationProgress(0), 500);
    }
  };

  const downloadFile = async (endpoint, filename) => {
    try {
      const userId = localStorage.getItem('user_id');
      const userParam = userId ? `&user_id=${encodeURIComponent(userId)}` : '';
      const response = await fetch(`${API_URL}/questions/export/${endpoint}?upload_id=${encodeURIComponent(uploadResult.upload_id)}${userParam}`, {
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

  const downloadSubjectCode = (uploadResult?.subject?.code || uploadResult?.subject?.name || 'assessment').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const downloadExamType = examType.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: pageBg, fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <GeneratingBarStyles />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-7 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm" style={{ backgroundColor: PRIMARY }}><Sparkles className="h-6 w-6 text-white" strokeWidth={2} /></div>
          <div><p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: PRIMARY }}>Create Assessment</p><h1 className="text-2xl font-bold tracking-tight text-slate-900">Question Input &amp; TOS Generator</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Upload instructional materials or add questions manually, then generate a Table of Specifications and full assessment instruments.</p></div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm" style={{ border: '1px solid rgba(15, 23, 42, 0.09)' }}><div className="p-5 sm:p-7">

        {/* Tab Navigation */}
        <div className="mb-6 flex w-full items-center justify-between gap-3 rounded-xl bg-slate-100 p-1">
          <div className="flex min-w-0 gap-1.5">
          <button
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => {
              setActiveTab('upload');
              setError('');
              setSuccessMessage('');
            }}
          >
            <FolderUp className="h-4 w-4" style={{ color: activeTab === 'upload' ? PRIMARY : undefined }} />
            Upload &amp; generate
          </button>
          <button
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => {
              setActiveTab('manual');
              setError('');
              setSuccessMessage('');
            }}
          >
            <PencilLine className="h-4 w-4" style={{ color: activeTab === 'manual' ? PRIMARY : undefined }} />
            Manual entry
          </button>
          </div>
          <button
            type="button"
            onClick={resetAssessmentProgress}
            className="mr-1 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-white hover:text-[#8F1424]"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Stepper */}
        <div className="mb-7 flex items-center">
          {WIZARD_STEPS.map((step, idx) => (
            <React.Fragment key={step.number}>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    width: 26, height: 26,
                    backgroundColor: wizardStep >= step.number ? PRIMARY : '#F1F5F9',
                    color: wizardStep >= step.number ? '#fff' : '#94A3B8',
                  }}
                >
                  {wizardStep > step.number ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.number}
                </div>
                <span className={`text-[13px] font-medium ${wizardStep >= step.number ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
              {idx < WIZARD_STEPS.length - 1 && (
                <div className="mx-2.5 h-px flex-1" style={{ backgroundColor: border }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
        {successMessage && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">{successMessage}</div>}

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
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Question Type</label>
                <select value={manualQuestionType} onChange={(e) => setManualQuestionType(e.target.value)} className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400 cursor-pointer">
                  {QUESTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Points for Question Type</label>
                <input type="number" min="0.01" step="0.01" max="1000" value={manualQuestionPoints} onChange={(e) => setManualQuestionPoints(e.target.value)} placeholder="e.g. 2" className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Kind of Exam</label>
                <select value={examType} onChange={(e) => setExamType(e.target.value)} className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400">
                  {EXAM_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Semester</label>
                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400">
                  {SEMESTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Academic Year</label>
                <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="e.g. 2026-2027" className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 focus:outline-none focus:border-red-400" />
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
                className="w-full h-44 p-4 border border-gray-200 rounded-md focus:ring-1 focus:border-red-500 outline-none resize-none text-gray-700 text-sm transition-all"
                placeholder="Type your manual assessment question here..."
                value={manualQuestion}
                onChange={(e) => setManualQuestion(e.target.value)}
              />
              <div className="flex justify-between items-center mt-1">
                <span />
                <span className="text-xs text-gray-400 ml-auto">{manualQuestion.length} characters</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Answer Key</label>
              <textarea
                className="w-full min-h-20 p-3 border border-gray-200 rounded-md focus:ring-1 focus:border-red-500 outline-none resize-y text-gray-700 text-sm"
                placeholder="Enter the correct answer or answer key..."
                maxLength={2000}
                value={manualAnswerKey}
                onChange={(e) => setManualAnswerKey(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">For MCQ, enter one letter such as A or B. For Matching Type, enter answer letters only, such as A, C, B, D.</p>
            </div>

            <div className="flex justify-end">
              <button onClick={handleManualClassification} disabled={classifying || !manualQuestion.trim() || !manualAnswerKey.trim() || !selectedSubject} className="bg-[#b90000] hover:bg-[#990000] text-white font-medium text-sm py-2.5 px-6 rounded-md disabled:bg-gray-200 disabled:text-gray-400 transition-colors flex items-center gap-2">
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
            {wizardStep === 1 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Step 1</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-800">Upload Educational Material Assets</h3>
                  </div>
                  <div className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Required</div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <UploadSlot
                    policyKey="module"
                    file={moduleFile}
                    onFileSelected={(f) => { setModuleFile(f); setError(''); }}
                    onRemove={() => handleFileRemove('module')}
                    stepBadge="Module"
                    locked={uploading || !!uploadResult}
                  />
                  <UploadSlot
                    policyKey="syllabus"
                    file={syllabusFile}
                    onFileSelected={(f) => { setSyllabusFile(f); setError(''); }}
                    onRemove={() => handleFileRemove('syllabus')}
                    stepBadge="Syllabus"
                    locked={uploading || !!uploadResult}
                  />
                </div>

                <div className="mt-6 flex justify-end border-t pt-4" style={{ borderColor: border }}>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !moduleFile || !syllabusFile || !!uploadResult}
                    className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {uploading ? 'Analyzing…' : 'Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Config Steps appear ONLY after successful upload */}
            {uploadResult && (
              <div className="space-y-6">
                {/* Step 2: Question Types Selection */}
                {wizardStep === 2 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Step 2</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-800">Question Types Selection</h3>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{selectedQuestionTypes.length} selected</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {QUESTION_TYPE_OPTIONS.map((option) => {
                        const isChecked = selectedQuestionTypes.includes(option.value);
                        return (
                          <div key={option.value} className={`rounded-xl border p-3 transition-all ${isChecked ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'}`}>
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedQuestionTypes((curr) => curr.includes(option.value) ? curr.filter((x) => x !== option.value) : [...curr, option.value]);
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                              />
                              <span>{option.label}</span>
                            </label>
                            {isChecked && (
                              <div className="mt-2 space-y-2">
                                <input type="number" min="0.01" step="0.01" max="1000" value={questionTypePoints[option.value] || ''} onChange={(e) => setQuestionTypePoints((current) => ({ ...current, [option.value]: e.target.value }))} placeholder="Points per question" className="w-full rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-red-400" />
                                {questionTypePoints[option.value] && <input type="number" min="1" step="1" max="200" value={questionTypeItems[option.value] || ''} onChange={(e) => setQuestionTypeItems((current) => ({ ...current, [option.value]: e.target.value }))} placeholder="Number of questions" className="w-full rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-red-400" />}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Total Points</label>
                        <input type="number" value={totalPoints} readOnly placeholder="Calculated from points and question counts" className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-700 outline-none" />
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Total Intended Test Items</label>
                        <input type="number" value={totalItems} readOnly placeholder="Calculated from question counts" className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-700 outline-none" />
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
                      <button type="button" onClick={() => setWizardStep(1)} className="bq-secondary-button">Back</button>
                      <button type="button" onClick={() => setWizardStep(3)} disabled={selectedQuestionTypes.length === 0} className="bq-primary-button disabled:cursor-not-allowed disabled:bg-gray-300">Next: Assessment Details</button>
                    </div>
                  </div>
                )}

                {/* Step 3: Assessment Details */}
                {wizardStep === 3 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Step 3</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-800">Assessment Details</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Kind of Exam</label>
                        <select value={examType} onChange={(e) => setExamType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:bg-white">
                          {EXAM_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Semester</label>
                        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:bg-white">
                          {SEMESTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Academic Year</label>
                        <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="e.g. 2026-2027" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:bg-white" />
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
                      <button type="button" onClick={() => setWizardStep(2)} className="bq-secondary-button">Back</button>
                      <button type="button" onClick={() => setWizardStep(4)} disabled={!totalItems || !totalPoints} className="bq-primary-button disabled:cursor-not-allowed disabled:bg-gray-300">Next: Topics &amp; Generate</button>
                    </div>
                  </div>
                )}

                {/* Step 4: Detected Subject & Main Topics */}
                {wizardStep === 4 && (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-5 sm:p-6">
                      <div className="mb-5 flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: PRIMARY }}>
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: PRIMARY }}>Create Assessment</p>
                          <h3 className="mt-1 text-xl font-bold text-slate-900">Detected Subject &amp; Main Topics</h3>
                          <p className="mt-1 text-sm text-slate-500">Review the detected topics and assign the hours that will shape your assessment matrix.</p>
                        </div>
                      </div>

                      {uploadResult.subject && (
                        <div className="mb-5 rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-400">Subject Detected</p>
                          <p className="mt-1 text-base font-bold text-slate-900">{uploadResult.subject.name}</p>
                          {uploadResult.subject.code && <p className="text-xs text-slate-500">{uploadResult.subject.code}</p>}
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Topics Detected &amp; Hours Covered ({uploadResult.topics.length})</p>
                        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                          {uploadResult.topics.map((topic, i) => (
                            <div key={i} className="flex flex-col items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
                              <input type="checkbox" checked={selectedTopics.includes(i)} onChange={() => toggleTopicSelection(i)} className="h-4 w-4 rounded border-slate-300" style={{ accentColor: PRIMARY }} disabled={!!generationResult} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800">{safeRenderValue(topic.name)}</p>
                                <p className="truncate text-xs italic text-slate-400">{safeRenderValue(topic.ilo) || 'No ILO provided'}</p>
                              </div>
                              {selectedTopics.includes(i) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Hours</span>
                                  <input type="number" step="0.5" value={subcolumnAValues[i] || ''} onChange={(e) => handleSubcolumnAChange(i, e.target.value)} className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm text-slate-800 outline-none focus:border-slate-500" disabled={!!generationResult} />
                                </div>
                              )}
                              <span className="w-12 shrink-0 text-right text-sm font-bold" style={{ color: PRIMARY }}>{Math.round((topic.weight || 0) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
                        <button type="button" onClick={() => setWizardStep(3)} disabled={generating} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">&larr; Back</button>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            onClick={generationResult?.saved ? undefined : (generationResult ? handleConfirmGeneration : handleGenerate)}
                            disabled={generating || (!generationResult && (selectedTopics.length === 0 || !totalItems))}
                            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
                            style={{ backgroundColor: PRIMARY, minWidth: generating ? 280 : undefined }}
                          >
                            {generating ? (
                              <GeneratingProgress label="Generating…" />
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                {generationResult?.saved ? 'Questions Saved' : (generationResult ? 'Save Questions' : 'Generate Questions')}
                              </>
                            )}
                          </button>
                          {/* Progress bar under button */}
                          {generating && (
                            <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${generationProgress}%`,
                                  background: 'linear-gradient(90deg, #8F1424 0%, #D64545 50%, #B4454A 100%)',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Output Previews & Download Links */}
            {generationResult && (
              <div className="rounded-lg p-5 space-y-6" style={{ backgroundColor: 'rgba(220, 252, 231, 0.35)', border: `1px solid rgba(34, 197, 94, 0.25)` }}>
                  <div className="flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-bold text-green-800 text-sm">{generationResult.saved ? '✓ Questions Saved to the Question Bank' : 'Review Generated Questions'}</h3>
                    <p className="text-xs text-gray-500">{generationResult.saved ? 'The selected questions are available in the Question Bank.' : 'Similar questions are marked below. Exclude any question you do not want to save.'}</p>
                  </div>
                  {generationResult.saved && <div className="flex flex-wrap items-center justify-end gap-3">
                    <button onClick={() => downloadFile('tos', `${downloadSubjectCode}-${downloadExamType}-TOS.xlsx`)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded font-medium shadow-sm transition-colors">Download TOS (.xlsx)</button>
                    <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Assessment</span>
                      <button onClick={() => downloadFile('assessment/docx', `${downloadSubjectCode}-${downloadExamType}-Test.docx`)} className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 rounded font-medium shadow-sm transition-colors">Download Test (.docx)</button>
                      <button onClick={() => downloadFile('assessment/pdf', `${downloadSubjectCode}-${downloadExamType}-Test.pdf`)} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded font-medium shadow-sm transition-colors">Download Test (.pdf)</button>
                    </div>
                  </div>}
                </div>

                {/* TOS Summary Section */}
                {generationResult.tos && generationResult.tos.length > 0 && (
                  <div className="rounded-lg p-5 bg-white shadow-sm space-y-4" style={{ border: `1px solid ${border}` }}>
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
                        <div key={idx} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: `1px solid rgba(226, 232, 240, 0.95)` }}>
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
                  <div className="bg-white p-4 rounded-b-md max-h-80 overflow-y-auto space-y-4 shadow-inner" style={{ borderColor: border, borderWidth: '1px', borderStyle: 'solid', borderTopWidth: '0' }}>
                    {(generationResult.questions_preview || [])
                      .filter(q => q.bloom_level === previewBloomTab)
                      .map((q, idx) => (
                        <div key={q.preview_id ?? idx} className={`p-3 rounded-md bg-gray-50/50 text-sm ${excludedQuestionIds.includes(q.preview_id) ? 'opacity-60' : ''}`} style={{ border: `1px solid ${q.duplicate_existing_id ? '#FBBF24' : 'rgba(226, 232, 240, 0.95)'}` }}>
                          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                            <span>Syllabus Reference: <strong className="text-gray-600">{safeRenderValue(q.topic_name)}</strong></span>
                            <div className="flex items-center gap-2">
                              <span className="bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded uppercase">{safeRenderValue(q.type)}</span>
                              {q.duplicate_existing_id && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold uppercase text-amber-800">Similar exists in Question Bank</span>}
                            </div>
                          </div>
                          <p className="font-medium text-gray-800">{idx + 1}. {safeRenderValue(q.question)}</p>
                          {q.duplicate_existing_id && !generationResult.saved && (
                            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-800">
                              <input
                                type="checkbox"
                                checked={excludedQuestionIds.includes(q.preview_id)}
                                onChange={() => setExcludedQuestionIds((current) => current.includes(q.preview_id) ? current.filter((id) => id !== q.preview_id) : [...current, q.preview_id])}
                                className="h-4 w-4 rounded border-amber-400 accent-amber-600"
                              />
                              Exclude this similar question
                            </label>
                          )}
                          {q.type === 'MCQ' && Array.isArray(q.options) && (
                            <div className="mt-2 space-y-1 text-xs text-gray-600">
                              {q.options.map((option, optionIndex) => (
                                <p key={optionIndex} className="rounded border border-gray-200 bg-white px-2 py-1">
                                  {String.fromCharCode(65 + optionIndex)}. {safeRenderValue(option)}
                                </p>
                              ))}
                            </div>
                          )}
                          {q.type === 'Matching Type' && Array.isArray(q.left_items) && Array.isArray(q.right_items) && (
                            <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                              <div className="rounded border border-gray-200 bg-white p-2">
                                <p className="mb-1 font-bold text-gray-600">Column A</p>
                                {q.left_items.map((item, itemIndex) => <p key={itemIndex} className="py-1">{itemIndex + 1}. {safeRenderValue(item)}</p>)}
                              </div>
                              <div className="rounded border border-gray-200 bg-white p-2">
                                <p className="mb-1 font-bold text-gray-600">Column B</p>
                                {q.right_items.map((item, itemIndex) => <p key={itemIndex} className="py-1">{String.fromCharCode(65 + itemIndex)}. {safeRenderValue(item)}</p>)}
                              </div>
                            </div>
                          )}
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
    </div>
    </div>
  );
};

export default InputQuestion;