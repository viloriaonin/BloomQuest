import React, { useEffect, useState } from "react";
import { ArchiveRestore, RotateCcw, ShieldCheck } from "lucide-react";
import { usePopup } from "../../components/PopupProvider";
import { API_URL } from "../../api";

const Governance = () => {
  const { showAlert, showConfirm } = usePopup();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState("");
  const [insights, setInsights] = useState({ faculty: [], content_quality_score: 0 });

  const loadGovernance = async () => {
    setLoading(true);
    setError("");
    try {
      const userId = encodeURIComponent(localStorage.getItem("user_id") || "");
      const [recycleResponse, insightsResponse] = await Promise.all([
        fetch(`${API_URL}/recycle-bin?user_id=${userId}`),
        fetch(`${API_URL}/admin/insights`),
      ]);
      if (!recycleResponse.ok) throw new Error("Could not load governance records.");
      const data = await recycleResponse.json();
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

  const restoreSubject = async (id) => {
    if (!(await showConfirm("Restore this subject and its academic record?", "Restore Subject"))) return;
    const userId = encodeURIComponent(localStorage.getItem("user_id") || "");
    const response = await fetch(`${API_URL}/recycle-bin/subjects/${id}/restore?user_id=${userId}`, { method: "POST" });
    if (!response.ok) return showAlert("Could not restore subject.", "Restore Error");
    await showAlert("Subject restored successfully.", "Restored");
    loadGovernance();
  };

  const restoreVersion = async (questionId, versionId) => {
    if (!(await showConfirm("Restore this version of the question?", "Restore Version"))) return;
    const response = await fetch(`${API_URL}/questions/${questionId}/versions/${versionId}/restore`, { method: "POST" });
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
        <section className="bq-admin-panel"><div className="mb-4 flex items-center justify-between"><div><h2>Faculty Performance</h2><p className="bq-admin-muted mt-1">Contribution volume and content quality proxy.</p></div><span className="bq-admin-tag">Overall quality {insights.content_quality_score}%</span></div>{insights.faculty.length === 0 ? <p className="bq-admin-muted py-6 text-center">No faculty contribution data yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-4">Faculty</th><th className="py-2 pr-4">Department</th><th className="py-2 pr-4">Questions</th><th className="py-2">Quality</th></tr></thead><tbody>{insights.faculty.map((member) => <tr key={member.faculty_id} className="border-b border-slate-800"><td className="py-3 pr-4">{member.faculty_name}</td><td className="py-3 pr-4 bq-admin-muted">{member.department}</td><td className="py-3 pr-4">{member.questions_contributed}</td><td className="py-3"><span className="bq-admin-tag">{member.content_quality_score}%</span></td></tr>)}</tbody></table></div>}</section>
        <section className="bq-admin-panel"><div className="mb-4 flex items-center justify-between"><div><h2>Archived Subjects</h2><p className="bq-admin-muted mt-1">Recover subjects removed from academic management.</p></div><span className="bq-admin-tag">{subjects.length} archived</span></div>{subjects.length === 0 ? <p className="bq-admin-muted py-6 text-center">No archived subjects.</p> : <div className="grid gap-3 md:grid-cols-2">{subjects.map((subject) => <div key={subject.id} className="bq-admin-metric flex items-center justify-between gap-3"><div><p className="font-medium text-[#ECEDEF]">{subject.name}</p><p className="bq-admin-muted mt-1">{subject.code || "No course code"}</p></div><button type="button" onClick={() => restoreSubject(subject.id)} className="bq-secondary-button px-2 py-1 text-xs"><ArchiveRestore size={13} /> Restore</button></div>)}</div>}</section>
      </>}

      {versions && <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"><section className="bq-modal-panel w-full max-w-2xl p-5"><div className="mb-4 flex items-center justify-between"><h2>Question Version History</h2><button type="button" onClick={() => setVersions(null)} className="bq-secondary-button px-3 py-1 text-xs">Close</button></div>{versions.items.length === 0 ? <p className="bq-admin-muted">No saved versions.</p> : <div className="space-y-3">{versions.items.map((version) => <div key={version.id} className="bq-admin-metric"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="bq-admin-mono">{version.created_at ? new Date(version.created_at).toLocaleString() : "Saved version"}</p><p className="mt-2 text-sm text-[#ECEDEF]">{version.snapshot?.question || "Unavailable question text"}</p></div><button type="button" onClick={() => restoreVersion(versions.questionId, version.id)} className="bq-secondary-button shrink-0 px-2 py-1 text-xs"><RotateCcw size={13} /> Restore</button></div></div>)}</div>}</section></div>}
    </div>
  );
};

export default Governance;
