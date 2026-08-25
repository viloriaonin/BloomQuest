import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Download, Search, Server, ShieldCheck, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_URL = "/api";

const CONFIG = {
  assessments: { eyebrow: "Assessment workspace", title: "Assessments", description: "Track generated assessment sets and continue unfinished review work." },
  favorites: { eyebrow: "Saved items", title: "Favorites", description: "Keep frequently reused questions close at hand." },
  subjects: { eyebrow: "Course structure", title: "Subjects & Topics", description: "Browse the subjects and topic areas available to your workspace." },
  notifications: { eyebrow: "Workspace updates", title: "Notifications", description: "Review important analysis, export, and account updates." },
  imports: { eyebrow: "File operations", title: "Import / Export", description: "Start an analysis or find the files created by your assessment workflow." },
  recycle: { eyebrow: "Recovery", title: "Recycle Bin", description: "Deleted items will appear here when recovery support is enabled." },
  status: { eyebrow: "Service health", title: "System Status", description: "Check the services BloomQuest uses to process and export assessments." },
  help: { eyebrow: "Guidance", title: "Help & Documentation", description: "Find quick answers for the most common BloomQuest workflows." },
};

const UserToolsPage = ({ section }) => {
  const navigate = useNavigate();
  const config = CONFIG[section] || CONFIG.review;
  const [subjects, setSubjects] = useState([]);
  const [archivedSubjects, setArchivedSubjects] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Checking service...");

  useEffect(() => {
    if (section === "recycle") {
      fetch(`${API_URL}/recycle-bin/subjects`).then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load recycle bin"))).then((data) => setArchivedSubjects(Array.isArray(data) ? data : [])).catch(() => setArchivedSubjects([]));
      return;
    }
    if (section !== "subjects" && section !== "review" && section !== "favorites") return;
    Promise.all([
      fetch(`${API_URL}/subjects`).then((response) => response.ok ? response.json() : []),
      fetch(`${API_URL}/questions`).then((response) => response.ok ? response.json() : []),
    ]).then(([subjectData, questionData]) => {
      setSubjects(Array.isArray(subjectData) ? subjectData : []);
      setQuestions(Array.isArray(questionData) ? questionData : []);
    }).catch(() => {
      setSubjects([]);
      setQuestions([]);
    });
  }, [section]);

  const restoreSubject = async (subject) => {
    const response = await fetch(`${API_URL}/recycle-bin/subjects/${subject.id}/restore`, { method: "POST" });
    if (response.ok) setArchivedSubjects((current) => current.filter((item) => item.id !== subject.id));
  };

  useEffect(() => {
    if (section !== "status") return;
    fetch(`${API_URL}/subjects`).then((response) => setStatus(response.ok ? "All core services operational" : "The API needs attention")).catch(() => setStatus("The API is unavailable"));
  }, [section]);

  const filteredQuestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return questions.filter((question) => {
      const isFavorite = section === "favorites" && JSON.parse(localStorage.getItem("bloomquest-favorite-questions") || "[]").includes(question.id);
      const matchesSection = section === "favorites" ? isFavorite : true;
      return matchesSection && (!normalized || [question.question, question.topic_name, question.bloom_level].filter(Boolean).join(" ").toLowerCase().includes(normalized));
    });
  }, [questions, query, section]);

  const cards = {
    assessments: [
      ["Continue analysis", "Return to an unfinished upload or blueprint.", "/input", "Open New Analysis"],
      ["Question Bank", "Select reviewed questions and prepare an assessment.", "/question-bank", "Open Question Bank"],
      ["Activity history", "Review completed generations and exports.", "/history", "View History"],
    ],
    imports: [
      ["New analysis", "Upload a module and course information sheet.", "/input", "Start import"],
      ["Question Bank", "Export selected questions as a compiled assessment.", "/question-bank", "Open Question Bank"],
      ["History", "Find previous uploads and generated activity.", "/history", "View History"],
    ],
    help: [
      ["Upload and analyze", "Learn which files are accepted and how the analysis stages work.", "/input", "Open guide"],
      ["Export an assessment", "Preview selected questions before creating the final document.", "/question-bank", "Open Question Bank"],
    ],
  };

  return (
    <div className="bq-page">
      <div className="bq-page-inner">
        <div className="mb-6">
          <p className="bq-eyebrow">{config.eyebrow}</p>
          <h1 className="bq-page-title">{config.title}</h1>
          <p className="bq-page-description">{config.description}</p>
        </div>

        {(section === "favorites" || section === "subjects") && (
          <div className="bq-panel mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === "subjects" ? "Search subjects" : "Search questions, topics, or Bloom levels"} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#B4454A]" /></div>
            <span className="text-xs font-semibold text-slate-500">{section === "subjects" ? `${subjects.length} subjects` : `${filteredQuestions.length} items`}</span>
          </div>
        )}

        {section === "favorites" ? (
          filteredQuestions.length ? <div className="space-y-3">{filteredQuestions.map((question) => <article key={question.id} className="bq-panel p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold text-slate-900">{question.question}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span>{question.bloom_level}</span><span>{question.question_type}</span><span>{question.difficulty || "moderate"}</span><span>{question.review_status === "approved" ? "Approved" : "Needs review"}</span></div></div><button type="button" onClick={() => navigate(`/question-bank?question=${question.id}`)} className="inline-flex items-center gap-2 text-sm font-semibold text-[#B4454A]">Open <ArrowRight size={14} /></button></div></article>)}</div> : <EmptyState title="No favorites yet" detail="Save questions from the Question Bank to find them here." action="Open Question Bank" onClick={() => navigate("/question-bank")} />
        ) : section === "subjects" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{subjects.filter((subject) => `${subject.name} ${subject.code || ""}`.toLowerCase().includes(query.toLowerCase())).map((subject) => <div key={subject.id} className="bq-panel p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]"><BookOpen size={18} /></div><h2 className="mt-4 font-semibold text-slate-900">{subject.name}</h2><p className="mt-1 text-sm text-slate-500">{subject.code || "No course code"}</p><button type="button" onClick={() => navigate("/question-bank")} className="mt-4 text-sm font-semibold text-[#B4454A]">Open question bank <ArrowRight className="ml-1 inline" size={14} /></button></div>)}</div>
        ) : section === "notifications" ? <NotificationView />
          : section === "status" ? <StatusView status={status} />
          : section === "recycle" ? (archivedSubjects.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{archivedSubjects.map((subject) => <article key={subject.id} className="bq-panel p-5"><h2 className="font-semibold text-slate-900">{subject.name}</h2><p className="mt-1 text-sm text-slate-500">{subject.code || "No course code"}</p><p className="mt-2 text-xs text-slate-400">Deleted subject</p><button type="button" onClick={() => restoreSubject(subject)} className="mt-4 text-sm font-semibold text-emerald-700">Restore</button></article>)}</div> : <EmptyState title="Recycle Bin is empty" detail="Deleted subjects will appear here for recovery." action="Open Question Bank" onClick={() => navigate("/question-bank")} />)
          : <div className="grid gap-4 md:grid-cols-3">{(cards[section] || cards.assessments).map(([title, detail, path, action]) => <div key={title} className="bq-panel p-5"><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{detail}</p><button type="button" onClick={() => navigate(path)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#B4454A]">{action} <ArrowRight size={14} /></button></div>)}</div>}
      </div>
    </div>
  );
};

const EmptyState = ({ title, detail, action, onClick }) => <div className="bq-panel flex flex-col items-center justify-center p-12 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">{title}</h2><p className="mt-2 max-w-md text-sm text-slate-500">{detail}</p><button type="button" onClick={onClick} className="bq-primary-button mt-5">{action}</button></div>;
const NotificationView = () => <div className="bq-panel p-6"><div className="flex items-center gap-3"><ShieldCheck className="text-[#B4454A]" /><div><h2 className="font-semibold text-slate-900">Notification center</h2><p className="text-sm text-slate-500">Your latest notifications are available from the bell icon in the top bar.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[#FFF7E8] p-4"><p className="text-xs font-bold uppercase text-amber-700">Analysis</p><p className="mt-1 text-sm text-slate-700">Completion and upload alerts</p></div><div className="rounded-lg bg-[#F0FDF4] p-4"><p className="text-xs font-bold uppercase text-emerald-700">Review</p><p className="mt-1 text-sm text-slate-700">Questions waiting for approval</p></div><div className="rounded-lg bg-[#F8FAFC] p-4"><p className="text-xs font-bold uppercase text-slate-600">Account</p><p className="mt-1 text-sm text-slate-700">Security and access updates</p></div></div></div>;
const StatusView = ({ status }) => <div className="grid gap-4 md:grid-cols-3"><div className="bq-panel p-5"><Wifi className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">API service</h2><p className="mt-1 text-sm text-slate-500">{status}</p></div><div className="bq-panel p-5"><Server className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">Question processing</h2><p className="mt-1 text-sm text-slate-500">Available through New Analysis.</p></div><div className="bq-panel p-5"><Download className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">Export service</h2><p className="mt-1 text-sm text-slate-500">PDF and DOCX export available.</p></div></div>;

export default UserToolsPage;
