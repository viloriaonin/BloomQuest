import React, { useState, useEffect } from 'react';
import { usePopup } from '../../components/PopupProvider';

const API_URL = 'http://localhost:8000';

const BLOOMS_LEVELS = [
  { name: 'Remember',   dotColor: 'bg-red-400' },
  { name: 'Understand', dotColor: 'bg-rose-400' },
  { name: 'Apply',      dotColor: 'bg-orange-300' },
  { name: 'Analyze',    dotColor: 'bg-teal-400' },
  { name: 'Evaluate',   dotColor: 'bg-blue-400' },
  { name: 'Create',     dotColor: 'bg-purple-500' },
];

const HIGH_ORDER_LEVELS = ['Analyze', 'Evaluate', 'Create'];

export const QuestionBankContent = () => {
  const { showConfirm, showAlert } = usePopup();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState("MCQ");
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [activeTab, setActiveTab]             = useState('Remember');
  const [subjects, setSubjects]               = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [questions, setQuestions]             = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError]                     = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [deletingId, setDeletingId]           = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm]               = useState({});

  // Fetch subjects on mount
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
    if (!selectedSubject) {
      setQuestions([]);
      return;
    }
    fetchQuestions(selectedSubject);
  }, [selectedSubject]);

  const fetchQuestions = async (subjectId) => {
    setLoading(true);
    setError('');
    setSelectedQuestions([]);
    try {
      const res = await fetch(`${API_URL}/api/questions?subject_id=${subjectId}`);
      if (!res.ok) throw new Error('Failed to fetch questions');
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      setError('Could not load questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Are you sure you want to delete this question?', 'Delete Question');
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/questions/${id}`, { method: 'DELETE' });
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

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) {
      await showAlert("Please enter the question text.", "Missing Question");
      return;
    }
    if (!selectedSubject) {
      await showAlert("Please select a subject before adding a question.", "Missing Subject");
      return;
    }

    setAddingQuestion(true);
    try {
      const payload = {
        question: newQuestionText.trim(),
        question_type: newQuestionType,
        subject_id: parseInt(selectedSubject, 10)
      };

      const res = await fetch(`${API_URL}/api/questions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to add question');
      }

      await showAlert('Question added successfully and classified.', 'Added');
      setShowAddModal(false);
      setNewQuestionText('');
      setNewQuestionType('MCQ');
      fetchQuestions(selectedSubject);
    } catch (err) {
      console.error(err);
      await showAlert(err.message || 'Error adding question.', 'Error');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleGenerateAssessment = async () => {
    if (selectedQuestions.length === 0) {
      await showAlert('Select at least one question to generate an assessment.', 'No Questions');
      return;
    }
    try {
      const form = new FormData();
      form.append('subject_id', selectedSubject);
      form.append('question_ids', selectedQuestions.join(','));
      form.append('export_format', 'pdf');

      const res = await fetch(`${API_URL}/api/questions/export`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Attempt to get filename from content-disposition
      const cd = res.headers.get('content-disposition') || '';
      const match = /filename=(?:"?)([^";]+)(?:"?)/.exec(cd);
      const filename = match ? match[1] : `assessment_${Date.now()}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      await showAlert('Assessment generated and downloaded.', 'Export');
    } catch (err) {
      console.error(err);
      await showAlert(err.message || 'Failed to export assessment.', 'Error');
    }
  };

  const countByLevel = (level) => questions.filter(q => q.bloom_level === level).length;
  const displayedQuestions = questions.filter(q => q.bloom_level === activeTab);
  const selectedSubjectName = subjects.find(s => s.id === parseInt(selectedSubject))?.name || '';

  // ── Analytics (computed from currently loaded questions) ──
  const totalQuestions = questions.length;
  const readyForReview = questions.filter(q => !q.explanation || q.explanation.trim() === '').length;
  const highOrderItems = questions.filter(q => HIGH_ORDER_LEVELS.includes(q.bloom_level)).length;

  return (
    <div className="w-full flex flex-col pb-20 page-transition">

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">Question Bank</p>
            <h1 className="text-xl font-bold text-gray-900">Manage exam questions and bank items</h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse, create, and manage exam questions by subject and level.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(true)} className="bg-[#b90000] hover:bg-[#990000] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors whitespace-nowrap">
              Add Question
            </button>
            <button className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-5 py-2.5 rounded-full transition-colors whitespace-nowrap">
              Import Bank
            </button>
          </div>
        </div>

        {/* ── Analytics Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Total questions</p>
            <p className="text-3xl font-bold text-gray-900">
              {selectedSubject ? totalQuestions : '—'}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Ready for review</p>
            <p className="text-3xl font-bold text-gray-900">
              {selectedSubject ? readyForReview : '—'}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">High-order items</p>
            <p className="text-3xl font-bold text-gray-900">
              {selectedSubject ? highOrderItems : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Subject Filter ── */}
      <div className="relative z-20 bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-4">
        <span className="text-gray-600 font-medium text-sm whitespace-nowrap">Filter by Subject:</span>
        <select
          className="border border-gray-200 rounded-md p-2 text-sm text-gray-600 focus:outline-none focus:border-red-400 flex-1 max-w-xs cursor-pointer"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          disabled={loadingSubjects}
        >
          <option value="">— Select a subject —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.code ? `(${s.code})` : ''}
            </option>
          ))}
        </select>

        {selectedSubject && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-gray-400">
              {questions.length} question{questions.length !== 1 ? 's' : ''} found
            </span>
            <button
              onClick={() => fetchQuestions(selectedSubject)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-3 py-1.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* No subject selected — placeholder */}
      {!selectedSubject && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex-1 flex flex-col items-center justify-center text-center p-12 mb-20">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </div>
          <h3 className="text-gray-500 font-medium mb-1">No Subject Selected</h3>
          <p className="text-sm text-gray-400">Please select a subject above to view its questions.</p>
        </div>
      )}

      {/* Subject selected — show tabs and questions */}
      {selectedSubject && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex-1 flex flex-col overflow-visible mb-20">

          {/* Bloom's Tabs */}
          <div className="border-b border-gray-200 overflow-x-auto">
            <div className="flex px-4 min-w-max">
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

          {/* Question List */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-gray-50/30">

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-16 gap-3 text-gray-400 fade-in">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Loading questions...
              </div>
            )}

            {/* Empty state */}
            {!loading && displayedQuestions.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No <strong>{activeTab}</strong> questions for <strong>{selectedSubjectName}</strong>.</p>
              </div>
            )}

            {/* Questions */}
            {!loading && displayedQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-gray-200 rounded-lg p-5 transition-all hover:border-red-200 hover:shadow-sm"
              >
                {editingQuestion === q.id ? (
                  <div className="space-y-3">
                    <textarea
                      className="w-full border border-gray-200 rounded-md p-3 text-sm text-gray-700 focus:outline-none focus:border-red-400 resize-none"
                      rows={3}
                      value={editForm.question}
                      onChange={(e) => setEditForm(prev => ({ ...prev, question: e.target.value }))}
                    />
                    <input
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                      placeholder="Correct answer"
                      value={editForm.correct_answer}
                      onChange={(e) => setEditForm(prev => ({ ...prev, correct_answer: e.target.value }))}
                    />
                    <input
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                      placeholder="Explanation"
                      value={editForm.explanation}
                      onChange={(e) => setEditForm(prev => ({ ...prev, explanation: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleEditSave} className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-4 py-2 rounded-md">Save</button>
                      <button onClick={() => setEditingQuestion(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium px-4 py-2 rounded-md">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 cursor-pointer accent-red-500"
                        checked={selectedQuestions.includes(q.id)}
                        onChange={() => toggleSelection(q.id)}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium mb-3">{q.question}</p>

                      {/* MCQ Options */}
                      {q.options && Array.isArray(q.options) && (
                        <div className="mb-3 space-y-1">
                          {q.options.map((opt, i) => (
                            <div key={i} className={`text-xs px-3 py-1.5 rounded-md ${
                              opt === q.correct_answer
                                ? 'bg-green-50 text-green-700 font-semibold border border-green-200'
                                : 'bg-gray-50 text-gray-600'
                            }`}>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Answer for non-MCQ */}
                      {q.correct_answer && (!q.options || !Array.isArray(q.options)) && (
                        <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-1.5 mb-3">
                          <span className="font-semibold">Answer: </span>{q.correct_answer}
                        </p>
                      )}

                      {/* Explanation */}
                      {q.explanation && (
                        <p className="text-xs text-gray-400 mb-3 italic">{q.explanation}</p>
                      )}

                      {/* Tags + Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2 text-xs font-medium">
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-md">{q.bloom_level}</span>
                          <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-md">{q.question_type}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditOpen(q)} className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-1">Edit</button>
                          <button
                            onClick={() => handleDelete(q.id)}
                            disabled={deletingId === q.id}
                            className="text-xs text-gray-400 hover:text-red-600 transition-colors px-2 py-1"
                          >
                            {deletingId === q.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom Footer — only show when subject is selected */}
      {selectedSubject && (
        <div className="sticky bottom-0 left-0 right-0 mt-auto bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex justify-between items-center z-20">
          <div className="text-gray-700 font-medium max-w-5xl mx-auto w-full flex justify-between items-center px-2">
            <span>Selected: <span className="text-red-600 font-bold text-lg">{selectedQuestions.length}</span></span>
            <button
              onClick={handleGenerateAssessment}
              disabled={selectedQuestions.length === 0}
              className={`py-2 px-6 rounded-md font-medium text-sm transition-colors ${
                selectedQuestions.length > 0
                  ? 'bg-[#b90000] hover:bg-[#990000] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Generate Assessment ({selectedQuestions.length})
            </button>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Question</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <div className="text-sm text-gray-600">{selectedSubjectName}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <textarea value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} className="w-full rounded-md border border-gray-200 p-3 text-sm" rows={4} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                <select value={newQuestionType} onChange={(e) => setNewQuestionType(e.target.value)} className="rounded-md border border-gray-200 p-2 text-sm">
                  <option>MCQ</option>
                  <option>Short Answer</option>
                  <option>Essay</option>
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowAddModal(false)} className="rounded-full border border-gray-300 px-4 py-2 text-sm">Cancel</button>
                <button onClick={handleAddQuestion} disabled={addingQuestion} className="rounded-full bg-red-700 px-4 py-2 text-sm text-white">{addingQuestion ? 'Adding...' : 'Add Question'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const QuestionBankBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "question-bank";

  return (
    <button
      onClick={() => setActiveTab("question-bank")}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 relative"
      style={
        isActive
          ? {
              background: "rgba(255,255,255,0.15)",
              color: "#ffffff",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
            }
          : { color: "rgba(255,255,255,0.65)", background: "transparent" }
      }
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: "#fff" }}
        />
      )}
      {/* Clipboard list icon for Question Bank */}
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"
        style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.5)" }}>
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Question Bank</span>
    </button>
  );
};

export default QuestionBankBtn;