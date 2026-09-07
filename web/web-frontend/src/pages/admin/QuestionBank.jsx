import React, { useState, useEffect, useRef } from "react";
import { usePopup } from "../../components/PopupProvider";
import { useNavigate, useParams } from "react-router-dom";
import { FlaskConical, Shield, Sigma, FileText } from "lucide-react";

const API_URL = "http://localhost:8000";

const BLOOMS_LEVELS = [
  { name: "Remember", dotColor: "bg-red-400" },
  { name: "Understand", dotColor: "bg-rose-400" },
  { name: "Apply", dotColor: "bg-orange-300" },
  { name: "Analyze", dotColor: "bg-teal-400" },
  { name: "Evaluate", dotColor: "bg-blue-400" },
  { name: "Create", dotColor: "bg-purple-500" },
];

const HIGH_ORDER_LEVELS = ["Analyze", "Evaluate", "Create"];
const SUBJECT_THEMES = [
  { bg: "#F0645A", iconColor: "#FFFFFF", icon: Shield },
  { bg: "#6FA8E0", iconColor: "#FFFFFF", icon: Sigma },
  { bg: "#5CB37B", iconColor: "#FFFFFF", icon: FlaskConical },
];
const QUESTION_TYPE_OPTIONS = [
  { label: "Multiple Choice", value: "MCQ" },
  { label: "True or False", value: "True or False" },
  { label: "Identification", value: "Identification" },
  { label: "Matching Type", value: "Matching Type" },
  { label: "Enumeration", value: "Enumeration" },
  { label: "Essay", value: "Essay" },
  { label: "Situational", value: "Situational" },
];
const LIFECYCLE_OPTIONS = [
  ["draft", "Draft"],
  ["review", "Review"],
  ["approved", "Approved"],
  ["published", "Published"],
  ["deprecated", "Deprecated"],
];

