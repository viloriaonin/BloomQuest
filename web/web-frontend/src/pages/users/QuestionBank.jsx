import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, ChevronRight, Download, FileText, Filter, FlaskConical, Heart, Info, Plus, Search, Shield, Sigma, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopup } from '../../components/PopupProvider';

const API_URL = 'http://localhost:8000';
const PRIMARY = '#8F1424';
const PRIMARY_SOFT = '#FBEEEF';

const EXAM_TYPE_OPTIONS = ['Midterm Exam', 'Final Exam', 'Quiz', 'Long Exam'];
const QUESTION_TYPE_OPTIONS = [
  { label: 'All question types', value: '' },
  { label: 'Multiple Choice', value: 'MCQ' },
  { label: 'True or False', value: 'True or False' },
  { label: 'Identification', value: 'Identification' },
  { label: 'Matching Type', value: 'Matching Type' },
  { label: 'Enumeration', value: 'Enumeration' },
  { label: 'Essay', value: 'Essay' },
];
const SEMESTER_OPTIONS = ['First Semester', 'Second Semester', 'Summer'];

const BLOOMS_LEVELS = [
  { name: 'Remember',   dotColor: 'bg-red-400' },
  { name: 'Understand', dotColor: 'bg-rose-400' },
  { name: 'Apply',      dotColor: 'bg-orange-300' },
  { name: 'Analyze',    dotColor: 'bg-teal-400' },
  { name: 'Evaluate',   dotColor: 'bg-blue-400' },
  { name: 'Create',     dotColor: 'bg-purple-500' },
];

const SUBJECT_THEMES = [
  { bg: '#F0645A', iconColor: '#FFFFFF', icon: Shield },
  { bg: '#6FA8E0', iconColor: '#FFFFFF', icon: Sigma },
  { bg: '#5CB37B', iconColor: '#FFFFFF', icon: FlaskConical },
];

// Indeterminate progress bar components
const GeneratingBarStyles = () => (
  <style>{`
    @keyframes bq-indeterminate {
      0%   { left: -40%; width: 40%; }
      50%  { left: 20%;  width: 60%; }
      100% { left: 100%; width: 40%; }
    }
  `}</style>
);

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

