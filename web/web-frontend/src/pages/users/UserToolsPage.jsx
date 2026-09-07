import React, { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, Bell, BookOpen, CheckCircle2, Download, FileQuestion, FileSpreadsheet, Search, Server, ShieldCheck, Trash2, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePopup } from "../../components/PopupProvider";

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
  const { showConfirm } = usePopup();
  const config = CONFIG[section] || CONFIG.review;
  const [subjects, setSubjects] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Checking service...");
  const [notifications, setNotifications] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [downloadTab, setDownloadTab] = useState("tests");
  const [downloadError, setDownloadError] = useState("");
  const [selectedDownloadIds, setSelectedDownloadIds] = useState([]);
  const userId = localStorage.getItem("user_id");
  const email = localStorage.getItem("email");
  const activityQuery = userId ? `user_id=${encodeURIComponent(userId)}` : `email=${encodeURIComponent(email || "")}`;

  useEffect(() => {
    if (section === "recycle") {
      fetch(`${API_URL}/recycle-bin?user_id=${encodeURIComponent(userId || "")}`).then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load recycle bin"))).then((data) => setArchivedItems([
        ...(Array.isArray(data.subjects) ? data.subjects : []).map((item) => ({ ...item, itemType: "subject" })),
        ...(Array.isArray(data.questions) ? data.questions : []).map((item) => ({ ...item, itemType: "question" })),
        ...(Array.isArray(data.downloads) ? data.downloads : []).map((item) => ({ ...item, itemType: "download" })),
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
    const endpoint = question.itemType === "download" ? "downloads" : "questions";
    const response = await fetch(`${API_URL}/recycle-bin/${endpoint}/${question.id}/restore?user_id=${encodeURIComponent(userId || "")}`, { method: "POST" });
    if (response.ok) setArchivedItems((current) => current.filter((item) => !(item.id === question.id && item.itemType === question.itemType)));
  };

  const archivedKey = (item) => `${item.itemType}:${item.id}`;

  const permanentlyDeleteSelected = async () => {
    const selectedItems = archivedItems.filter((item) => selectedArchivedIds.includes(archivedKey(item)));
    if (!selectedItems.length) return;
    const confirmed = await showConfirm(
      `Permanently delete ${selectedItems.length} selected item${selectedItems.length === 1 ? "" : "s"}? This cannot be undone.`,
      "Delete Archived Items",
    );
    if (!confirmed) return;
    const results = await Promise.all(selectedItems.map((item) => fetch(`${API_URL}/recycle-bin/${item.itemType}s/${item.id}?user_id=${encodeURIComponent(userId || "")}`, { method: "DELETE" })));
    const deletedKeys = selectedItems.filter((_, index) => results[index].ok).map(archivedKey);
    setArchivedItems((current) => current.filter((item) => !deletedKeys.includes(archivedKey(item))));
    setSelectedArchivedIds((current) => current.filter((id) => !deletedKeys.includes(id)));
  };

  const retrieveDownload = async (item) => {
    setDownloadError("");

    try {
      const response = await fetch(`${API_URL}/downloads/${item.id}?user_id=${encodeURIComponent(userId || "")}`);
      if (!response.ok) throw new Error(response.status === 404 ? "This older activity has no saved file to retrieve." : "The file could not be retrieved.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadName(item);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setDownloadError(error.message);
    }
  };

  const deleteSelectedDownloads = async () => {
    const selectedItems = downloads.filter((item) => selectedDownloadIds.includes(item.id));
    if (!selectedItems.length) return;
    const confirmed = await showConfirm(
      `Delete ${selectedItems.length} selected downloaded file${selectedItems.length === 1 ? "" : "s"}? This cannot be undone.`,
      "Delete Downloads",
    );
    if (!confirmed) return;

    const results = await Promise.all(
      selectedItems.map(async (item) => {
        const response = await fetch(`${API_URL}/downloads/${item.id}?user_id=${encodeURIComponent(userId || "")}`, { method: "DELETE" });
        return response.ok ? item.id : null;
      }),
    );

    const deletedIds = results.filter(Boolean);
    if (!deletedIds.length) {
      setDownloadError("The selected downloaded files could not be deleted.");
      return;
    }

    setDownloads((current) => current.filter((item) => !deletedIds.includes(item.id)));
    setSelectedDownloadIds((current) => current.filter((id) => !deletedIds.includes(id)));
  };

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
      const subjectName = item.itemType === "subject" ? item.name : item.itemType === "download" ? "Downloaded files" : item.subject_name || "Unassigned subject";
      if (!groups[subjectName]) groups[subjectName] = { subject: item.itemType === "subject" ? item : null, questions: [], downloads: [] };
      if (item.itemType === "question" || item.itemType === "download") groups[subjectName].questions.push(item);
      return groups;
    }, {});
  }, [archivedItems]);

  if (section === "favorites") {
    return <DownloadsView downloads={downloads} downloadTab={downloadTab} setDownloadTab={setDownloadTab} groupedDownloads={groupedDownloads} selectedDownloadIds={selectedDownloadIds} setSelectedDownloadIds={setSelectedDownloadIds} deleteSelectedDownloads={deleteSelectedDownloads} retrieveDownload={retrieveDownload} downloadError={downloadError} navigate={navigate} />;
  }

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
    <div className="bq-page">
      <div className="bq-page-inner">
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

        {section === "favorites" && downloads.length > 0 && selectedDownloadIds.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={deleteSelectedDownloads} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700">
              <Trash2 size={15} /> Delete selected
            </button>
          </div>
        )}
        {section === "favorites" ? (
          <>
            {downloads.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"><span className="text-sm font-semibold text-slate-700">Select files:</span>{downloads.map((item) => <label key={item.id} className="inline-flex max-w-full items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={selectedDownloadIds.includes(item.id)} onChange={(event) => setSelectedDownloadIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} aria-label={`Select ${getDownloadName(item)}`} className="h-4 w-4 accent-[#B4454A]" /><span className="max-w-48 truncate">{getDownloadName(item)}</span></label>)}</div>}
            {downloads.length ? <div>{downloadError && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{downloadError}</div>}<div className="mb-5 flex overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Downloaded files"><button type="button" role="tab" aria-selected={downloadTab === "tests"} onClick={() => setDownloadTab("tests")} className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${downloadTab === "tests" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}><FileQuestion size={16} />Tests <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{groupedDownloads.tests.length}</span></button><button type="button" role="tab" aria-selected={downloadTab === "tos"} onClick={() => setDownloadTab("tos")} className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${downloadTab === "tos" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}><FileSpreadsheet size={16} />Tables of Specification <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{groupedDownloads.tos.length}</span></button></div>{groupedDownloads[downloadTab].length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{groupedDownloads[downloadTab].map((item) => <article key={item.id} className="bq-panel p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]"><Download size={18} /></span><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{getDownloadName(item)}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.details || "Downloaded file"}</p><p className="mt-3 text-xs text-slate-400">{item.date || ""}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => retrieveDownload(item)} className="text-sm font-semibold text-[#B4454A] hover:text-[#8F1424]">Download again</button></div></div></div></article>)}</div> : <EmptyState title={`No ${downloadTab === "tests" ? "tests" : "Tables of Specifications"} yet`} detail="Downloaded files will appear here." />}</div> : <EmptyState title="No downloads yet" detail="Downloaded tests and Tables of Specifications will appear here." action="Open Question Bank" onClick={() => navigate("/question-bank")} />}
          </>
        ) : section === "subjects" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{subjects.filter((subject) => `${subject.name} ${subject.code || ""}`.toLowerCase().includes(query.toLowerCase())).map((subject) => <div key={subject.id} className="bq-panel p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]"><BookOpen size={18} /></div><h2 className="mt-4 font-semibold text-slate-900">{subject.name}</h2><p className="mt-1 text-sm text-slate-500">{subject.code || "No course code"}</p><button type="button" onClick={() => navigate("/question-bank")} className="mt-4 text-sm font-semibold text-[#B4454A]">Open question bank <ArrowRight className="ml-1 inline" size={14} /></button></div>)}</div>
        ) : section === "notifications" ? <NotificationView notifications={notifications} />
          : section === "status" ? <StatusView status={status} />
          : section === "recycle" ? (archivedItems.length ? <div className="space-y-6">{selectedArchivedIds.length > 0 && <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"><span className="text-sm font-semibold text-red-800">{selectedArchivedIds.length} item{selectedArchivedIds.length === 1 ? "" : "s"} selected</span><button type="button" onClick={permanentlyDeleteSelected} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"><Trash2 size={15} /> Delete selected permanently</button></div>}{Object.entries(archivedGroups).map(([subjectName, group]) => <section key={subjectName}><div className="mb-3 flex items-center gap-2"><BookOpen size={17} className="text-[#B4454A]" /><h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">{subjectName}</h2></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{group.subject && <RecycleCard item={group.subject} onRestore={restoreSubject} checked={selectedArchivedIds.includes(archivedKey(group.subject))} onCheckedChange={(checked) => setSelectedArchivedIds((current) => checked ? [...current, archivedKey(group.subject)] : current.filter((id) => id !== archivedKey(group.subject)))} />}{group.questions.map((item) => <RecycleCard key={item.id} item={item} onRestore={restoreQuestion} checked={selectedArchivedIds.includes(archivedKey(item))} onCheckedChange={(checked) => setSelectedArchivedIds((current) => checked ? [...current, archivedKey(item)] : current.filter((id) => id !== archivedKey(item)))} />)}</div></section>)}</div> : <EmptyState title="Recycle Bin is empty" detail="Deleted subjects and questions will appear here for recovery." action="Open Question Bank" onClick={() => navigate("/question-bank")} />)
          : <div className="grid gap-4 md:grid-cols-3">{(cards[section] || cards.assessments).map(([title, detail, path, action]) => <div key={title} className="bq-panel p-5"><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{detail}</p><button type="button" onClick={() => navigate(path)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#B4454A]">{action} <ArrowRight size={14} /></button></div>)}</div>}
      </div>
    </div>
    </>
  );
};

const DownloadsView = ({ downloads, downloadTab, setDownloadTab, groupedDownloads, selectedDownloadIds, setSelectedDownloadIds, deleteSelectedDownloads, retrieveDownload, downloadError, navigate }) => (
  <div className="bq-page">
    <div className="bq-page-inner">
      <div className="mb-6">
        <p className="bq-eyebrow">File library</p>
        <h1 className="bq-page-title">Downloads</h1>
        <p className="bq-page-description">Find every test and Table of Specifications you have downloaded.</p>
      </div>
      {downloads.length > 0 && selectedDownloadIds.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button type="button" onClick={deleteSelectedDownloads} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700">
            <Trash2 size={15} /> Delete selected
          </button>
        </div>
      )}
      {downloads.length ? (
        <div>
          {downloadError && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{downloadError}</div>}
          <div className="mb-5 flex overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Downloaded files">
            <button type="button" role="tab" aria-selected={downloadTab === "tests"} onClick={() => setDownloadTab("tests")} className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${downloadTab === "tests" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}><FileQuestion size={16} />Tests <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{groupedDownloads.tests.length}</span></button>
            <button type="button" role="tab" aria-selected={downloadTab === "tos"} onClick={() => setDownloadTab("tos")} className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${downloadTab === "tos" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}><FileSpreadsheet size={16} />Tables of Specification <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{groupedDownloads.tos.length}</span></button>
          </div>
          {groupedDownloads[downloadTab].length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedDownloads[downloadTab].map((item) => (
                <article key={item.id} className="bq-panel overflow-hidden p-0">
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#FFF7F5] to-white px-5 py-4">
                    <input type="checkbox" checked={selectedDownloadIds.includes(item.id)} onChange={(event) => setSelectedDownloadIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} aria-label={`Select ${getDownloadName(item)}`} className="h-4 w-4 accent-[#B4454A]" />
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]"><Download size={18} /></span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B4454A]">Downloaded file</span>
                  </div>
                  <div className="p-5">
                    <h2 className="line-clamp-3 font-semibold text-slate-900">{getDownloadName(item)}</h2>
                    <p className="mt-2 text-sm text-slate-500">{item.details || "Downloaded file"}</p>
                    <p className="mt-3 text-xs text-slate-400">{item.date || ""}</p>
                    <button type="button" onClick={() => retrieveDownload(item)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#B4454A] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7F1D2D]"><Download size={15} /> Download again</button>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title={downloadTab === "tests" ? "No downloaded tests" : "No downloaded tables"} detail="Generated files will appear here after you export them." />}
        </div>
      ) : <EmptyState title="No downloads yet" detail="Generated tests and Tables of Specifications will appear here." action="Open Question Bank" onClick={() => navigate("/question-bank")} />}
    </div>
  </div>
);

const EmptyState = ({ title, detail, action, onClick }) => <div className="bq-panel flex flex-col items-center justify-center p-12 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">{title}</h2><p className="mt-2 max-w-md text-sm text-slate-500">{detail}</p><button type="button" onClick={onClick} className="bq-primary-button mt-5">{action}</button></div>;
const RecycleCard = ({ item, onRestore, checked, onCheckedChange }) => {
  const isDownload = item.itemType === "download";
  return <article className="bq-panel overflow-hidden p-0"><div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#FFF7F5] to-white px-5 py-4"><input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} aria-label={`Select deleted ${item.itemType}`} className="h-4 w-4 accent-[#B4454A]" /><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4454A]/10 text-[#B4454A]">{item.itemType === "subject" ? <BookOpen size={18} /> : isDownload ? <Download size={18} /> : <FileQuestion size={18} />}</span><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B4454A]">Deleted {item.itemType}</span></div><div className="p-5"><h2 className="line-clamp-3 font-semibold text-slate-900">{item.itemType === "subject" ? item.name : isDownload ? getDownloadName(item) : item.question}</h2><p className="mt-2 text-sm text-slate-500">{item.itemType === "subject" ? (item.code || "No course code") : isDownload ? (item.details || "Downloaded file") : `${item.question_type || "Question"} • ${item.bloom_level || "Unclassified"}`}</p><button type="button" onClick={() => onRestore(item)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#B4454A] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7F1D2D]"><Archive size={15} /> Restore</button></div></article>;
};
const NotificationView = ({ notifications }) => <div className="bq-panel overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#FFF7F5] to-white p-5"><Bell className="text-[#B4454A]" /><div><h2 className="font-semibold text-slate-900">Notification center</h2><p className="text-sm text-slate-500">Your account activity and workspace updates.</p></div></div>{notifications.length ? <div>{notifications.map((item) => <article key={item.id} className="flex gap-3 border-b border-slate-100 p-5 last:border-b-0"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B4454A]/10 text-[#B4454A]"><ShieldCheck size={16} /></span><div><h3 className="text-sm font-semibold text-slate-900">{item.action || "Workspace update"}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{item.details || "An activity was recorded."}</p><p className="mt-2 text-xs text-slate-400">{item.date || ""}</p></div></article>)}</div> : <EmptyState title="No notifications yet" detail="Your analysis, review, and export updates will appear here." />}</div>;
const StatusView = ({ status }) => <div className="grid gap-4 md:grid-cols-3"><div className="bq-panel p-5"><Wifi className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">API service</h2><p className="mt-1 text-sm text-slate-500">{status}</p></div><div className="bq-panel p-5"><Server className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">Question processing</h2><p className="mt-1 text-sm text-slate-500">Available through New Analysis.</p></div><div className="bq-panel p-5"><Download className="text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">Export service</h2><p className="mt-1 text-sm text-slate-500">PDF and DOCX export available.</p></div></div>;

export default UserToolsPage;
