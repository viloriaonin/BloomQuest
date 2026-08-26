import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Archive, ArrowRight, Bell, BookOpen, CheckCircle2, Download, FileQuestion, FileSpreadsheet, Search, Server, ShieldCheck, Trash2, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_URL = "/api";

const CONFIG = {
  assessments: { eyebrow: "Assessment workspace", title: "Assessments", description: "Track generated assessment sets and continue unfinished review work." },
  favorites: { eyebrow: "File library", title: "Downloads", description: "Find every test and Table of Specifications you have downloaded." },
  subjects: { eyebrow: "Course structure", title: "Subjects & Topics", description: "Browse the subjects and topic areas available to your workspace." },
  notifications: { eyebrow: "Workspace updates", title: "Notifications", description: "Review important analysis, export, and account updates." },
  imports: { eyebrow: "File operations", title: "Import / Export", description: "Start an analysis or find the files created by your assessment workflow." },
  recycle: { eyebrow: "Recovery", title: "Recycle Bin", description: "Deleted items will appear here when recovery support is enabled." },
  status: { eyebrow: "Service health", title: "System Status", description: "Check the services BloomQuest uses to process and export assessments." },
  help: { eyebrow: "Guidance", title: "Help & Documentation", description: "Find quick answers for the most common BloomQuest workflows." },
};

const getDownloadName = (item) => item.filename || item.file_name || item.details?.match(/'([^']+\.(?:pdf|docx|xlsx))'/i)?.[1] || item.action || "Downloaded file";

