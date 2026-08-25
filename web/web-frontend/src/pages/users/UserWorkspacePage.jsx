import React, { useState } from "react";
import { ArrowRight, Download, FileText, LockKeyhole, Play, Save, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

const WORKSPACES = {
  reports: {
    eyebrow: "Quality intelligence",
    title: "Reports",
    description: "Turn completed analyses into review-ready quality summaries.",
  },
  templates: {
    eyebrow: "Reusable assessment design",
    title: "Templates & TOS",
    description: "Keep institutional TOS layouts ready for the next analysis.",
  },
  settings: {
    eyebrow: "Workspace preferences",
    title: "Settings",
    description: "Control the defaults that shape your assessment workflow.",
  },
};

const templates = [
  { name: "Standard Course Assessment", detail: "Balanced Bloom levels for a regular examination.", meta: "6 topics · 50 items" },
  { name: "Midterm Examination", detail: "A compact blueprint with stronger application coverage.", meta: "4 topics · 40 items" },
  { name: "Department Master TOS", detail: "Your institution-wide starting point for new courses.", meta: "8 topics · 60 items" },
];

const UserWorkspacePage = ({ section }) => {
  const navigate = useNavigate();
  const workspace = WORKSPACES[section] || WORKSPACES.reports;
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      return {
        fullName: localStorage.getItem("name") || "Dr. Reyes",
        department: localStorage.getItem("department") || "Faculty",
        defaultSubject: "",
        defaultQuestionCount: "50",
        defaultPoints: "100",
        exportFormat: "PDF",
        emailUpdates: true,
        analysisAlerts: true,
        reviewReminders: false,
        rememberLastSubject: true,
        autoSaveDrafts: false,
        reducedMotion: false,
        highContrast: false,
      };
    } catch {
      return { fullName: "Dr. Reyes", department: "Faculty", defaultSubject: "", defaultQuestionCount: "50", defaultPoints: "100", exportFormat: "PDF", emailUpdates: true, analysisAlerts: true, reviewReminders: false, rememberLastSubject: true, autoSaveDrafts: false, reducedMotion: false, highContrast: false };
    }
  });

  const updateSetting = (key) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
  };

  const updateField = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const saveSettings = () => {
    localStorage.setItem("bloomquest-settings", JSON.stringify(settings));
    localStorage.setItem("name", settings.fullName);
    localStorage.setItem("department", settings.department);
    setSaved(true);
  };

  const settingRows = [
    ["emailUpdates", "Email updates", "Receive notices when an analysis is ready."],
    ["analysisAlerts", "Analysis alerts", "Show upload, generation, and export status alerts."],
    ["reviewReminders", "Review reminders", "Remind you to check questions before exporting."],
    ["rememberLastSubject", "Remember last subject", "Reopen analysis with your previous subject selected."],
    ["autoSaveDrafts", "Auto-save drafts", "Keep unfinished TOS settings available for later."],
    ["reducedMotion", "Reduce motion", "Limit animated transitions across the workspace."],
    ["highContrast", "High contrast", "Increase contrast for text and controls."],
  ];

  return (
    <div className="min-h-full p-6" style={{ backgroundColor: "#F5F7FB" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#B4454A" }}>{workspace.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold" style={{ color: "#0F172A" }}>{workspace.title}</h1>
          <p className="mt-2 text-sm" style={{ color: "#64748B" }}>{workspace.description}</p>
        </div>

        {section === "reports" && (
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Quality overview", "Compare Bloom alignment, coverage gaps, and issue counts.", "Open overview"],
              ["Analysis history", "Review completed assessments and reopen their source files.", "View history"],
              ["Export center", "Prepare a PDF or DOCX report for faculty review.", "Export report"],
            ].map(([title, detail, action]) => (
              <div key={title} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(180,69,74,0.1)", color: "#B4454A" }}>
                  <Download size={18} />
                </div>
                <h2 className="mt-5 font-semibold" style={{ color: "#0F172A" }}>{title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6" style={{ color: "#64748B" }}>{detail}</p>
                <button
                  type="button"
                  onClick={() => navigate(title === "Quality overview" ? "/dashboard" : "/history")}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: "#B4454A" }}
                >
                  {action} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {section === "templates" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {templates.map((template) => (
              <div key={template.name} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF2D9", color: "#D97706" }}>
                    <FileText size={18} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: "#64748B" }}>{template.meta}</span>
                </div>
                <h2 className="mt-5 font-semibold" style={{ color: "#0F172A" }}>{template.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6" style={{ color: "#64748B" }}>{template.detail}</p>
                <button
                  type="button"
                  onClick={() => navigate("/input")}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: "#B4454A" }}
                >
                  <Play size={14} /> Use template
                </button>
              </div>
            ))}
          </div>
        )}

        {section === "settings" && (
          <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex items-center gap-3 border-b pb-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <UserRound size={20} style={{ color: "#B4454A" }} />
                <div><h2 className="font-semibold" style={{ color: "#0F172A" }}>Profile</h2><p className="text-sm" style={{ color: "#64748B" }}>Personal details used across your workspace.</p></div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Full name<input value={settings.fullName} onChange={(event) => updateField("fullName", event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 font-normal outline-none focus:border-purple-500" /></label>
                <label className="text-sm font-semibold text-slate-700">Department or role<input value={settings.department} onChange={(event) => updateField("department", event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 font-normal outline-none focus:border-purple-500" /></label>
              </div>
              <div className="mt-7 flex items-center gap-3 border-b pb-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}><Settings2 size={20} style={{ color: "#B4454A" }} /><div><h2 className="font-semibold" style={{ color: "#0F172A" }}>Assessment defaults</h2><p className="text-sm" style={{ color: "#64748B" }}>Starting values for New Analysis.</p></div></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Default subject<input value={settings.defaultSubject} onChange={(event) => updateField("defaultSubject", event.target.value)} placeholder="e.g. CC103" className="mt-2 w-full rounded-lg border px-3 py-2 font-normal outline-none focus:border-purple-500" /></label>
                <label className="text-sm font-semibold text-slate-700">Question count<input type="number" min="1" value={settings.defaultQuestionCount} onChange={(event) => updateField("defaultQuestionCount", event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 font-normal outline-none focus:border-purple-500" /></label>
                <label className="text-sm font-semibold text-slate-700">Total points<input type="number" min="1" value={settings.defaultPoints} onChange={(event) => updateField("defaultPoints", event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 font-normal outline-none focus:border-purple-500" /></label>
                <label className="text-sm font-semibold text-slate-700">Export format<select value={settings.exportFormat} onChange={(event) => updateField("exportFormat", event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 font-normal outline-none focus:border-purple-500"><option>PDF</option><option>DOCX</option><option>XLSX</option></select></label>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex items-center gap-3 border-b pb-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}><ShieldCheck size={20} style={{ color: "#B4454A" }} /><div><h2 className="font-semibold" style={{ color: "#0F172A" }}>Notifications and accessibility</h2><p className="text-sm" style={{ color: "#64748B" }}>Choose what deserves your attention.</p></div></div>
              <div className="divide-y" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                {settingRows.map(([key, title, detail]) => (
                  <label key={key} className="flex cursor-pointer items-center justify-between gap-4 py-4"><span><span className="block text-sm font-semibold" style={{ color: "#0F172A" }}>{title}</span><span className="mt-1 block text-sm" style={{ color: "#64748B" }}>{detail}</span></span><input type="checkbox" checked={settings[key]} onChange={() => updateSetting(key)} className="h-5 w-5 accent-red-700" /></label>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3 border-t pt-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}><LockKeyhole size={18} style={{ color: "#B4454A" }} /><div><h2 className="font-semibold" style={{ color: "#0F172A" }}>Security</h2><p className="text-sm" style={{ color: "#64748B" }}>Password and active-session controls will connect to your account service.</p></div></div>
              <button type="button" onClick={() => navigate("/forgot-password")} className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Change password</button>
              <button type="button" onClick={() => { localStorage.removeItem("token"); navigate("/"); }} className="ml-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Sign out</button>
            </div>

            <div className="lg:col-span-2 flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <p className="text-sm" style={{ color: "#64748B" }}>Preferences are stored on this device until account sync is connected.</p>
              <button type="button" onClick={saveSettings} className="bq-primary-button"><Save size={15} /> {saved ? "Saved" : "Save settings"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserWorkspacePage;