export const QuestionBankContent = () => {
  const { showConfirm, showAlert } = usePopup();
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState("MCQ");
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [questionType, setQuestionType] = useState("All types");
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [totalExportCount, setTotalExportCount] = useState(0);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [moduleFile, setModuleFile] = useState(null);
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const moduleInputRef = useRef(null);
  const syllabusInputRef = useRef(null);

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch(`${API_URL}/api/subjects`);
        if (!res.ok) throw new Error("Failed to fetch subjects");
        const data = await res.json();
        setSubjects(data);
      } catch (err) {
        setError("Could not load subjects.");
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchBankSummary = async () => {
      try {
        const [questionsRes, logsRes] = await Promise.all([
          fetch(`${API_URL}/api/questions`),
          fetch(`${API_URL}/api/activity-logs`),
        ]);
        if (questionsRes.ok)
          setTotalQuestionCount((await questionsRes.json()).length);
        if (logsRes.ok) {
          const logs = await logsRes.json();
          setTotalExportCount(
            logs.filter((item) =>
              /export|download/i.test(`${item.type} ${item.action}`),
            ).length,
          );
        }
      } catch (err) {
        console.error("Failed to load question bank summary:", err);
      }
    };
    fetchBankSummary();
  }, []);

  // Fetch questions when subject changes
  useEffect(() => {
    if (subjectId === "all") {
      setSelectedSubject("");
      setShowAllQuestions(true);
    } else if (subjectId) {
      setSelectedSubject(subjectId);
      setShowAllQuestions(false);
    } else {
      setSelectedSubject("");
      setShowAllQuestions(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (!selectedSubject && !showAllQuestions) {
      setQuestions([]);
      return;
    }
    fetchQuestions(selectedSubject || null);
  }, [selectedSubject, showAllQuestions]);

  const fetchQuestions = async (subjectId) => {
    setLoading(true);
    setError("");
    setSelectedQuestions([]);
    try {
      const subjectQuery = subjectId ? `?subject_id=${subjectId}` : "";
      const res = await fetch(`${API_URL}/api/questions${subjectQuery}`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      setError("Could not load questions.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm(
      "Are you sure you want to delete this question?",
      "Delete Question",
    );
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/questions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setSelectedQuestions((prev) => prev.filter((qId) => qId !== id));
    } catch (err) {
      setError("Failed to delete question.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditOpen = (q) => {
    setEditingQuestion(q.id);
    setEditForm({
      question: q.question,
      correct_answer: q.correct_answer || "",
      explanation: q.explanation || "",
      lifecycle_status: q.lifecycle_status || "draft",
    });
  };

  const handleEditSave = async () => {
    try {
      const formData = new FormData();
      formData.append("question", editForm.question);
      formData.append("correct_answer", editForm.correct_answer);
      formData.append("explanation", editForm.explanation);
      formData.append("lifecycle_status", editForm.lifecycle_status || "draft");
      const res = await fetch(`${API_URL}/api/questions/${editingQuestion}`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) throw new Error("Update failed");
      setQuestions((prev) =>
        prev.map((q) => (q.id === editingQuestion ? { ...q, ...editForm } : q)),
      );
      setEditingQuestion(null);
    } catch (err) {
      setError("Failed to update question.");
    }
  };

  const toggleSelection = (id) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((qId) => qId !== id) : [...prev, id],
    );
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) {
      await showAlert("Please enter the question text.", "Missing Question");
      return;
    }
    if (!selectedSubject) {
      await showAlert(
        "Please select a subject before adding a question.",
        "Missing Subject",
      );
      return;
    }

    setAddingQuestion(true);
    try {
      const payload = {
        question: newQuestionText.trim(),
        question_type: newQuestionType,
        subject_id: parseInt(selectedSubject, 10),
      };

      const res = await fetch(`${API_URL}/api/questions/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to add question");
      }

      await showAlert("Question added successfully and classified.", "Added");
      setShowAddModal(false);
      setNewQuestionText("");
      setNewQuestionType("MCQ");
      fetchQuestions(selectedSubject);
    } catch (err) {
      console.error(err);
      await showAlert(err.message || "Error adding question.", "Error");
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleImportBank = async () => {
    if (!selectedSubject) {
      await showAlert(
        "Please select a subject before importing the bank files.",
        "Missing Subject",
      );
      return;
    }
    if (!moduleFile || !syllabusFile) {
      await showAlert(
        "Please select both a module and syllabus file.",
        "Missing Files",
      );
      return;
    }

    setImporting(true);
    try {
      const form = new FormData();
      form.append("subject_id", selectedSubject);
      form.append("module_file", moduleFile);
      form.append("syllabus_file", syllabusFile);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Import failed.");

      await showAlert("Bank files uploaded successfully.", "Import Complete");
      setShowImportPanel(false);
      setModuleFile(null);
      setSyllabusFile(null);
      await fetchQuestions(selectedSubject);
    } catch (err) {
      await showAlert(
        err.message || "Failed to import bank files.",
        "Import Error",
      );
    } finally {
      setImporting(false);
    }
  };

  const countByLevel = (level) =>
    questions.filter((q) => q.bloom_level === level).length;
  const displayedQuestions = questions.filter((q) => {
    const matchesBloom = activeTab === "All" || q.bloom_level === activeTab;
    const matchesType =
      questionType === "All types" ||
      String(q.question_type || "").toLowerCase() ===
        questionType.toLowerCase();
    const haystack =
      `${q.question || ""} ${q.topic_name || ""} ${q.correct_answer || ""}`.toLowerCase();
    return (
      matchesBloom && matchesType && haystack.includes(searchTerm.toLowerCase())
    );
  });
  const selectedSubjectName =
    subjects.find((s) => s.id === parseInt(selectedSubject))?.name || "";
  const selectedSubjectRecord = subjects.find(
    (subject) => String(subject.id) === String(selectedSubject),
  );
  const questionScope = Boolean(subjectId) && (selectedSubject || showAllQuestions);
  const isSubjectPage = Boolean(subjectId && subjectId !== "all");
  const subjectsByDepartment = subjects.reduce((groups, subject) => {
    const department = subject.department_name || "Unassigned department";
    if (!groups[department]) groups[department] = [];
    groups[department].push(subject);
    return groups;
  }, {});

  // ── Analytics (computed from currently loaded questions) ──
  const totalQuestions = questions.length;
  const readyForReview = questions.filter(
    (q) => !q.explanation || q.explanation.trim() === "",
  ).length;
  const highOrderItems = questions.filter((q) =>
    HIGH_ORDER_LEVELS.includes(q.bloom_level),
  ).length;

  return (
    <div className="w-full flex flex-col pb-20 page-transition">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">
              Question Bank
            </p>
            <h1 className="text-xl font-bold text-gray-900">
              Manage exam questions and bank items
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse, create, and manage exam questions by subject and level.
            </p>
          </div>
        </div>

        {showImportPanel && selectedSubject && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                [
                  "Module File",
                  moduleFile,
                  setModuleFile,
                  moduleInputRef,
                  ".pdf,.docx,.pptx",
                ],
                [
                  "Syllabus File",
                  syllabusFile,
                  setSyllabusFile,
                  syllabusInputRef,
                  ".xlsx,.pdf,.docx",
                ],
              ].map(([label, file, setFile, inputRef, accept]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-left hover:border-[#B4454A]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-[#B4454A]">
                    <FileText size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">
                      {label}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {file?.name || "Choose a file"}
                    </span>
                  </span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] || null)
                    }
                  />
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleImportBank}
                disabled={importing || !moduleFile || !syllabusFile}
                className="bq-primary-button disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? "Importing..." : "Upload Bank Files"}
              </button>
            </div>
          </div>
        )}

        {/* ── Analytics Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Total questions</p>
            <p className="text-3xl font-bold text-gray-900">
              {totalQuestionCount || (questionScope ? totalQuestions : 0)}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Total subjects</p>
            <p className="text-3xl font-bold text-gray-900">
              {subjects.length}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Total exports</p>
            <p className="text-3xl font-bold text-gray-900">
              {totalExportCount}
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

      {isSubjectPage && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-28 items-center justify-between gap-4 bg-[#F0645A] px-6 py-5 text-white">
            <div>
              <button
                type="button"
                onClick={() => navigate("/admin/questions")}
                className="mb-3 text-xs font-semibold text-white/80 hover:text-white"
              >
                &larr; Back to collections
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                Subject collection
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {selectedSubjectName || "Question collection"}
              </h2>
            </div>
            <Shield className="h-10 w-10 shrink-0" />
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Course code</p>
              <p className="mt-1 font-semibold text-slate-800">{selectedSubjectRecord?.code || "No course code"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Department</p>
              <p className="mt-1 font-semibold text-slate-800">{selectedSubjectRecord?.department_name || "Unassigned department"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Created by</p>
              <p className="mt-1 font-semibold text-slate-800">{selectedSubjectRecord?.faculty_name || "System or unassigned"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Questions</p>
              <p className="mt-1 font-semibold text-slate-800">{questions.length} in collection</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-slate-500">{selectedSubjectRecord?.description || "No subject description available."}</p>
              <p className="mt-2 text-xs text-slate-400">
                Generated {selectedSubjectRecord?.created_at ? new Date(selectedSubjectRecord.created_at).toLocaleDateString() : "Date unavailable"}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isSubjectPage && <section className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B4454A]">
              Choose a subject
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Question collections
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/questions/all")}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${showAllQuestions ? "border-[#B4454A] bg-[#B4454A] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-[#B4454A]"}`}
          >
            All Questions
          </button>
        </div>
        {loadingSubjects ? (
          <div className="bg-white p-6 text-sm text-slate-500">
            Loading subjects...
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(subjectsByDepartment).map(
              ([department, departmentSubjects], departmentIndex) => (
                <section key={department}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#C4485A]" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C4485A]">
                        Department
                      </p>
                      <h3 className="text-base font-bold text-slate-900">
                        {department}
                      </h3>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {departmentSubjects.map((subject, index) => {
                      const theme =
                        SUBJECT_THEMES[
                          (departmentIndex + index) % SUBJECT_THEMES.length
                        ];
                      const Icon = theme.icon;
                      return (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => navigate(`/admin/questions/${subject.id}`)}
                          className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-colors hover:border-[#B4454A]/50 hover:shadow-md ${String(subject.id) === String(selectedSubject) ? "border-[#B4454A] ring-1 ring-[#B4454A]" : "border-slate-200"}`}
                        >
                          <div
                            className="relative flex h-24 items-center justify-center"
                            style={{ backgroundColor: theme.bg }}
                          >
                            <Icon
                              className="h-8 w-8"
                              style={{ color: theme.iconColor }}
                            />
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-slate-900">
                                {subject.name}
                              </span>
                              {subject.code && (
                                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                  {subject.code}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {subject.description ||
                                "Manually added subject area"}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              Created by{" "}
                              <span className="font-semibold text-slate-700">
                                {subject.faculty_name || "System or unassigned"}
                              </span>
                            </p>
                            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                              <span className="text-slate-500">
                                Generated{" "}
                                {subject.created_at
                                  ? new Date(
                                      subject.created_at,
                                    ).toLocaleDateString()
                                  : "Date unavailable"}
                              </span>
                              <span className="shrink-0 whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                                {subject.question_count ?? 0} question
                                {(subject.question_count ?? 0) === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </section>}

      {questionScope && (
        <div className="relative z-20 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-sm font-semibold text-slate-700">
            {showAllQuestions ? "All questions" : selectedSubjectName}
          </span>
          <span className="text-sm text-gray-400">
            {questions.length} question{questions.length !== 1 ? "s" : ""} found
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions..."
              className="bq-field px-3 py-2 text-sm"
            />
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="bq-field px-3 py-2 text-sm"
            >
              <option>All types</option>
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                setSelectedQuestions(displayedQuestions.map((q) => q.id))
              }
              className="bq-secondary-button text-xs"
            >
              Select visible
            </button>
            <button
              onClick={() => setSelectedQuestions([])}
              className="bq-secondary-button text-xs"
            >
              Clear
            </button>
            <button
              onClick={() => fetchQuestions(selectedSubject || null)}
              className="bq-secondary-button text-xs"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Subject selected — show tabs and questions */}
      {questionScope && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex-1 flex flex-col overflow-visible mb-20">
          {/* Bloom's Tabs */}
          <div className="border-b border-gray-200 overflow-x-auto">
            <div className="flex px-4 min-w-max">
              <button
                onClick={() => setActiveTab("All")}
                className={`flex items-center gap-2 py-4 px-6 text-sm font-medium transition-colors border-b-2 ${activeTab === "All" ? "border-red-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                All Questions{" "}
                <span className="bg-gray-100 text-gray-500 text-xs py-0.5 px-2 rounded-full">
                  {questions.length}
                </span>
              </button>
              {BLOOMS_LEVELS.map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex items-center gap-2 py-4 px-6 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.name
                      ? "border-red-600 text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${tab.dotColor}`}
                  ></span>
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
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Loading questions...
              </div>
            )}

            {/* Empty state */}
            {!loading && displayedQuestions.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <svg
                  className="w-12 h-12 mx-auto mb-3 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm">
                  No <strong>{activeTab}</strong> questions for{" "}
                  <strong>{selectedSubjectName}</strong>.
                </p>
              </div>
            )}

            {/* Questions */}
            {!loading &&
              displayedQuestions.map((q) => (
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
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            question: e.target.value,
                          }))
                        }
                      />
                      <input
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                        placeholder="Correct answer"
                        value={editForm.correct_answer}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            correct_answer: e.target.value,
                          }))
                        }
                      />
                      <input
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                        placeholder="Explanation"
                        value={editForm.explanation}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            explanation: e.target.value,
                          }))
                        }
                      />
                      <select
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                        value={editForm.lifecycle_status}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            lifecycle_status: e.target.value,
                          }))
                        }
                      >
                        {LIFECYCLE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={handleEditSave}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-4 py-2 rounded-md"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingQuestion(null)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium px-4 py-2 rounded-md"
                        >
                          Cancel
                        </button>
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
                        <p className="text-gray-800 font-medium mb-3">
                          {q.question}
                        </p>

                        {/* MCQ Options */}
                        {q.options && Array.isArray(q.options) && (
                          <div className="mb-3 space-y-1">
                            {q.options.map((opt, i) => (
                              <div
                                key={i}
                                className={`text-xs px-3 py-1.5 rounded-md ${
                                  opt === q.correct_answer
                                    ? "bg-green-50 text-green-700 font-semibold border border-green-200"
                                    : "bg-gray-50 text-gray-600"
                                }`}
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Answer for non-MCQ */}
                        {q.correct_answer &&
                          (!q.options || !Array.isArray(q.options)) && (
                            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-1.5 mb-3">
                              <span className="font-semibold">Answer: </span>
                              {q.correct_answer}
                            </p>
                          )}

                        {/* Explanation */}
                        {q.explanation && (
                          <p className="text-xs text-gray-400 mb-3 italic">
                            {q.explanation}
                          </p>
                        )}

                        {/* Tags + Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-2 text-xs font-medium">
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-md">
                              {q.bloom_level}
                            </span>
                            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-md">
                              {q.lifecycle_status || "draft"}
                            </span>
                            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-md">
                              {q.question_type}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditOpen(q)}
                              className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-1"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(q.id)}
                              disabled={deletingId === q.id}
                              className="text-xs text-gray-400 hover:text-red-600 transition-colors px-2 py-1"
                            >
                              {deletingId === q.id ? "Deleting..." : "Delete"}
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

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bq-modal-panel w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Question</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <div className="text-sm text-gray-600">
                  {selectedSubjectName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question
                </label>
                <textarea
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="w-full rounded-md border border-gray-200 p-3 text-sm"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question Type
                </label>
                <select
                  value={newQuestionType}
                  onChange={(e) => setNewQuestionType(e.target.value)}
                  className="rounded-md border border-gray-200 p-2 text-sm"
                >
                  {QUESTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddQuestion}
                  disabled={addingQuestion}
                  className="rounded-full bg-red-700 px-4 py-2 text-sm text-white"
                >
                  {addingQuestion ? "Adding..." : "Add Question"}
                </button>
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
              background: "var(--bq-accent)",
              color: "#ffffff",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
            }
          : { color: "var(--bq-muted)", background: "transparent" }
      }
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: "#fff" }}
        />
      )}
      {/* Clipboard list icon for Question Bank */}
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        style={{ color: isActive ? "#ffffff" : "var(--bq-accent)" }}
      >
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path
          fillRule="evenodd"
          d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-sm font-medium tracking-wide">Question Bank</span>
    </button>
  );
};

export default QuestionBankBtn;