const UserToolsPage = ({ section }) => {
  const navigate = useNavigate();
  const config = CONFIG[section] || CONFIG.review;
  const [subjects, setSubjects] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Checking service...");
  const [notifications, setNotifications] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [downloadTab, setDownloadTab] = useState("tests");
  const [downloadError, setDownloadError] = useState("");
  const [preview, setPreview] = useState(null);
  const userId = localStorage.getItem("user_id");
  const email = localStorage.getItem("email");
  const activityQuery = userId ? `user_id=${encodeURIComponent(userId)}` : `email=${encodeURIComponent(email || "")}`;

  useEffect(() => {
    if (section === "recycle") {
      fetch(`${API_URL}/recycle-bin?user_id=${encodeURIComponent(userId || "")}`).then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load recycle bin"))).then((data) => setArchivedItems([
        ...(Array.isArray(data.subjects) ? data.subjects : []).map((item) => ({ ...item, itemType: "subject" })),
        ...(Array.isArray(data.questions) ? data.questions : []).map((item) => ({ ...item, itemType: "question" })),
      ])).catch(() => setArchivedItems([]));
      return;
    }
    if (section === "notifications") {
      fetch(`${API_URL}/history?${activityQuery}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load notifications")))
        .then((data) => setNotifications(Array.isArray(data) ? data : []))
        .catch(() => setNotifications([]));
      return;
    }
    if (section === "favorites") {
      fetch(`${API_URL}/history?${activityQuery}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load downloads")))
        .then((data) => setDownloads(Array.isArray(data) ? data.filter((item) => String(item.type).toLowerCase() === "download") : []))
        .catch(() => setDownloads([]));
      return;
    }
    if (section !== "subjects" && section !== "review") return;
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
  }, [section, userId]);

  const restoreSubject = async (subject) => {
    const response = await fetch(`${API_URL}/recycle-bin/subjects/${subject.id}/restore?user_id=${encodeURIComponent(userId || "")}`, { method: "POST" });
    if (response.ok) setArchivedItems((current) => current.filter((item) => !(item.id === subject.id && item.itemType === "subject")));
  };

  const restoreQuestion = async (question) => {
    const response = await fetch(`${API_URL}/recycle-bin/questions/${question.id}/restore?user_id=${encodeURIComponent(userId || "")}`, { method: "POST" });
    if (response.ok) setArchivedItems((current) => current.filter((item) => !(item.id === question.id && item.itemType === "question")));
  };

  const retrieveDownload = async (item, viewOnly = false) => {
    if (viewOnly) {
      await previewDownload(item);
      return;
    }
    const viewer = viewOnly ? window.open("about:blank", "_blank") : null;
    setDownloadError("");
    try {
      const response = await fetch(`${API_URL}/downloads/${item.id}?user_id=${encodeURIComponent(userId || "")}`);
      if (!response.ok) throw new Error(response.status === 404 ? "This older activity has no saved file to retrieve." : "The file could not be retrieved.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (viewOnly && viewer) viewer.location.href = url;
      else if (!viewOnly) {
        const link = document.createElement("a");
        link.href = url;
        link.download = getDownloadName(item);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (viewer) viewer.close();
      setDownloadError(error.message);
    }
  };

  const previewDownload = async (item) => {
    setDownloadError("");
    try {
      const response = await fetch(`${API_URL}/downloads/${item.id}/preview?user_id=${encodeURIComponent(userId || "")}`);
      if (!response.ok) throw new Error("This saved file cannot be previewed.");
      setPreview(await response.json());
    } catch (error) {
      setDownloadError(error.message);
    }
  };

  const deleteDownload = async (item) => {
    if (!window.confirm(`Delete ${getDownloadName(item)} from Downloads?`)) return;
    const response = await fetch(`${API_URL}/downloads/${item.id}?user_id=${encodeURIComponent(userId || "")}`, { method: "DELETE" });
    if (!response.ok) {
      setDownloadError("The downloaded file could not be deleted.");
      return;
    }
    setDownloads((current) => current.filter((download) => download.id !== item.id));
  };

  useEffect(() => {
    if (section !== "favorites") return undefined;
    const mounted = [];
    document.querySelectorAll("article.bq-panel h3").forEach((heading) => {
      const item = downloads.find((download) => getDownloadName(download) === heading.textContent);
      const card = heading.closest("article");
      if (!item || !card || card.querySelector("[data-download-delete]")) return;
      card.classList.add("relative");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.downloadDelete = "true";
      button.className = "absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600";
      button.title = "Delete downloaded file";
      button.setAttribute("aria-label", `Delete ${getDownloadName(item)}`);
      button.addEventListener("click", () => deleteDownload(item));
      card.appendChild(button);
      const root = createRoot(button);
      root.render(<Trash2 size={16} />);
      mounted.push({ button, root });
    });
    return () => mounted.forEach(({ button, root }) => { root.unmount(); button.remove(); });
  }, [section, downloads, downloadTab]);

  useEffect(() => {
    if (section !== "status") return;
    fetch(`${API_URL}/subjects`).then((response) => setStatus(response.ok ? "All core services operational" : "The API needs attention")).catch(() => setStatus("The API is unavailable"));
  }, [section]);

  const filteredQuestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return questions.filter((question) => {
      return !normalized || [question.question, question.topic_name, question.bloom_level].filter(Boolean).join(" ").toLowerCase().includes(normalized);
    });
  }, [questions, query, section]);

  const groupedDownloads = useMemo(() => ({
    tests: downloads.filter((item) => !/tos|table of specifications/i.test(`${item.action} ${item.details}`)),
    tos: downloads.filter((item) => /tos|table of specifications/i.test(`${item.action} ${item.details}`)),
  }), [downloads]);

  const archivedGroups = useMemo(() => {
    return archivedItems.reduce((groups, item) => {
      const subjectName = item.itemType === "subject" ? item.name : item.subject_name || "Unassigned subject";
      if (!groups[subjectName]) groups[subjectName] = { subject: item.itemType === "subject" ? item : null, questions: [] };
      if (item.itemType === "question") groups[subjectName].questions.push(item);
      return groups;
    }, {});
  }, [archivedItems]);

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
    <>
    {preview?.kind === "pdf" && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"><div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white p-4"><div className="flex items-center justify-between pb-3"><h2 className="font-semibold text-slate-900">{preview.filename}</h2><button type="button" onClick={() => setPreview(null)} className="bq-secondary-button">Close</button></div><iframe title={preview.filename} src={`data:application/pdf;base64,${preview.content}`} className="min-h-0 flex-1 rounded-lg border border-slate-200" /></div></div>}
    <div className="bq-page">
      <div className="bq-page-inner">
        {preview && <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><section role="dialog" aria-modal="true" className="bq-panel flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden p-6"><div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4"><div><p className="bq-eyebrow">File preview</p><h2 className="text-lg font-bold text-slate-900">{preview.filename}</h2></div><button type="button" onClick={() => setPreview(null)} className="bq-secondary-button">Close</button></div><div className="min-h-0 flex-1 overflow-auto pt-4">{preview.kind === "html" ? <article className="mx-auto max-w-3xl bg-white p-8 text-slate-800 shadow-sm [&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_p]:mb-3 [&_p]:leading-7 [&_table]:my-5 [&_table]:w-full [&_td]:border [&_td]:border-slate-300 [&_td]:p-2" dangerouslySetInnerHTML={{ __html: preview.content }} /> : preview.kind === "text" ? <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{preview.content || "No readable text found."}</pre> : <div className="space-y-6">{preview.sheets?.map((sheet) => <div key={sheet.name}><h3 className="mb-2 font-semibold text-slate-800">{sheet.name}</h3><div className="overflow-auto rounded-lg border border-slate-200"><table className="min-w-full text-left text-xs"><tbody>{sheet.rows.map((row, index) => <tr key={index} className="border-b border-slate-100 last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div></div>)}</div>}</div></section></div>}
        <div className="mb-6">
          <p className="bq-eyebrow">{config.eyebrow}</p>
          <h1 className="bq-page-title">{config.title}</h1>
          <p className="bq-page-description">{config.description}</p>
        </div>

        {section === "subjects" && (
          <div className="bq-panel mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === "subjects" ? "Search subjects" : "Search questions, topics, or Bloom levels"} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#B4454A]" /></div>
            <span className="text-xs font-semibold text-slate-500">{section === "subjects" ? `${subjects.length} subjects` : `${filteredQuestions.length} items`}</span>
          </div>
        )}

        {section === "favorites" && downloads.length > 0 && <button type="button" onClick={() => groupedDownloads[downloadTab].forEach((item) => deleteDownload(item))} className="mb-4 text-sm font-semibold text-red-600 hover:text-red-800">Delete files in this tab</button>}
        {section === "favorites" ? (
          downloads.length ? <div>{downloadError && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{downloadError}</div>}<div className="mb-5 flex overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Downloaded files"><button type="button" role="tab" aria-selected={downloadTab === "tests"} onClick={() => setDownloadTab("tests")} className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${downloadTab === "tests" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}><FileQuestion size={16} />Tests <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{groupedDownloads.tests.length}</span></button><button type="button" role="tab" aria-selected={downloadTab === "tos"} onClick={() => setDownloadTab("tos")} className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${downloadTab === "tos" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}><FileSpreadsheet size={16} />Tables of Specification <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{groupedDownloads.tos.length}</span></button></div>{groupedDownloads[downloadTab].length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{groupedDownloads[downloadTab].map((item) => <article key={item.id} className="bq-panel p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]"><Download size={18} /></span><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{getDownloadName(item)}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.details || "Downloaded file"}</p><p className="mt-3 text-xs text-slate-400">{item.date || ""}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => retrieveDownload(item, true)} className="text-sm font-semibold text-[#B4454A] hover:text-[#8F1424]">View</button><button type="button" onClick={() => retrieveDownload(item)} className="text-sm font-semibold text-[#B4454A] hover:text-[#8F1424]">Download again</button></div></div></div></article>)}</div> : <EmptyState title={`No ${downloadTab === "tests" ? "tests" : "Tables of Specifications"} yet`} detail="Downloaded files will appear here." />}</div> : <EmptyState title="No downloads yet" detail="Downloaded tests and Tables of Specifications will appear here." action="Open Question Bank" onClick={() => navigate("/question-bank")} />
        ) : section === "subjects" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{subjects.filter((subject) => `${subject.name} ${subject.code || ""}`.toLowerCase().includes(query.toLowerCase())).map((subject) => <div key={subject.id} className="bq-panel p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]"><BookOpen size={18} /></div><h2 className="mt-4 font-semibold text-slate-900">{subject.name}</h2><p className="mt-1 text-sm text-slate-500">{subject.code || "No course code"}</p><button type="button" onClick={() => navigate("/question-bank")} className="mt-4 text-sm font-semibold text-[#B4454A]">Open question bank <ArrowRight className="ml-1 inline" size={14} /></button></div>)}</div>
        ) : section === "notifications" ? <NotificationView notifications={notifications} />
          : section === "status" ? <StatusView status={status} />
          : section === "recycle" ? (archivedItems.length ? <div className="space-y-6">{Object.entries(archivedGroups).map(([subjectName, group]) => <section key={subjectName}><div className="mb-3 flex items-center gap-2"><BookOpen size={17} className="text-[#B4454A]" /><h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">{subjectName}</h2></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{group.subject && <RecycleCard item={group.subject} onRestore={restoreSubject} />}{group.questions.map((item) => <RecycleCard key={item.id} item={item} onRestore={restoreQuestion} />)}</div></section>)}</div> : <EmptyState title="Recycle Bin is empty" detail="Deleted subjects and questions will appear here for recovery." action="Open Question Bank" onClick={() => navigate("/question-bank")} />)
          : <div className="grid gap-4 md:grid-cols-3">{(cards[section] || cards.assessments).map(([title, detail, path, action]) => <div key={title} className="bq-panel p-5"><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{detail}</p><button type="button" onClick={() => navigate(path)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#B4454A]">{action} <ArrowRight size={14} /></button></div>)}</div>}
      </div>
    </div>
    </>
  );
};

const EmptyState = ({ title, detail, action, onClick }) => <div className="bq-panel flex flex-col items-center justify-center p-12 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">{title}</h2><p className="mt-2 max-w-md text-sm text-slate-500">{detail}</p><button type="button" onClick={onClick} className="bq-primary-button mt-5">{action}</button></div>;
const RecycleCard = ({ item, onRestore }) => <article className="bq-panel overflow-hidden p-0"><div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#FFF7F5] to-white px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]">{item.itemType === "subject" ? <BookOpen size={18} /> : <FileQuestion size={18} />}</span><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B4454A]">Deleted {item.itemType}</span></div><div className="p-5"><h2 className="line-clamp-3 font-semibold text-slate-900">{item.itemType === "subject" ? item.name : item.question}</h2><p className="mt-2 text-sm text-slate-500">{item.itemType === "subject" ? (item.code || "No course code") : `${item.question_type || "Question"} • ${item.bloom_level || "Unclassified"}`}</p><button type="button" onClick={() => onRestore(item)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#B4454A] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7F1D2D]"><Archive size={15} /> Restore</button></div></article>;
const NotificationView = ({ notifications }) => <div className="bq-panel overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#FFF7F5] to-white p-5"><Bell className="text-[#B4454A]" /><div><h2 className="font-semibold text-slate-900">Notification center</h2><p className="text-sm text-slate-500">Your account activity and workspace updates.</p></div></div>{notifications.length ? <div>{notifications.map((item) => <article key={item.id} className="flex gap-3 border-b border-slate-100 p-5 last:border-b-0"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B4454A]/10 text-[#B4454A]"><ShieldCheck size={16} /></span><div><h3 className="text-sm font-semibold text-slate-900">{item.action || "Workspace update"}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{item.details || "An activity was recorded."}</p><p className="mt-2 text-xs text-slate-400">{item.date || ""}</p></div></article>)}</div> : <EmptyState title="No notifications yet" detail="Your analysis, review, and export updates will appear here." />}</div>;
const StatusView = ({ status }) => <div className="grid gap-4 md:grid-cols-3"><div className="bq-panel p-5"><Wifi className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">API service</h2><p className="mt-1 text-sm text-slate-500">{status}</p></div><div className="bq-panel p-5"><Server className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">Question processing</h2><p className="mt-1 text-sm text-slate-500">Available through New Analysis.</p></div><div className="bq-panel p-5"><Download className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">Export service</h2><p className="mt-1 text-sm text-slate-500">PDF and DOCX export available.</p></div></div>;

export default UserToolsPage;
