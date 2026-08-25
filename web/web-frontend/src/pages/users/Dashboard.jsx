import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, Download, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const API_URL = "http://localhost:8000";

// ─── Design tokens ───
const surface = "#FFFFFF";
const border = "rgba(15, 23, 42, 0.08)";
const textPrimary = "#0F172A";
const textMuted = "#64748B";
const accent = "#B4454A";
const accentSoft = "rgba(180, 69, 74, 0.12)";

const Dashboard = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalQuestions: 0,
    assessmentsGenerated: 12,
  });
  const [loading, setLoading] = useState(true);

  const bloomsData = {
    Remember: 45,
    Understand: 30,
    Apply: 22,
    Analyze: 28,
    Evaluate: 15,
    Create: 10
  };

  const typeData = {
    MCQ: 65,
    "True/False": 28,
    Identification: 32,
    Essay: 15,
    Situational: 10
  };

  useEffect(() => {
    const fetchDashboardAnalytics = async () => {
      try {
        const subjectsRes = await fetch(`${API_URL}/api/subjects`);
        const questionsRes = await fetch(`${API_URL}/api/questions`);

        if (subjectsRes.ok && questionsRes.ok) {
          const subjectsData = await subjectsRes.json();
          const questionsData = await questionsRes.json();

          setStats(prev => ({
            ...prev,
            totalSubjects: subjectsData.length,
            totalQuestions: questionsData.length
          }));
        }
      } catch (err) {
        console.error("Dashboard analytics fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardAnalytics();
  }, []);

  const barPalette = ["#FDE2E2", "#FCA5A5", "#F87171", "#EF4444", "#DC2626", "#B91C1C"];
  const donutPalette = ["#F87171", "#EF4444", "#DC2626", "#B91C1C", "#7F1D1D"];

  const barChartData = {
    labels: Object.keys(bloomsData),
    datasets: [
      {
        label: "Number of Questions",
        data: Object.values(bloomsData),
        backgroundColor: barPalette.map(c => c + "CC"),
        borderColor: barPalette,
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textMuted, font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: textMuted, font: { size: 11 } },
        grid: { color: "rgba(255,255,255,0.05)" }
      }
    }
  };

  const doughnutChartData = {
    labels: Object.keys(typeData),
    datasets: [
      {
        data: Object.values(typeData),
        backgroundColor: donutPalette,
        borderColor: surface,
        borderWidth: 2,
        hoverOffset: 4,
      }
    ]
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, color: textMuted, font: { size: 11 } }
      }
    }
  };

  return (
    <div className="bq-page" style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <div className="bq-page-inner">
        <div className="bq-page-header">
          <div>
          <p className="bq-eyebrow">Assessment workspace</p>
          <h1 className="bq-page-title">
            Welcome back
          </h1>
          <p className="bq-page-description">
            Visualizing structural breakdown metrics of your active assessment items.
          </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-12" style={{ color: textMuted }}>
            <svg className="animate-spin h-5 w-5" style={{ color: accent }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Syncing chart data engines...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-2xl border p-5" style={{ background: "linear-gradient(120deg, #fff7f5, #ffffff)", borderColor: "rgba(180,69,74,0.18)" }}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>Keep the work moving</p>
                    <h2 className="mt-2 text-lg font-bold" style={{ color: textPrimary }}>Start a new assessment analysis</h2>
                    <p className="mt-1 max-w-xl text-sm" style={{ color: textMuted }}>Upload course materials, set your blueprint, and review generated questions before exporting.</p>
                  </div>
                  <button type="button" onClick={() => navigate("/input")} className="bq-primary-button shrink-0"><Plus size={16} /> New analysis</button>
                </div>
              </div>
              <button type="button" onClick={() => navigate("/history")} className="bq-panel flex min-w-44 items-center justify-between gap-4 p-5 text-left hover:border-red-200">
                <span><span className="block text-xs font-bold uppercase tracking-wider" style={{ color: textMuted }}>Recent work</span><span className="mt-2 block text-sm font-semibold" style={{ color: textPrimary }}>Review your history</span></span>
                <ArrowRight size={17} style={{ color: accent }} />
              </button>
            </div>

            <div className="bq-panel p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>Getting started</p><h2 className="mt-1 text-lg font-bold" style={{ color: textPrimary }}>Your assessment workflow</h2></div>
                <span className="text-xs font-semibold" style={{ color: textMuted }}>3 simple steps</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  ["1", "Add course material", "Upload your module and syllabus.", "/input"],
                  ["2", "Review questions", "Approve generated items inside Question Bank.", "/question-bank"],
                  ["3", "Build assessment", "Select questions and preview the export.", "/question-bank"],
                ].map(([number, title, detail, path]) => <button key={number} type="button" onClick={() => navigate(path)} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-red-200 hover:bg-red-50/40"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-[#B4454A]">{number}</span><span><span className="block text-sm font-semibold" style={{ color: textPrimary }}>{title}</span><span className="mt-1 block text-xs leading-5" style={{ color: textMuted }}>{detail}</span></span><CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-slate-300" /></button>)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Managed Subjects", value: stats.totalSubjects, icon: BookOpen },
                { label: "Total Question Pool", value: stats.totalQuestions, icon: ClipboardList },
                { label: "Assessments Exported", value: stats.assessmentsGenerated, icon: Download },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="p-4 rounded-2xl flex items-center justify-between"
                  style={{ backgroundColor: surface, border: `1px solid ${border}` }}
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: textMuted }}>
                      {label}
                    </p>
                    <h3 className="text-[2rem] font-semibold tracking-tight leading-none" style={{ color: textPrimary }}>
                      {value}
                    </h3>
                  </div>
                  <div className="p-2.5 rounded-xl" style={{ backgroundColor: accentSoft, color: accent }}>
                    <Icon size={20} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div
                className="p-5 rounded-2xl lg:col-span-2"
                style={{ backgroundColor: surface, border: `1px solid ${border}` }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: textMuted }}>
                  Cognitive Domain Spread (Bloom's Levels)
                </h3>
                <div className="h-64 w-full relative">
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
              </div>

              <div
                className="p-5 rounded-2xl flex flex-col justify-between"
                style={{ backgroundColor: surface, border: `1px solid ${border}` }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
                  Question Forms Spread
                </h3>
                <div className="h-56 w-full relative">
                  <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
                </div>
              </div>
            </div>

            <div
              className="p-5 rounded-2xl"
              style={{ backgroundColor: surface, border: `1px solid ${border}` }}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: textMuted }}>
                Recent Account Activity
              </h3>
              <div className="space-y-2">
                {[
                  {
                    tag: "TOS",
                    tagColor: "#22C55E",
                    text: "Generated an automated exam matrix via Module PDF analysis",
                    meta: "Subject Framework: System Administration • 45 minutes ago",
                  },
                  {
                    tag: "MAN",
                    tagColor: "#3B82F6",
                    text: 'Manually classified single query and appended to cloud storage',
                    meta: 'Assigned Taxonomy Level: "Evaluate" • 3 hours ago',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl text-xs"
                    style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                  >
                    <span
                      className="px-2 py-1 rounded-md font-bold"
                      style={{ backgroundColor: item.tagColor + "22", color: item.tagColor }}
                    >
                      {item.tag}
                    </span>
                    <div>
                      <p className="font-medium" style={{ color: textPrimary }}>{item.text}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>{item.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;