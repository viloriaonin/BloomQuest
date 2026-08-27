import React, { useEffect, useState } from "react";
import { ArchiveRestore, History, RotateCcw, ShieldCheck } from "lucide-react";
import { usePopup } from "../../components/PopupProvider";

const API_URL = "http://localhost:8000";
const LIFECYCLE_OPTIONS = [
  ["draft", "Draft"],
  ["review", "Review"],
  ["approved", "Approved"],
  ["published", "Published"],
  ["deprecated", "Deprecated"],
];
const DIFFICULTY_OPTIONS = [
  ["easy", "Easy"],
  ["moderate", "Moderate"],
  ["hard", "Hard"],
];

const Governance = () => {
  const { showAlert, showConfirm } = usePopup();
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState("");
  const [insights, setInsights] = useState({ faculty: [], content_quality_score: 0 });

  const loadGovernance = async () => {
    setLoading(true);
    setError("");
    try {
      const userId = encodeURIComponent(localStorage.getItem("user_id") || "");
      const [recycleResponse, insightsResponse] = await Promise.all([
        fetch(`${API_URL}/api/recycle-bin?user_id=${userId}`),
        fetch(`${API_URL}/api/admin/insights`),
      ]);
      if (!recycleResponse.ok) throw new Error("Could not load governance records.");
      const data = await recycleResponse.json();
      setQuestions(data.questions || []);
      setSubjects(data.subjects || []);
      if (insightsResponse.ok) setInsights(await insightsResponse.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGovernance();
  }, []);

  const updateQuestion = async (question, field, value) => {
    setSavingId(question.id);
    try {
      const form = new FormData();
      form.append("question", question.question || "");
      form.append("correct_answer", question.correct_answer || "");
      form.append("explanation", question.explanation || "");
      form.append("review_status", field === "review_status" ? value : question.review_status || "needs_review");
      form.append("difficulty", field === "difficulty" ? value : question.difficulty || "moderate");
      form.append("lifecycle_status", field === "lifecycle_status" ? value : question.lifecycle_status || "draft");
      const response = await fetch(`${API_URL}/api/questions/${question.id}`, { method: "PUT", body: form });
      if (!response.ok) throw new Error("Could not update question review settings.");
      setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, [field]: value } : item));
    } catch (err) {
      await showAlert(err.message, "Governance Error");
    } finally {
      setSavingId(null);
    }
  };

  const restoreQuestion = async (id) => {
    if (!(await showConfirm("Restore this question to the active question bank?", "Restore Question"))) return;
    const userId = encodeURIComponent(localStorage.getItem("user_id") || "");
    const response = await fetch(`${API_URL}/api/recycle-bin/questions/${id}/restore?user_id=${userId}`, { method: "POST" });
    if (!response.ok) return showAlert("Could not restore question.", "Restore Error");
    await showAlert("Question restored successfully.", "Restored");
    loadGovernance();
  };

  const restoreSubject = async (id) => {
    if (!(await showConfirm("Restore this subject and its academic record?", "Restore Subject"))) return;
    const userId = encodeURIComponent(localStorage.getItem("user_id") || "");
    const response = await fetch(`${API_URL}/api/recycle-bin/subjects/${id}/restore?user_id=${userId}`, { method: "POST" });
    if (!response.ok) return showAlert("Could not restore subject.", "Restore Error");
    await showAlert("Subject restored successfully.", "Restored");
    loadGovernance();
  };

  const openVersions = async (id) => {
    const response = await fetch(`${API_URL}/api/questions/${id}/versions`);
    if (!response.ok) return showAlert("Could not load question history.", "History Error");
    setVersions({ questionId: id, items: await response.json() });
  };

  const restoreVersion = async (questionId, versionId) => {
    if (!(await showConfirm("Restore this version of the question?", "Restore Version"))) return;
    const response = await fetch(`${API_URL}/api/questions/${questionId}/versions/${versionId}/restore`, { method: "POST" });
    if (!response.ok) return showAlert("Could not restore this version.", "Version Error");
    await showAlert("Question version restored.", "Restored");
    setVersions(null);
    loadGovernance();
  };

  return (
    <div className="space-y-4 page-transition">
      <section className="bq-admin-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#C4485A]" /><h2>Content Governance</h2></div><p className="bq-admin-muted mt-1">Review question quality, recover archived content, and restore earlier versions.</p></div>
          <button type="button" onClick={loadGovernance} className="bq-admin-action"><RotateCcw size={14} /> Refresh</button>
        </div>
      </section>

      {error && <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
      {loading ? <div className="bq-admin-panel bq-admin-muted">Loading governance records...</div> : <>
        <section className="bq-admin-panel">
          <div className="mb-4 flex items-center justify-between"><div><h2>Review Queue</h2><p className="bq-admin-muted mt-1">Archived questions can be restored here after review.</p></div><span className="bq-admin-tag">{questions.length} archived</span></div>
          {questions.length === 0 ? <p className="bq-admin-muted py-6 text-center">No archived questions require attention.</p> : <div className="space-y-3">{questions.map((question) => <article key={question.id} className="bq-admin-metric"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><p className="font-medium text-[#ECEDEF]">{question.question}</p><p className="bq-admin-muted mt-1">{question.subject_name || "No subject"} · {question.bloom_level || "Unclassified"}</p></div><div className="flex flex-wrap gap-2"><select value={question.lifecycle_status || "archived"} disabled={savingId === question.id} onChange={(event) => updateQuestion(question, "lifecycle_status", event.target.value)} className="bq-field px-2 py-1 text-xs"><option value="archived">Archived</option>{LIFECYCLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={question.difficulty || "moderate"} disabled={savingId === question.id} onChange={(event) => updateQuestion(question, "difficulty", event.target.value)} className="bq-field px-2 py-1 text-xs">{DIFFICULTY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={() => openVersions(question.id)} className="bq-secondary-button px-2 py-1 text-xs"><History size={13} /> History</button><button type="button" onClick={() => restoreQuestion(question.id)} className="bq-secondary-button px-2 py-1 text-xs"><ArchiveRestore size={13} /> Restore</button></div></div></article>)}</div>}
        </section>
        <section className="bq-admin-panel"><div className="mb-4 flex items-center justify-between"><div><h2>Faculty Performance</h2><p className="bq-admin-muted mt-1">Contribution volume and content quality proxy.</p></div><span className="bq-admin-tag">Overall quality {insights.content_quality_score}%</span></div>{insights.faculty.length === 0 ? <p className="bq-admin-muted py-6 text-center">No faculty contribution data yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-4">Faculty</th><th className="py-2 pr-4">Department</th><th className="py-2 pr-4">Questions</th><th className="py-2">Quality</th></tr></thead><tbody>{insights.faculty.map((member) => <tr key={member.faculty_id} className="border-b border-slate-800"><td className="py-3 pr-4">{member.faculty_name}</td><td className="py-3 pr-4 bq-admin-muted">{member.department}</td><td className="py-3 pr-4">{member.questions_contributed}</td><td className="py-3"><span className="bq-admin-tag">{member.content_quality_score}%</span></td></tr>)}</tbody></table></div>}</section>
        <section className="bq-admin-panel"><div className="mb-4 flex items-center justify-between"><div><h2>Archived Subjects</h2><p className="bq-admin-muted mt-1">Recover subjects removed from academic management.</p></div><span className="bq-admin-tag">{subjects.length} archived</span></div>{subjects.length === 0 ? <p className="bq-admin-muted py-6 text-center">No archived subjects.</p> : <div className="grid gap-3 md:grid-cols-2">{subjects.map((subject) => <div key={subject.id} className="bq-admin-metric flex items-center justify-between gap-3"><div><p className="font-medium text-[#ECEDEF]">{subject.name}</p><p className="bq-admin-muted mt-1">{subject.code || "No course code"}</p></div><button type="button" onClick={() => restoreSubject(subject.id)} className="bq-secondary-button px-2 py-1 text-xs"><ArchiveRestore size={13} /> Restore</button></div>)}</div>}</section>
      </>}

      {versions && <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"><section className="bq-modal-panel w-full max-w-2xl p-5"><div className="mb-4 flex items-center justify-between"><h2>Question Version History</h2><button type="button" onClick={() => setVersions(null)} className="bq-secondary-button px-3 py-1 text-xs">Close</button></div>{versions.items.length === 0 ? <p className="bq-admin-muted">No saved versions.</p> : <div className="space-y-3">{versions.items.map((version) => <div key={version.id} className="bq-admin-metric"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="bq-admin-mono">{version.created_at ? new Date(version.created_at).toLocaleString() : "Saved version"}</p><p className="mt-2 text-sm text-[#ECEDEF]">{version.snapshot?.question || "Unavailable question text"}</p></div><button type="button" onClick={() => restoreVersion(versions.questionId, version.id)} className="bq-secondary-button shrink-0 px-2 py-1 text-xs"><RotateCcw size={13} /> Restore</button></div></div>)}</div>}</section></div>}
    </div>
  );
};

export default Governance;