const cleanText = (value) => String(value ?? '').trim().replace(/[{}[\]"']/g, '').replace(/\s+/g, ' ');

const normalizeJsonLike = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const getOptionLetter = (question, answerValue) => {
  const options = Array.isArray(question?.options) ? question.options : [];
  if (!options.length) return '';
  const target = cleanText(answerValue)
    .replace(/\s*->\s*/g, '->')
    .replace(/\s+/g, ' ');

  for (let index = 0; index < options.length; index += 1) {
    const option = cleanText(options[index]);
    if (option === target) return String.fromCharCode(65 + index);
  }
  return '';
};

const getMatchingChoices = (question) => {
  const parsedOptions = normalizeJsonLike(question?.options);

  const options =
    parsedOptions &&
    typeof parsedOptions === 'object' &&
    !Array.isArray(parsedOptions)
      ? parsedOptions
      : {};

  // If the database already has proper matching choices, use them.
  const existingLeft =
    Array.isArray(options.left_items) && options.left_items.length
      ? options.left_items
      : Array.isArray(options.column_a) && options.column_a.length
        ? options.column_a
        : Array.isArray(question?.left_items) && question.left_items.length
          ? question.left_items
          : Array.isArray(question?.column_a) && question.column_a.length
            ? question.column_a
            : [];

  const existingRight =
    Array.isArray(options.right_items) && options.right_items.length
      ? options.right_items
      : Array.isArray(options.column_b) && options.column_b.length
        ? options.column_b
        : Array.isArray(question?.right_items) && question.right_items.length
          ? question.right_items
          : Array.isArray(question?.column_b) && question.column_b.length
            ? question.column_b
            : [];

  if (existingLeft.length && existingRight.length) {
    return {
      leftItems: existingLeft.map(cleanText),
      rightItems: existingRight.map(cleanText),
    };
  }

  /*
   * Fallback:
   * Some existing matching questions store the pairs inside
   * correct_answer as:
   *
   * {
   *   "Left 1 -> Description 1",
   *   "Left 2 -> Description 2"
   * }
   *
   * DO NOT split simply on commas because the descriptions
   * themselves may contain commas.
   */
  let rawAnswer = question?.correct_answer;

  if (typeof rawAnswer !== 'string') {
    return {
      leftItems: [],
      rightItems: [],
    };
  }

  rawAnswer = rawAnswer
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/^\{+|\}+$/g, '')
    .replace(/\\"/g, '"');

  /*
   * A new matching pair starts when a comma is followed by
   * text that eventually contains "->".
   *
   * Example:
   *
   * "User Interfaces -> Manages user experience, layout,
   * and client interaction, Servers -> Processes business logic"
   *
   * The comma after "experience" must NOT split the entry.
   */
  const entries = rawAnswer
    .split(/,\s*(?=[^,{}[\]]+?\s*->)/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const leftItems = [];
  const rightItems = [];

  entries.forEach((entry) => {
    const separatorIndex = entry.indexOf('->');

    if (separatorIndex === -1) return;

    const left = entry
      .substring(0, separatorIndex)
      .trim()
      .replace(/^["']+|["']+$/g, '');

    const right = entry
      .substring(separatorIndex + 2)
      .trim()
      .replace(/^["']+|["']+$/g, '');

    if (left && right) {
      leftItems.push(cleanText(left));
      rightItems.push(cleanText(right));
    }
  });

  return {
    leftItems,
    rightItems,
  };
};

const formatAnswerKey = (answer, question) => {
  if (question?.question_type === 'Matching Type') {
  const { leftItems, rightItems } = getMatchingChoices(question);

  if (!leftItems.length || !rightItems.length) {
    return 'N/A';
  }

  let answerMap = normalizeJsonLike(question?.correct_answer);

  /*
   * If correct_answer is not valid JSON, reconstruct it using
   * the same safe parser used for the matching choices.
   */
  if (
    typeof answerMap !== 'object' ||
    answerMap === null ||
    Array.isArray(answerMap)
  ) {
    answerMap = {};

    const rawAnswer = String(question?.correct_answer ?? '')
      .trim()
      .replace(/^"+|"+$/g, '')
      .replace(/^\{+|\}+$/g, '')
      .replace(/\\"/g, '"');

    const entries = rawAnswer
      .split(/,\s*(?=[^,{}[\]]+?\s*->)/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    entries.forEach((entry) => {
      const separatorIndex = entry.indexOf('->');

      if (separatorIndex === -1) return;

      const left = cleanText(
        entry.substring(0, separatorIndex)
      );

      const right = cleanText(
        entry.substring(separatorIndex + 2)
      );

      if (left && right) {
        answerMap[left] = right;
      }
    });
  }

  const letters = [];

  /*
   * IMPORTANT:
   * Iterate through Column A so the answer key follows
   * the exact order of the questions.
   */
  leftItems.forEach((leftItem) => {
    const matchingKey = Object.keys(answerMap).find(
      (key) =>
        cleanText(key).toLowerCase() ===
        cleanText(leftItem).toLowerCase()
    );

    if (!matchingKey) return;

    const answerValue = cleanText(answerMap[matchingKey]);

    // If already stored as A/B/C/etc.
    if (/^[A-Za-z]$/.test(answerValue)) {
      letters.push(answerValue.toUpperCase());
      return;
    }

    // Find the corresponding Column B choice.
    const rightIndex = rightItems.findIndex(
      (rightItem) =>
        cleanText(rightItem).toLowerCase() ===
        answerValue.toLowerCase()
    );

    if (rightIndex !== -1) {
      letters.push(
        String.fromCharCode(65 + rightIndex)
      );
    }
  });

  return letters.length
    ? letters.join(', ')
    : 'N/A';
}

  // MCQ
  if (question?.question_type === 'MCQ') {
    const value = normalizeJsonLike(answer);

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const firstValue = Object.values(value)[0];

      return (
        getOptionLetter(question, firstValue) ||
        cleanText(firstValue)
      );
    }

    return (
      getOptionLetter(question, value) ||
      cleanText(value ?? '')
    );
  }

  // Other question types
  const value = normalizeJsonLike(answer);

  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item))
      .filter(Boolean)
      .join('; ');
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .join('; ');
  }

  return cleanText(value ?? '');
};

const QuestionBank = () => {
  const { showConfirm } = usePopup();
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const [activeTab, setActiveTab]             = useState('All');
  const [subjects, setSubjects]               = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [questions, setQuestions]             = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError]                     = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [deletingId, setDeletingId]           = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm]               = useState({});
  const [exporting, setExporting]             = useState(false);
  const [exportFormat, setExportFormat]       = useState('pdf');
  const [searchTerm, setSearchTerm]           = useState('');
  const [selectedQuestionType, setSelectedQuestionType] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assessmentSettingsOpen, setAssessmentSettingsOpen] = useState(false);
  const [answerMode, setAnswerMode] = useState('with_key');
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bloomquest-favorite-questions') || '[]'); } catch { return []; }
  });
  const [bankView, setBankView] = useState(() => localStorage.getItem('bloomquest-question-bank-view') || 'questions');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionQuestion, setVersionQuestion] = useState(null);
  const [versions, setVersions] = useState([]);
  const [deletedSubject, setDeletedSubject] = useState(null);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [showSidebarInfo, setShowSidebarInfo] = useState(true);
  const [tosModalOpen, setTosModalOpen] = useState(false);
  const [examType, setExamType] = useState('Final Exam');
  const [semester, setSemester] = useState('First Semester');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [subcolumnAValues, setSubcolumnAValues] = useState({});
  const [generatingTos, setGeneratingTos] = useState(false);
  const [tosSavingProgress, setTosSavingProgress] = useState(0);
  const undoTimerRef = useRef(null);

  useEffect(() => {
    setSelectedSubject(subjectId === 'all' ? '' : subjectId || '');
    setShowAllQuestions(subjectId === 'all');
  }, [subjectId]);

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch(`${API_URL}/api/subjects`);
        if (!res.ok) throw new Error('Failed to fetch subjects');
        const data = await res.json();
        setSubjects(data);
      } catch (err) {
        setError('Could not load subjects.');
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, []);

  // Fetch questions when subject changes
  useEffect(() => {
    if (!selectedSubject && !showAllQuestions) {
      setQuestions([]);
      return;
    }
    fetchQuestions(selectedSubject || null);
    if (!selectedSubject) return;
  }, [selectedSubject, showAllQuestions]);

  useEffect(() => {
    if (selectedSubject) localStorage.setItem('bloomquest-question-bank-subject', selectedSubject);
    localStorage.setItem('bloomquest-question-bank-view', bankView);
  }, [selectedSubject, bankView]);

  const fetchQuestions = async (subjectId, preserveSelection = false) => {
    setLoading(true);
    setError('');
    if (!preserveSelection) setSelectedQuestions([]);
    try {
      const subjectQuery = subjectId ? `?subject_id=${subjectId}` : '';
      const res = await fetch(`${API_URL}/api/questions${subjectQuery}`);
      if (!res.ok) throw new Error('Failed to fetch questions');
      const data = await res.json();
      setQuestions(data);
      const subjectsRes = await fetch(`${API_URL}/api/subjects`);
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
    } catch (err) {
      setError('Could not load questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = async (event, subject) => {
    event.stopPropagation();
    if (!(await showConfirm(`Delete the subject "${subject.name}"?`, 'Delete Subject'))) return;
    try {
      const res = await fetch(`${API_URL}/api/subjects/${subject.id}?user_id=${encodeURIComponent(localStorage.getItem('user_id') || '')}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete subject');
      setSubjects((current) => current.filter((item) => item.id !== subject.id));
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setDeletedSubject(subject);
      undoTimerRef.current = setTimeout(() => setDeletedSubject(null), 5000);
    } catch (err) {
      setError(err.message);
    }
  };

  const undoDeleteSubject = async () => {
    if (!deletedSubject) return;
    try {
      const res = await fetch(`${API_URL}/api/recycle-bin/subjects/${deletedSubject.id}/restore`, { method: 'POST' });
      if (!res.ok) throw new Error('Could not undo subject deletion');
      const restored = await res.json();
      setSubjects((current) => [...current, restored]);
      clearTimeout(undoTimerRef.current);
      setDeletedSubject(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddSubject = async (event) => {
    event.preventDefault();
    if (!newSubjectName.trim()) return;
    setAddingSubject(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubjectName.trim(), code: newSubjectCode.trim() || null, user_id: Number(localStorage.getItem('user_id')) || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Could not add subject');
      setSubjects((current) => [...current, data]);
      setNewSubjectName('');
      setNewSubjectCode('');
      setAddSubjectOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingSubject(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Are you sure you want to delete this question?', 'Delete Question');
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/questions/${id}?user_id=${encodeURIComponent(localStorage.getItem('user_id') || '')}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setQuestions(prev => prev.filter(q => q.id !== id));
      setSelectedQuestions(prev => prev.filter(qId => qId !== id));
    } catch (err) {
      setError('Failed to delete question.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditOpen = (q) => {
    setEditingQuestion(q.id);
    setEditForm({
      question: q.question,
      correct_answer: q.correct_answer || '',
      explanation: q.explanation || '',
    });
  };

  const handleEditSave = async () => {
    try {
      const formData = new FormData();
      formData.append('question', editForm.question);
      formData.append('correct_answer', editForm.correct_answer);
      formData.append('explanation', editForm.explanation);
      const res = await fetch(`${API_URL}/api/questions/${editingQuestion}`, {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) throw new Error('Update failed');
      setQuestions(prev =>
        prev.map(q => q.id === editingQuestion ? { ...q, ...editForm } : q)
      );
      setEditingQuestion(null);
    } catch (err) {
      setError('Failed to update question.');
    }
  };

  const toggleSelection = (id) => {
    setSelectedQuestions(prev =>
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const toggleFavorite = (id) => {
    setFavoriteIds((current) => {
      const next = current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id];
      localStorage.setItem('bloomquest-favorite-questions', JSON.stringify(next));
      return next;
    });
  };

  const openVersions = async (question) => {
    try {
      const res = await fetch(`${API_URL}/api/questions/${question.id}/versions`);
      if (!res.ok) throw new Error('Could not load question versions');
      setVersions(await res.json());
      setVersionQuestion(question);
      setVersionsOpen(true);
    } catch (err) { setError(err.message); }
  };

  const restoreVersion = async (version) => {
    if (!versionQuestion) return;
    const res = await fetch(`${API_URL}/api/questions/${versionQuestion.id}/versions/${version.id}/restore`, { method: 'POST' });
    if (!res.ok) { setError('Could not restore question version'); return; }
    setVersionsOpen(false);
    fetchQuestions(selectedSubject, true);
  };

  const moveSelectedQuestion = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedQuestions.length) return;
    setSelectedQuestions((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const countByLevel = (level) => questions.filter(q => q.bloom_level === level && (!selectedQuestionType || q.question_type === selectedQuestionType)).length;
  const displayedQuestions = questions.filter(q => {
    const matchesLevel = activeTab === 'All' || q.bloom_level === activeTab;
    const matchesType = !selectedQuestionType || q.question_type === selectedQuestionType;
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch = !normalizedSearch || [q.question, q.topic_name, q.correct_answer].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
    return matchesLevel && matchesType && matchesSearch;
  });
  const allDisplayedSelected = displayedQuestions.length > 0 && displayedQuestions.every((question) => selectedQuestions.includes(question.id));

  const toggleDisplayedSelection = () => {
    if (allDisplayedSelected) {
      setSelectedQuestions((current) => current.filter((id) => !displayedQuestions.some((question) => question.id === id)));
    } else {
      setSelectedQuestions((current) => [...new Set([...current, ...displayedQuestions.map((question) => question.id)])]);
    }
  };
  const selectedSubjectName = subjects.find(s => s.id === parseInt(selectedSubject))?.name || '';
  const selectedSubjectCode = subjects.find(s => s.id === parseInt(selectedSubject))?.code || selectedSubjectName || 'assessment';
  const fileSubjectCode = selectedSubjectCode.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const fileExamType = examType.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const questionScope = selectedSubject || showAllQuestions;
  const highOrderCount = questions.filter((question) => ['Analyze', 'Evaluate', 'Create'].includes(question.bloom_level)).length;
  const highOrderCoverage = questions.length ? Math.round((highOrderCount / questions.length) * 100) : 0;
  const questionViews = [
    ['questions', 'All Questions', questions.length],
    ['favorites', 'Favorites', questions.filter((question) => favoriteIds.includes(question.id)).length],
  ];
  const visibleQuestions = bankView === 'favorites'
    ? displayedQuestions.filter((question) => favoriteIds.includes(question.id))
    : displayedQuestions;
  const selectedQuestionRecords = questions.filter((q) => selectedQuestions.includes(q.id));
  const filteredQuestionRecords = questions.filter((question) => !selectedQuestionType || question.question_type === selectedQuestionType);
  const summaryQuestionRecords = selectedQuestionRecords.length > 0 ? selectedQuestionRecords : filteredQuestionRecords;
  const countValues = (field) => Object.entries(summaryQuestionRecords.reduce((counts, question) => {
    const value = question[field] || 'Not specified';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {}));
  const selectedTopicMix = countValues('topic_name');
  const selectedTypeMix = countValues('question_type');
  const answeredCount = summaryQuestionRecords.filter((question) => question.correct_answer).length;
  const explainedCount = summaryQuestionRecords.filter((question) => question.explanation).length;
  const sidebarSummary = {
    total: summaryQuestionRecords.length,
    remember: summaryQuestionRecords.filter((q) => q.bloom_level === 'Remember').length,
    understand: summaryQuestionRecords.filter((q) => q.bloom_level === 'Understand').length,
    apply: summaryQuestionRecords.filter((q) => q.bloom_level === 'Apply').length,
    analyze: summaryQuestionRecords.filter((q) => q.bloom_level === 'Analyze').length,
    evaluate: summaryQuestionRecords.filter((q) => q.bloom_level === 'Evaluate').length,
    create: summaryQuestionRecords.filter((q) => q.bloom_level === 'Create').length,
  };

  const handleSidebarDownload = async (mode) => {
    if (!selectedSubject || selectedQuestions.length === 0) return;

    if (mode === 'tos') {
      // Open TOS modal instead of direct download
      setTosModalOpen(true);
      return;
    }

    const format = mode === 'docx' ? 'docx' : 'pdf';
    setExporting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('subject_id', selectedSubject);
      formData.append('question_ids', selectedQuestions.join(','));
      formData.append('export_format', format);
      formData.append('exam_type', examType);
      formData.append('answer_mode', 'with_key');
      formData.append('include_answer_key', 'true');
      const userId = localStorage.getItem('user_id');
      if (userId) formData.append('user_id', userId);

      const res = await fetch(`${API_URL}/api/questions/export`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileSubjectCode}-${fileExamType}-Test.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Download failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleTosGeneration = async () => {
    if (!selectedSubject || selectedQuestions.length === 0) {
      setError('Please select questions before generating TOS.');
      return;
    }

    if (selectedTopics.length === 0) {
      setError('Please select at least one topic to include in the TOS.');
      return;
    }

    const invalidHours = Object.entries(subcolumnAValues).some(([, value]) => {
      const num = parseFloat(value);
      return Number.isNaN(num) || num <= 0;
    });

    if (invalidHours) {
      setError('Please enter valid positive hours for each selected topic.');
      return;
    }

    setGeneratingTos(true);
    setTosSavingProgress(10); // Start progress
    setError('');

    try {
      const formData = new FormData();
      formData.append('subject_id', selectedSubject);
      formData.append('question_ids', selectedQuestions.join(','));
      formData.append('exam_type', examType);
      formData.append('semester', semester);
      const userId = localStorage.getItem('user_id');
      if (userId) formData.append('user_id', userId);

      setTosSavingProgress(30); // Progress: sending request
      const res = await fetch(`${API_URL}/api/questions/export/tos`, {
        method: 'POST',
        body: formData,
      });
      setTosSavingProgress(70); // Progress: processing

      if (!res.ok) throw new Error('TOS generation failed');
      setTosSavingProgress(85); // Progress: generating file
      const blob = await res.blob();
      setTosSavingProgress(95); // Almost done
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileSubjectCode}-${fileExamType}-TOS.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setTosSavingProgress(100); // Complete

      // Reset modal
      setTosModalOpen(false);
      setSelectedTopics([]);
      setSubcolumnAValues({});
    } catch (err) {
      setError(err.message || 'TOS generation failed.');
    } finally {
      setGeneratingTos(false);
      setTimeout(() => {
        setTosSavingProgress(0);
      }, 500);
    }
  };

  return (
    <div className="bq-page">
      <GeneratingBarStyles />
      <div className="bq-page-inner">

      {/* Header */}
      <div className="bq-page-header">
        <div>
        <nav aria-label="Question Bank navigation" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-500">
          <button type="button" onClick={() => navigate('/question-bank')} className={`transition-colors hover:text-[#B4454A] ${!subjectId ? 'text-slate-700' : ''}`}>Subjects</button>
          {subjectId && <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
            <span className="max-w-full break-words text-slate-700">{selectedSubjectName || 'Subject'}</span>
          </>}
        </nav>
        <p className="bq-eyebrow">Build and manage</p>
        <h1 className="bq-page-title">Question Bank</h1>
        <p className="bq-page-description">Browse questions by subject and prepare assessment exports.</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Subject gallery */}
      {!subjectId && <section className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B4454A]">Choose a subject</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Your question collections</h2>
          </div>
          <button
            type="button"
            onClick={() => setAddSubjectOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#F0645A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d9564d]"
          >
            <Plus className="h-4 w-4" />
            Add subject
          </button>
        </div>

        {loadingSubjects ? (
          <div className="bq-panel p-6 text-sm text-slate-500">Loading subjects...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject, index) => {
              const generatedDate = subject.created_at
                ? new Date(subject.created_at).toLocaleDateString()
                : 'Date unavailable';
              const isAutoGenerated = subject.source === 'auto' || subject.is_auto_generated;
              const questionCount = subject.question_count ?? 0;
              const theme = SUBJECT_THEMES[index % SUBJECT_THEMES.length];
              const Icon = theme.icon;

              return (
                <div
                  key={subject.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/question-bank/${subject.id}`)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(`/question-bank/${subject.id}`); }}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-colors hover:border-[#B4454A]/50 hover:shadow-md"
                >
                  <div className="relative flex h-24 items-center justify-center" style={{ backgroundColor: theme.bg }}>
                    <Icon className="h-8 w-8" style={{ color: theme.iconColor }} />
                    <button
                      type="button"
                      aria-label={`Delete ${subject.name}`}
                      onClick={(event) => handleDeleteSubject(event, subject)}
                      className="absolute right-2 top-2 rounded-md p-1.5 text-slate-500 opacity-0 transition-colors group-hover:opacity-100 hover:!bg-white/70 hover:!text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900">{subject.name}</span>
                      {subject.code && (
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          {subject.code}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {isAutoGenerated ? 'Auto-generated subject area' : 'Manually added subject area'}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">Generated {generatedDate}</span>
                      <span className="shrink-0 whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                        {questionCount} question{questionCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setAddSubjectOpen(true)}
              className="flex min-h-[176px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-slate-500 transition-colors hover:border-[#B4454A]/50 hover:bg-red-50/30 hover:text-[#B4454A]"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm font-medium">Add subject</span>
            </button>
          </div>
        )}
      </section>}

      {addSubjectOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddSubjectOpen(false); }}><form onSubmit={handleAddSubject} className="bq-panel w-full max-w-md border-[#ead8d5] bg-[#fffdfc] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"><h2 className="text-lg font-bold text-slate-900">Add Subject</h2><label className="mt-5 block text-sm font-semibold text-slate-700">Subject name<input autoFocus value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="e.g. Software Engineering" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#B4454A] focus:ring-2 focus:ring-[#B4454A]/15" /></label><label className="mt-4 block text-sm font-semibold text-slate-700">Subject code <span className="font-normal text-slate-400">(optional)</span><input value={newSubjectCode} onChange={(event) => setNewSubjectCode(event.target.value)} placeholder="e.g. IT 332" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#B4454A] focus:ring-2 focus:ring-[#B4454A]/15" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setAddSubjectOpen(false)} className="bq-secondary-button">Cancel</button><button type="submit" disabled={!newSubjectName.trim() || addingSubject} className="bq-primary-button disabled:cursor-not-allowed disabled:bg-slate-300">{addingSubject ? 'Adding...' : 'Add Subject'}</button></div></form></div>}

      {deletedSubject && <div className="fixed bottom-5 right-5 z-40 flex items-center gap-4 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"><span>Subject deleted</span><button type="button" onClick={undoDeleteSubject} className="font-bold text-emerald-300 hover:text-emerald-200">Undo</button></div>}

      {subjectId && <button type="button" onClick={() => navigate('/question-bank')} className="mb-4 text-sm font-semibold text-[#B4454A] hover:text-[#8f3439]">&larr; Back to subjects</button>}

      {selectedSubject && questions.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="bq-panel p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Higher-order items</p><p className="mt-1 text-2xl font-bold text-slate-900">{highOrderCoverage}%</p><p className="mt-1 text-xs text-slate-500">Analyze, Evaluate, or Create</p></div>
        </div>
      )}

      {/* Subject selected — show tabs and questions */}
      {questionScope && (
        <div className="mb-20 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-visible rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex overflow-x-auto border-b border-gray-200 px-4" role="tablist" aria-label="Question bank views">
              {questionViews.map(([id, label, count]) => <button key={id} type="button" role="tab" aria-selected={bankView === id} onClick={() => setBankView(id)} className={`min-w-max border-b-2 px-4 py-3 text-sm font-semibold ${bankView === id ? 'border-[#B4454A] text-[#B4454A]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${bankView === id ? 'bg-red-50 text-[#B4454A]' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button>)}
            </div>

            <>
              <div className="flex flex-col gap-3 border-b border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search questions, topics, or answers" className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-red-400" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600"><Filter className="h-4 w-4 text-slate-400" />Question type<select value={selectedQuestionType} onChange={(event) => setSelectedQuestionType(event.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400">{QUESTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <button type="button" onClick={toggleDisplayedSelection} className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><CheckSquare className="h-4 w-4" />{allDisplayedSelected ? 'Clear visible' : 'Select visible'}</button>
              </div>

              <div className="border-b border-gray-200 overflow-x-auto">
                <div className="flex px-4 min-w-max">
                  <button
                    type="button"
                    onClick={() => setActiveTab('All')}
                    className={`flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'All' ? 'border-red-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    All Questions
                    <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{questions.length}</span>
                  </button>
                  {BLOOMS_LEVELS.map((tab) => (
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
                        {countByLevel(tab.name)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 bg-gray-50/30 p-6">
                {loading && (
                  <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Loading questions...
                  </div>
                )}

                {!loading && visibleQuestions.length === 0 && (
                  <div className="py-16 text-center text-gray-400">
                    <svg className="mx-auto mb-3 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No <strong>{activeTab}</strong> questions for <strong>{selectedSubjectName}</strong>.</p>
                  </div>
                )}

                {!loading && visibleQuestions.map((q) => (
                  <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-5 transition-all hover:border-red-200 hover:shadow-sm">
                    {editingQuestion === q.id ? (
                      <div className="space-y-3">
                        <textarea className="w-full resize-none rounded-md border border-gray-200 p-3 text-sm text-gray-700 outline-none focus:border-red-400" rows={3} value={editForm.question} onChange={(e) => setEditForm(prev => ({ ...prev, question: e.target.value }))} />
                        <input className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400" placeholder="Correct answer" value={editForm.correct_answer} onChange={(e) => setEditForm(prev => ({ ...prev, correct_answer: e.target.value }))} />
                        <input className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400" placeholder="Explanation" value={editForm.explanation} onChange={(e) => setEditForm(prev => ({ ...prev, explanation: e.target.value }))} />
                        <div className="flex gap-2">
                          <button onClick={handleEditSave} className="rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700">Save</button>
                          <button onClick={() => setEditingQuestion(null)} className="rounded-md bg-gray-100 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <div className="pt-1">
                          <input type="checkbox" className="h-5 w-5 cursor-pointer rounded accent-red-500" checked={selectedQuestions.includes(q.id)} onChange={() => toggleSelection(q.id)} />
                        </div>
                        <div className="flex-1">
                          {q.topic_name && (
                            <div className="mb-2">
                              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm">
                                📚 Topic: {q.topic_name}
                              </span>
                            </div>
                          )}

                          <p className="mb-3 font-medium text-gray-800">{q.question}</p>

                          {q.options && Array.isArray(q.options) && (
                            <div className="mb-3 space-y-1.5">
                              {q.options.map((opt, i) => (
                                <div
                                  key={i}
                                  className={`rounded-lg px-3 py-2 text-xs ${
                                    opt === q.correct_answer
                                      ? 'border font-medium'
                                      : 'bg-slate-50 text-slate-600'
                                  }`}
                                  style={opt === q.correct_answer ? { borderColor: '#BBE3C7', backgroundColor: '#F1FBF4', color: '#15803D' } : undefined}
                                >
                                  {String.fromCharCode(65 + i)}. {opt}
                                </div>
                              ))}
                            </div>
                          )}

                          {q.question_type === 'Matching Type' && (() => {
                            const { leftItems, rightItems } = getMatchingChoices(q);
                            if (!leftItems.length && !rightItems.length) return null;
                            return <div className="mb-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="mb-1 font-bold text-slate-600">Column A</p>
                                {leftItems.map((item, index) => <p key={index} className="py-1">{index + 1}. {item}</p>)}
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="mb-1 font-bold text-slate-600">Column B</p>
                                {rightItems.map((item, index) => <p key={index} className="py-1">{String.fromCharCode(65 + index)}. {item}</p>)}
                              </div>
                            </div>;
                          })()}

                          {q.correct_answer && !['essay', 'situational'].includes(String(q.question_type || '').toLowerCase()) && (
                            <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#F1FBF4', border: '1px solid #BBE3C7', color: '#15803D' }}>
                              <span className="font-medium">Answer: </span>{formatAnswerKey(q.correct_answer, q)}
                            </p>
                          )}

                          {q.explanation && <p className="mb-3 text-xs italic text-slate-400">{q.explanation}</p>}

                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1.5 text-xs font-medium">
                              <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: PRIMARY_SOFT, color: PRIMARY }}>{q.bloom_level}</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{q.question_type}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => toggleFavorite(q.id)} aria-label={favoriteIds.includes(q.id) ? 'Remove from favorites' : 'Add to favorites'} className={`rounded-md p-1.5 transition-colors ${favoriteIds.includes(q.id) ? '' : 'text-slate-400 hover:text-slate-600'}`} style={favoriteIds.includes(q.id) ? { color: PRIMARY } : undefined}>
                                <Heart className="h-4 w-4" fill={favoriteIds.includes(q.id) ? 'currentColor' : 'none'} />
                              </button>
                              <button type="button" onClick={() => openVersions(q)} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700">Versions</button>
                              <button onClick={() => handleEditOpen(q)} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700">Edit</button>
                              <button onClick={() => handleDelete(q.id)} disabled={deletingId === q.id} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-red-600">
                                {deletingId === q.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto xl:pr-1">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-slate-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Downloads</h3>
                </div>
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-500">Exam type
                    <select value={examType} onChange={(event) => setExamType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#B4454A]">
                      {EXAM_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  {[
                    { key: 'tos', label: 'Download TOS (.xlsx)' },
                    { key: 'docx', label: 'Download test (.docx)' },
                    { key: 'pdf', label: 'Download test (.pdf)' },
                  ].map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => handleSidebarDownload(key)} disabled={!selectedQuestions.length || exporting} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                      <FileText className="h-4 w-4" style={{ color: PRIMARY }} />{label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Saved</p>
                  <h3 className="mt-0.5 text-base font-semibold text-slate-900">Table of specifications</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSidebarInfo((current) => !current)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:text-slate-700"
                  aria-label="Toggle information panel"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>

              {showSidebarInfo && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Selected</span>
                    <span className="font-medium text-slate-900">{selectedQuestionRecords.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Subject</span>
                    <span className="max-w-[150px] truncate text-right font-medium text-slate-800">{selectedSubjectName || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Question mix</span>
                    <span className="font-medium text-slate-800">{summaryQuestionRecords.length ? Math.round((sidebarSummary.analyze + sidebarSummary.evaluate + sidebarSummary.create) / summaryQuestionRecords.length * 100) : 0}% higher-order</span>
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                    ['Remember', sidebarSummary.remember, BLOOMS_LEVELS[0].dotColor],
                    ['Understand', sidebarSummary.understand, BLOOMS_LEVELS[1].dotColor],
                    ['Apply', sidebarSummary.apply, BLOOMS_LEVELS[2].dotColor],
                    ['Analyze', sidebarSummary.analyze, BLOOMS_LEVELS[3].dotColor],
                    ['Evaluate', sidebarSummary.evaluate, BLOOMS_LEVELS[4].dotColor],
                    ['Create', sidebarSummary.create, BLOOMS_LEVELS[5].dotColor],
                  ].map(([label, count, dotColor]) => (
                  <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                        {label}
                      </div>
                    <div className="mt-0.5 text-base font-semibold text-slate-900">{count}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Question details</p>
                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-600">Topics</p>
                    <div className="mt-1 space-y-1">
                      {selectedTopicMix.length ? selectedTopicMix.map(([topic, count]) => (
                        <div key={topic} className="flex items-start justify-between gap-3">
                          <span className="min-w-0 truncate text-slate-500">{topic}</span>
                          <span className="shrink-0 font-semibold text-slate-800">{count}</span>
                        </div>
                      )) : <p className="text-slate-400">Select questions to see topic coverage.</p>}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">Question types</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedTypeMix.length ? selectedTypeMix.map(([type, count]) => (
                        <span key={type} className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{type}: {count}</span>
                      )) : <span className="text-slate-400">None selected</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-slate-500">
                    <span>Answer keys available</span>
                    <span className="font-semibold text-slate-800">{answeredCount}/{sidebarSummary.total}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Explanations available</span>
                    <span className="font-semibold text-slate-800">{explainedCount}/{sidebarSummary.total}</span>
                  </div>
                </div>
              </div>
            </div>

          </aside>
        </div>
      )}

      {/* Sticky Bottom Footer — only show when subject is selected */}
      {selectedSubject && (
        <div className="sticky bottom-0 left-0 right-0 mt-auto bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-b-lg flex justify-between items-center z-20 gap-3">
          <div className="flex items-center gap-3">
            <div className="text-gray-700 font-medium">
              Selected: <span className="text-red-600 font-bold text-lg">{selectedQuestions.length}</span>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="assessment-preview-title" className="bq-modal-panel flex max-h-[calc(100vh-2rem)] w-full max-w-3xl min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b bg-[#fffdfc] p-5"><div><h2 id="assessment-preview-title" className="text-lg font-bold text-slate-900">Assessment preview</h2><p className="mt-1 text-sm text-slate-500">{selectedQuestions.length} selected question{selectedQuestions.length === 1 ? '' : 's'} for {selectedSubjectName}.</p></div><button type="button" onClick={() => setPreviewOpen(false)} className="text-sm font-semibold text-[#B4454A]">Close</button></div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-5">{selectedQuestions.map((questionId, index) => { const question = questions.find((item) => item.id === questionId); if (!question) return null; const matchingChoices = getMatchingChoices(question); return <article key={question.id} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{index + 1}. {question.question}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span>{question.bloom_level}</span><span>{question.question_type}</span></div>{Array.isArray(question.options) && question.options.map((option, optionIndex) => <p key={optionIndex} className="mt-1 text-xs text-slate-600">{String.fromCharCode(65 + optionIndex)}. {option}</p>)}{question.question_type === 'Matching Type' && (matchingChoices.leftItems.length || matchingChoices.rightItems.length) > 0 && <div className="mt-2 grid grid-cols-2 gap-3 text-xs"><div><p className="font-bold text-slate-600">Column A</p>{matchingChoices.leftItems.map((item, itemIndex) => <p key={itemIndex}>{itemIndex + 1}. {item}</p>)}</div><div><p className="font-bold text-slate-600">Column B</p>{matchingChoices.rightItems.map((item, itemIndex) => <p key={itemIndex}>{String.fromCharCode(65 + itemIndex)}. {item}</p>)}</div></div>}</div><div className="flex shrink-0 flex-col items-end gap-1"><button type="button" onClick={() => { setPreviewOpen(false); handleEditOpen(question); }} className="text-xs font-semibold text-[#B4454A] hover:text-[#8f1c2b]">Edit question</button><div className="flex gap-1"><button type="button" onClick={() => moveSelectedQuestion(index, -1)} disabled={index === 0} aria-label="Move question up" className="rounded border px-2 py-1 text-xs disabled:text-slate-300">↑</button><button type="button" onClick={() => moveSelectedQuestion(index, 1)} disabled={index === selectedQuestions.length - 1} aria-label="Move question down" className="rounded border px-2 py-1 text-xs disabled:text-slate-300">↓</button></div></div></div></article>; })}</div>
            <div className="flex shrink-0 justify-end gap-2 border-t bg-[#fffdfc] p-4"><button type="button" onClick={() => setPreviewOpen(false)} className="bq-secondary-button">Close</button></div>
          </section>
        </div>
      )}

      {assessmentSettingsOpen && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssessmentSettingsOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="assessment-settings-title" className="bq-panel w-full max-w-md p-6">
            <h2 id="assessment-settings-title" className="text-lg font-bold text-slate-900">Assessment settings</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the output for {selectedSubjectName || 'this subject'}.</p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">Subject<input value={selectedSubjectName} readOnly className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-600" /></label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">File type<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#B4454A]"><option value="pdf">PDF</option><option value="docx">Word document</option></select></label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">Content<select value={answerMode} onChange={(event) => setAnswerMode(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#B4454A]"><option value="with_key">Questions and answer key</option><option value="questions_only">Questions only</option><option value="key_only">Answer key only</option></select></label>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setAssessmentSettingsOpen(false)} className="bq-secondary-button">Cancel</button></div>
          </section>
        </div>
      )}

      {versionsOpen && versionQuestion && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setVersionsOpen(false); }}>
          <section role="dialog" aria-modal="true" className="bq-panel max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">Question version history</h2><p className="mt-1 text-sm text-slate-500">Previous snapshots for this question.</p></div><button type="button" onClick={() => setVersionsOpen(false)} className="text-sm font-semibold text-red-700">Close</button></div>
            <div className="mt-5 space-y-3">{versions.length ? versions.map((version) => <article key={version.id} className="rounded-lg border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">{version.snapshot.question}</p><p className="mt-2 text-xs text-slate-500">Saved {version.created_at ? new Date(version.created_at).toLocaleString() : 'previously'}</p><button type="button" onClick={() => restoreVersion(version)} className="mt-3 text-xs font-semibold text-[#B4454A]">Restore this version</button></article>) : <p className="text-sm text-slate-500">No previous versions have been saved yet.</p>}</div>
          </section>
        </div>
      )}

      {tosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setTosModalOpen(false); }}>
          <div className="bq-panel w-full max-w-2xl border-[#ead8d5] bg-[#fffdfc] p-7 shadow-[0_20px_50px_rgba(15,23,42,0.18)] rounded-2xl">
            <div className="flex items-start gap-3 mb-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: PRIMARY }}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: PRIMARY }}>Generate Assessment</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Table of Specifications (TOS)</h2>
                <p className="mt-1 text-sm text-slate-500">Configure your assessment details before generating the TOS.</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-5 max-h-[calc(100vh-400px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Semester</label>
                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#B4454A] focus:ring-2 focus:ring-[#B4454A]/15">
                  {SEMESTER_OPTIONS.map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Exam Type</label>
                <select value={examType} onChange={(e) => setExamType(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#B4454A] focus:ring-2 focus:ring-[#B4454A]/15">
                  {EXAM_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">Topics Included ({selectedQuestions.length} questions selected)</p>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-64 overflow-y-auto">
                  {selectedQuestionRecords.length > 0 ? (
                    <>
                      {[...new Map(selectedQuestionRecords.map((q) => [q.topic_name || 'Uncategorized', q])).entries()].map(([topic, q]) => (
                        <div key={topic} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedTopics.includes(topic)}
                            onChange={() => {
                              setSelectedTopics((prev) =>
                                prev.includes(topic)
                                  ? prev.filter((t) => t !== topic)
                                  : [...prev, topic]
                              );
                            }}
                            className="h-4 w-4 rounded border-slate-300"
                            style={{ accentColor: PRIMARY }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{topic}</p>
                          </div>
                          {selectedTopics.includes(topic) && (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold uppercase text-slate-400">Hours</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={subcolumnAValues[topic] || ''}
                                onChange={(e) => setSubcolumnAValues((prev) => ({ ...prev, [topic]: e.target.value }))}
                                className="w-14 rounded-md border border-slate-300 px-2 py-1 text-center text-sm outline-none focus:border-[#B4454A]"
                                placeholder="0"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No questions selected</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setTosModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <div>
                <button
                  type="button"
                  onClick={handleTosGeneration}
                  disabled={generatingTos || selectedTopics.length === 0}
                  className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
                  style={{ backgroundColor: PRIMARY, minWidth: generatingTos ? 280 : undefined }}
                >
                  {generatingTos ? (
                    <GeneratingProgress label="Generating…" />
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Generate & Download TOS
                    </>
                  )}
                </button>
                {/* Progress bar under button */}
                {generatingTos && (
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500 ease-out"
                      style={{
                        width: `${tosSavingProgress}%`,
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
    </div>
  );
};

export default QuestionBank;