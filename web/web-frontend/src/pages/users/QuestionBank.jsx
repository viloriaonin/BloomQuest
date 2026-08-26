import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, ChevronRight, Copy, Download, FileText, Filter, FlaskConical, FolderPlus, Heart, Info, Pencil, Plus, Search, Shield, Sigma, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePopup } from '../../components/PopupProvider';

const API_URL = 'http://localhost:8000';
const PRIMARY = '#8F1424';
const PRIMARY_SOFT = '#FBEEEF';
const border = 'rgba(15, 23, 42, 0.08)';

const EXAM_TYPE_OPTIONS = ['Midterm Exam', 'Final Exam', 'Quiz', 'Long Exam'];
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

const QuestionBank = () => {
  const { showConfirm } = usePopup();
  const navigate = useNavigate();
  const location = useLocation();
  const { subjectId, setId } = useParams();
  const isCreatingSet = location.pathname.endsWith('/create-set');
  const [activeTab, setActiveTab]             = useState('All');
  const [subjects, setSubjects]               = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [questionSelectionOpen, setQuestionSelectionOpen] = useState(false);
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
  const [questionTypeFilter, setQuestionTypeFilter] = useState('All types');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assessmentSettingsOpen, setAssessmentSettingsOpen] = useState(false);
  const [answerMode, setAnswerMode] = useState('with_key');
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bloomquest-favorite-questions') || '[]'); } catch { return []; }
  });
  const [savedSets, setSavedSets] = useState([]);
  const [activeSetId, setActiveSetId] = useState(() => Number(localStorage.getItem('bloomquest-question-bank-set')) || null);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [setsQuery, setSetsQuery] = useState('');
  const [, setSetSaving] = useState(false);
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
  const undoTimerRef = useRef(null);
  const skipSetSaveRef = useRef(false);

  useEffect(() => {
    setSelectedSubject(subjectId === 'all' ? '' : subjectId || '');
    setShowAllQuestions(subjectId === 'all');
    setQuestionSelectionOpen(Boolean(setId));
  }, [subjectId, setId]);

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isCreatingSet || !subjectId || !subjects.length) return;
    const subject = subjects.find((item) => String(item.id) === String(subjectId));
    if (subject && !newSetName) setNewSetName(`${subject.code || subject.name} Assessment - ${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`);
  }, [isCreatingSet, subjectId, subjects, newSetName]);

  useEffect(() => {
    if (!setId || !savedSets.length) return;
    const questionSet = savedSets.find((item) => String(item.id) === String(setId));
    if (questionSet && activeSetId !== questionSet.id) {
      setActiveSetId(questionSet.id);
      setSelectedQuestions(questionSet.question_ids || []);
    }
  }, [setId, savedSets, activeSetId]);

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
    setActiveSetId(null);
    if (!selectedSubject) {
      setSavedSets([]);
      return;
    }
    fetch(`${API_URL}/api/question-sets?subject_id=${selectedSubject}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSavedSets(Array.isArray(data) ? data : []))
      .catch(() => setSavedSets([]));
  }, [selectedSubject, showAllQuestions]);

  useEffect(() => {
    if (!activeSetId || skipSetSaveRef.current) {
      skipSetSaveRef.current = false;
      return;
    }
    setSetSaving(true);
    fetch(`${API_URL}/api/question-sets/${activeSetId}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_ids: selectedQuestions }),
    })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Could not save question set')))
      .then((updated) => setSavedSets((current) => current.map((item) => item.id === updated.id ? updated : item)))
      .catch((err) => setError(err.message))
      .finally(() => setSetSaving(false));
  }, [selectedQuestions, activeSetId]);

  useEffect(() => {
    if (selectedSubject) localStorage.setItem('bloomquest-question-bank-subject', selectedSubject);
    if (activeSetId) localStorage.setItem('bloomquest-question-bank-set', String(activeSetId));
    else localStorage.removeItem('bloomquest-question-bank-set');
    localStorage.setItem('bloomquest-question-bank-view', bankView);
  }, [selectedSubject, activeSetId, bankView]);

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

  const createQuestionSet = async (event) => {
    event.preventDefault();
    if (!newSetName.trim() || !selectedSubject) return;
    try {
      const res = await fetch(`${API_URL}/api/question-sets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSetName.trim(), subject_id: Number(selectedSubject), exam_title: newSetName.trim() }),
      });
      if (!res.ok) throw new Error('Could not create question set');
      const created = await res.json();
      setSavedSets((current) => [created, ...current]);
      setActiveSetId(created.id);
      setSelectedQuestions([]);
      setNewSetName('');
      setNewSetOpen(false);
      setQuestionSelectionOpen(false);
      navigate(`/question-bank/${selectedSubject}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const renameQuestionSet = async (event, questionSet) => {
    event.stopPropagation();
    const name = window.prompt('Rename question set', questionSet.name);
    if (!name?.trim() || name.trim() === questionSet.name) return;
    try {
      const res = await fetch(`${API_URL}/api/question-sets/${questionSet.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
      if (!res.ok) throw new Error('Could not rename question set');
      const updated = await res.json();
      setSavedSets((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) { setError(err.message); }
  };

  const duplicateQuestionSet = async (event, questionSet) => {
    event.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/api/question-sets/${questionSet.id}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Could not duplicate question set');
      const duplicate = await res.json();
      setSavedSets((current) => [duplicate, ...current]);
    } catch (err) { setError(err.message); }
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

  const openQuestionSet = (questionSet) => {
    skipSetSaveRef.current = true;
    setActiveSetId(questionSet.id);
    setSelectedQuestions(questionSet.question_ids || []);
    setQuestionSelectionOpen(true);
    navigate(`/question-bank/${selectedSubject}/set/${questionSet.id}`);
  };

  const deleteQuestionSet = async (event, questionSet) => {
    event.stopPropagation();
    const confirmed = await showConfirm(`Delete "${questionSet.name}" and its saved selection?`, 'Delete Question Set');
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_URL}/api/question-sets/${questionSet.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete question set');
      setSavedSets((current) => current.filter((item) => item.id !== questionSet.id));
      if (activeSetId === questionSet.id) {
        setActiveSetId(null);
        setSelectedQuestions([]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const countByLevel = (level) => questions.filter(q => q.bloom_level === level).length;
  const displayedQuestions = questions.filter(q => {
    const matchesLevel = activeTab === 'All' || q.bloom_level === activeTab;
    const matchesType = questionTypeFilter === 'All types' || q.question_type === questionTypeFilter;
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch = !normalizedSearch || [q.question, q.topic_name, q.correct_answer].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
    return matchesLevel && matchesType && matchesSearch;
  });
  const questionTypes = ['All types', ...new Set(questions.map((question) => question.question_type).filter(Boolean))];
  const allDisplayedSelected = displayedQuestions.length > 0 && displayedQuestions.every((question) => selectedQuestions.includes(question.id));

  const toggleDisplayedSelection = () => {
    if (allDisplayedSelected) {
      setSelectedQuestions((current) => current.filter((id) => !displayedQuestions.some((question) => question.id === id)));
    } else {
      setSelectedQuestions((current) => [...new Set([...current, ...displayedQuestions.map((question) => question.id)])]);
    }
  };
  const selectedSubjectName = subjects.find(s => s.id === parseInt(selectedSubject))?.name || '';
  const activeQuestionSetName = savedSets.find((questionSet) => String(questionSet.id) === String(setId))?.name || 'Question set';
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
  const summaryQuestionRecords = selectedQuestionRecords.length > 0 ? selectedQuestionRecords : questions;
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

  const selectedTosSummary = BLOOMS_LEVELS.map((level) => {
    const count = summaryQuestionRecords.filter((q) => q.bloom_level === level.name).length;
    const weight = summaryQuestionRecords.length ? (count / summaryQuestionRecords.length) * 100 : 0;
    return {
      ...level,
      count,
      weight,
    };
  });

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
      link.download = `assessment-export.${format}`;
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
    setError('');

    try {
      const formData = new FormData();
      formData.append('subject_id', selectedSubject);
      formData.append('question_ids', selectedQuestions.join(','));
      formData.append('exam_type', examType);
      formData.append('semester', semester);
      const userId = localStorage.getItem('user_id');
      if (userId) formData.append('user_id', userId);

      const res = await fetch(`${API_URL}/api/questions/export/tos`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('TOS generation failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedSubjectName || 'question-bank'}-TOS-${examType.replace(/\s+/g, '-')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Reset modal
      setTosModalOpen(false);
      setSelectedTopics([]);
      setSubcolumnAValues({});
    } catch (err) {
      setError(err.message || 'TOS generation failed.');
    } finally {
      setGeneratingTos(false);
    }
  };

  const handleGenerateAssessment = async () => {
    if (selectedQuestions.length === 0) return;
    setExporting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('subject_id', selectedSubject);
      formData.append('question_ids', selectedQuestions.join(','));
      formData.append('export_format', exportFormat);
      formData.append('answer_mode', answerMode);
      formData.append('include_answer_key', String(answerMode !== 'questions_only'));
      formData.append('user_id', localStorage.getItem('user_id') || '');
      const res = await fetch(`${API_URL}/api/questions/export`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Assessment export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compiled_assessment.${exportFormat === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bq-page">
      <div className="bq-page-inner">

      {/* Header */}
      <div className="bq-page-header">
        <div>
        <nav aria-label="Question Bank navigation" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-500">
          <button type="button" onClick={() => navigate('/question-bank')} className={`transition-colors hover:text-[#B4454A] ${!subjectId ? 'text-slate-700' : ''}`}>Subjects</button>
          {subjectId && <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
            {setId ? <>
              <button type="button" onClick={() => navigate(`/question-bank/${selectedSubject}`)} className="max-w-full break-words text-left transition-colors hover:text-[#B4454A]">{selectedSubjectName || 'Subject'}</button>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
              <span className="max-w-full break-words text-slate-700">{activeQuestionSetName}</span>
            </> : <span className="max-w-full break-words text-slate-700">{selectedSubjectName || 'Subject'}</span>}
          </>}
        </nav>
        <p className="bq-eyebrow">Build and manage</p>
        <h1 className="bq-page-title">Question Bank</h1>
        <p className="bq-page-description">Organize generated questions, saved sets, and assessment exports.</p>
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

      {subjectId && <button type="button" onClick={() => navigate(questionSelectionOpen ? `/question-bank/${selectedSubject}` : '/question-bank')} className="mb-4 text-sm font-semibold text-[#B4454A] hover:text-[#8f3439]">&larr; {questionSelectionOpen ? 'Back to question set' : 'Back to subjects'}</button>}

      {isCreatingSet && (
        <section className="bq-panel mb-4 max-w-2xl p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4454A]">New question set</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Create a set for {selectedSubjectName || 'this subject'}</h2>
          <p className="mt-2 text-sm text-slate-500">Create the set first, then choose the questions you want to include.</p>
          <form onSubmit={createQuestionSet} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Set name<input autoFocus value={newSetName} onChange={(event) => setNewSetName(event.target.value)} placeholder="e.g. Midterm Exam" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#B4454A]" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => navigate('/question-bank')} className="bq-secondary-button">Cancel</button><button type="submit" disabled={!newSetName.trim()} className="bq-primary-button disabled:cursor-not-allowed disabled:bg-slate-300">Create Set</button></div>
          </form>
        </section>
      )}

      {!isCreatingSet && selectedSubject && !questionSelectionOpen && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">
                <button type="button" onClick={() => navigate('/question-bank')} className="hover:text-slate-700">Subjects</button>
                <span className="mx-1.5">›</span>
                <span>{selectedSubjectName}</span>
              </p>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900">Saved question sets</h2>
              <p className="mt-1 text-sm text-slate-500">Selections save automatically inside the active set.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/question-bank/${selectedSubject}/create-set`)}
              className="shrink-0 rounded-lg bg-[#B4454A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#963a3e]"
            >
              + Create set
            </button>
          </div>

          <div className="relative mt-5 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={setsQuery}
              onChange={(event) => setSetsQuery(event.target.value)}
              placeholder="Search sets"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#B4454A]"
            />
          </div>

          {savedSets.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {savedSets
                .filter((questionSet) => questionSet.name.toLowerCase().includes(setsQuery.toLowerCase()))
                .map((questionSet) => (
                  <div
                    key={questionSet.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openQuestionSet(questionSet)}
                    onKeyDown={(event) => { if (event.key === 'Enter') openQuestionSet(questionSet); }}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      activeSetId === questionSet.id
                        ? 'border-[#B4454A]/60 bg-red-50/40'
                        : 'border-slate-200 bg-slate-50/60 hover:border-[#B4454A]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-slate-900">{questionSet.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          questionSet.status === 'exported'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {questionSet.status === 'exported' ? 'Exported' : 'Draft'}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      {questionSet.question_count} question{questionSet.question_count === 1 ? '' : 's'} · {Object.keys(questionSet.statistics?.bloom || {}).length} Bloom levels
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {questionSet.updated_at ? new Date(questionSet.updated_at).toLocaleDateString() : 'today'} · {questionSet.export_history?.length || 0} export{questionSet.export_history?.length === 1 ? '' : 's'}
                    </p>

                    <div className="mt-4 flex items-center gap-4 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={(event) => renameQuestionSet(event, questionSet)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Rename
                      </button>
                      <button
                        type="button"
                        onClick={(event) => duplicateQuestionSet(event, questionSet)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
                      >
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={(event) => deleteQuestionSet(event, questionSet)}
                        aria-label={`Delete ${questionSet.name}`}
                        className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                ))}

              <button
                type="button"
                onClick={() => navigate(`/question-bank/${selectedSubject}/create-set`)}
                className="flex min-h-[176px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#B4454A]/50 hover:bg-red-50/20"
              >
                <FolderPlus className="h-6 w-6 text-slate-500" />
                <span className="text-sm text-slate-500">Start another set for this subject.</span>
                <span className="rounded-lg bg-[#B4454A] px-4 py-2 text-sm font-semibold text-white">Create set</span>
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <FolderPlus className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">No saved sets for this subject yet</p>
                <p className="mt-1 text-sm text-slate-500">Create one before selecting questions.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/question-bank/${selectedSubject}/create-set`)}
                className="mt-1 rounded-lg bg-[#B4454A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#963a3e]"
              >
                Create your first set
              </button>
            </div>
          )}
        </section>
      )}

      {newSetOpen && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewSetOpen(false); }}>
          <form onSubmit={createQuestionSet} className="bq-panel w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900">Create question set</h2>
            <p className="mt-1 text-sm text-slate-500">Save a named selection for {selectedSubjectName || 'this subject'}.</p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">Set name<input autoFocus value={newSetName} onChange={(event) => setNewSetName(event.target.value)} placeholder="e.g. Midterm Exam" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#B4454A]" /></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setNewSetOpen(false)} className="bq-secondary-button">Cancel</button><button type="submit" disabled={!newSetName.trim()} className="bq-primary-button disabled:cursor-not-allowed disabled:bg-slate-300">Create set</button></div>
          </form>
        </div>
      )}

      {!isCreatingSet && selectedSubject && questionSelectionOpen && questions.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="bq-panel p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Higher-order items</p><p className="mt-1 text-2xl font-bold text-slate-900">{highOrderCoverage}%</p><p className="mt-1 text-xs text-slate-500">Analyze, Evaluate, or Create</p></div>
        </div>
      )}

      {/* Subject selected — show tabs and questions */}
      {!isCreatingSet && questionScope && questionSelectionOpen && (
        <div className="mb-20 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-visible rounded-xl border border-gray-100 bg-white shadow-sm">
            {selectedQuestionRecords.length > 0 && (
              <div className="border-b border-slate-200 bg-[#f7faf7] p-5">
                <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4454A]">TOS Summary</p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-900">Table of Specifications Summary</h3>
                    <p className="mt-1 text-sm text-slate-500">This summary reflects the selected question distribution across Bloom&apos;s taxonomy levels.</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Total Selected Questions</p>
                    <p className="text-3xl font-bold text-[#B4454A]">{selectedQuestionRecords.length}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedTosSummary.map((row) => (
                    <div key={row.name} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-slate-800">{row.name}</span>
                        <span className="text-sm font-semibold text-slate-500">{row.count} item{row.count === 1 ? '' : 's'}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#B4454A]" style={{ width: `${Math.min(row.weight, 100)}%` }} />
                      </div>
                      <div className="mt-2 text-xs font-medium text-slate-500">Weight: {row.weight.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex overflow-x-auto border-b border-gray-200 px-4" role="tablist" aria-label="Question bank views">
              {questionViews.map(([id, label, count]) => <button key={id} type="button" role="tab" aria-selected={bankView === id} onClick={() => setBankView(id)} className={`min-w-max border-b-2 px-4 py-3 text-sm font-semibold ${bankView === id ? 'border-[#B4454A] text-[#B4454A]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${bankView === id ? 'bg-red-50 text-[#B4454A]' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button>)}
            </div>

            <>
              <div className="flex flex-col gap-3 border-b border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search questions, topics, or answers" className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-red-400" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600"><Filter className="h-4 w-4" /><select value={questionTypeFilter} onChange={(event) => setQuestionTypeFilter(event.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400">{questionTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
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

                          {q.question_type === 'Matching Type' && (
                            (q.options && !Array.isArray(q.options) && (q.options.left_items || q.options.right_items)) ||
                            (q.left_items && q.right_items && Array.isArray(q.left_items) && Array.isArray(q.right_items))
                          ) && (
                            <div className="mb-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="mb-1 font-bold text-slate-600">Column A</p>
                                {((q.options?.left_items || q.left_items) || []).map((item, index) => <p key={index} className="py-1">{index + 1}. {item}</p>)}
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="mb-1 font-bold text-slate-600">Column B</p>
                                {((q.options?.right_items || q.right_items) || []).map((item, index) => <p key={index} className="py-1">{String.fromCharCode(65 + index)}. {item}</p>)}
                              </div>
                            </div>
                          )}

                          {q.correct_answer && (!q.options || !Array.isArray(q.options)) && (
                            <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#F1FBF4', border: '1px solid #BBE3C7', color: '#15803D' }}>
                              <span className="font-medium">Answer: </span>{q.correct_answer}
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

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Downloads</h3>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { key: 'tos', label: 'Download TOS (.xlsx)' },
                  { key: 'docx', label: 'Download test (.docx)' },
                  { key: 'pdf', label: 'Download test (.pdf)' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSidebarDownload(key)}
                    disabled={!selectedQuestions.length || exporting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FileText className="h-4 w-4" style={{ color: PRIMARY }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Sticky Bottom Footer — only show when subject is selected */}
      {!isCreatingSet && selectedSubject && questionSelectionOpen && (
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
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-5">{selectedQuestions.map((questionId, index) => { const question = questions.find((item) => item.id === questionId); if (!question) return null; return <article key={question.id} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{index + 1}. {question.question}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span>{question.bloom_level}</span><span>{question.question_type}</span></div>{Array.isArray(question.options) && question.options.map((option, optionIndex) => <p key={optionIndex} className="mt-1 text-xs text-slate-600">{String.fromCharCode(65 + optionIndex)}. {option}</p>)}{question.question_type === 'Matching Type' && question.options && !Array.isArray(question.options) && <div className="mt-2 grid grid-cols-2 gap-3 text-xs"><div><p className="font-bold text-slate-600">Column A</p>{(question.options.left_items || []).map((item, itemIndex) => <p key={itemIndex}>{itemIndex + 1}. {item}</p>)}</div><div><p className="font-bold text-slate-600">Column B</p>{(question.options.right_items || []).map((item, itemIndex) => <p key={itemIndex}>{String.fromCharCode(65 + itemIndex)}. {item}</p>)}</div></div>}</div><div className="flex shrink-0 flex-col items-end gap-1"><button type="button" onClick={() => { setPreviewOpen(false); handleEditOpen(question); }} className="text-xs font-semibold text-[#B4454A] hover:text-[#8f1c2b]">Edit question</button><div className="flex gap-1"><button type="button" onClick={() => moveSelectedQuestion(index, -1)} disabled={index === 0} aria-label="Move question up" className="rounded border px-2 py-1 text-xs disabled:text-slate-300">↑</button><button type="button" onClick={() => moveSelectedQuestion(index, 1)} disabled={index === selectedQuestions.length - 1} aria-label="Move question down" className="rounded border px-2 py-1 text-xs disabled:text-slate-300">↓</button></div></div></div></article>; })}</div>
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
              <button
                type="button"
                onClick={handleTosGeneration}
                disabled={generatingTos || selectedTopics.length === 0}
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
                style={{ backgroundColor: PRIMARY }}
              >
                {generatingTos ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Generate & Download TOS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default QuestionBank;