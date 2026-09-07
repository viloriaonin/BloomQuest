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
import { ArrowRight, BookOpen, ClipboardList, Download, Lightbulb, Plus } from "lucide-react";
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

const asList = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const Dashboard = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalQuestions: 0,
    assessmentsGenerated: 0,
  });
  const [loading, setLoading] = useState(true);

  const [bloomsData, setBloomsData] = useState({
    Remember: 0,
    Understand: 0,
    Apply: 0,
    Analyze: 0,
    Evaluate: 0,
    Create: 0
  });

  const [typeData, setTypeData] = useState({
    MCQ: 0,
    "True/False": 0,
    Identification: 0,
    Essay: 0,
    Situational: 0,
    "Matching Type": 0
  });

  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchDashboardAnalytics = async () => {
      try {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
          console.error('User ID not found in localStorage');
          setLoading(false);
          return;
        }

        const responses = await Promise.all([
          fetch(`${API_URL}/api/subjects?user_id=${encodeURIComponent(userId)}`),
          fetch(`${API_URL}/api/questions?user_id=${encodeURIComponent(userId)}`),
          fetch(`${API_URL}/api/history?user_id=${encodeURIComponent(userId)}`),
        ]);
        const [subjectsRes, questionsRes, historyRes] = responses;
        const subjectsData = subjectsRes.ok ? asList(await subjectsRes.json(), ['subjects', 'items']) : [];
        let questionsData = questionsRes.ok ? asList(await questionsRes.json(), ['questions', 'items']) : [];
        const historyData = historyRes.ok ? asList(await historyRes.json(), ['history', 'items']) : [];

        // Older generated records were saved before ownership was persisted.
        // Use the same visible bank for those records until they are migrated.
        if (questionsData.length === 0) {
          const legacyQuestionsRes = await fetch(`${API_URL}/api/questions`);
          if (legacyQuestionsRes.ok) questionsData = asList(await legacyQuestionsRes.json(), ['questions', 'items']);
        }

        if (subjectsRes.ok || questionsRes.ok || historyRes.ok) {

          // Calculate Bloom's taxonomy distribution
          const bloomsDistribution = {
            Remember: 0,
            Understand: 0,
            Apply: 0,
            Analyze: 0,
            Evaluate: 0,
            Create: 0
          };

          // Calculate question type distribution
          const typeDistribution = {
            MCQ: 0,
            "True/False": 0,
            Identification: 0,
            Essay: 0,
            Situational: 0,
            "Matching Type": 0
          };

          questionsData.forEach(q => {
            // Count Bloom's level
            const bloomLevel = q.bloom_level || 'Remember';
            if (bloomsDistribution.hasOwnProperty(bloomLevel)) {
              bloomsDistribution[bloomLevel]++;
            }

            // Count question type
            const qType = q.question_type === 'Multiple Choice'
              ? 'MCQ'
              : q.question_type === 'True or False'
                ? 'True/False'
                : q.question_type || 'MCQ';
            if (typeDistribution.hasOwnProperty(qType)) {
              typeDistribution[qType]++;
            }

          });

          setBloomsData(bloomsDistribution);
          setTypeData(typeDistribution);
          setStats(prev => ({
            ...prev,
            totalSubjects: subjectsData.length,
            totalQuestions: questionsData.length,
            assessmentsGenerated: historyData.filter(item => /export|assessment/i.test(item.action || '')).length
          }));

          // Build recent activity from the current user's activity log.
          const activity = historyData
            .slice(0, 5)
            .map((item) => {
              const tagColor = item.type === 'generate' ? '#22C55E' : item.type === 'classify' ? '#3B82F6' : '#F59E0B';
              return {
                id: item.id,
                tag: (item.type || 'INFO').toUpperCase(),
                tagColor,
                text: item.action || 'Account activity',
                meta: `${item.details || ''} • ${getTimeAgo(new Date(item.date))}`
              };
            });
          setRecentActivity(activity.length > 0 ? activity : getDefaultActivity());
        }
      } catch (err) {
        console.error("Dashboard analytics fetch failed:", err);
        setRecentActivity(getDefaultActivity());
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardAnalytics();
  }, []);

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
  };

  const getDefaultActivity = () => [
    {
      tag: "INFO",
      tagColor: "#64748B",
      text: "No recent activity",
      meta: "Start by creating or uploading questions",
    },
  ];

  const barPalette = ["#FDE2E2", "#FCA5A5", "#F87171", "#EF4444", "#DC2626", "#B91C1C"];
  const donutPalette = ["#F87171", "#EF4444", "#DC2626", "#B91C1C", "#7F1D1D", "#991B1B"];

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

  const hasQuestions = Object.values(typeData).some((value) => value > 0);
  const visibleDoughnutData = hasQuestions
    ? doughnutChartData
    : { ...doughnutChartData, datasets: [{ ...doughnutChartData.datasets[0], data: [1], backgroundColor: ['#E2E8F0'] }] };

  const leastRepresentedBloom = Object.entries(bloomsData)
    .sort(([, firstCount], [, secondCount]) => firstCount - secondCount)[0]?.[0] || "Create";

  const recommendation = stats.totalSubjects === 0
    ? {
        title: "Upload your course materials first",
        detail: "Add a module and syllabus so BloomQuest can create a focused question pool for your course.",
      }
    : stats.totalQuestions === 0
      ? {
          title: "Generate your first question set",
          detail: "Your course is ready. Run an analysis to build questions that you can review and refine.",
        }
      : {
          title: `Strengthen your ${leastRepresentedBloom} questions`,
          detail: `${leastRepresentedBloom} is currently the least represented Bloom level in your ${stats.totalQuestions}-question pool. Add or review items at this level to create a more balanced assessment.`,
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
            <div>
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
            </div>

            <div className="bq-panel overflow-hidden p-0">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: accentSoft, color: accent }}><Lightbulb size={19} /></span>
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>Prescriptive recommendation</p><h2 className="mt-1 text-lg font-bold" style={{ color: textPrimary }}>{recommendation.title}</h2><p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: textMuted }}>{recommendation.detail}</p></div>
                </div>
              </div>
              <div className="border-t px-5 py-3 text-xs" style={{ borderColor: border, color: textMuted }}>Based on your current workspace activity. Recommendations are currently rule-based.</div>
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div
                className="p-5 rounded-2xl lg:col-span-2"
                style={{ backgroundColor: surface, border: `1px solid ${border}` }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: textMuted }}>
                  Cognitive Domain Spread (Bloom's Levels)
                </h3>
                <div className="h-64 w-full relative">
                  <Bar data={barChartData} options={barChartOptions} />
                  {!stats.totalQuestions && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400">No question data yet</span>}
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
                  <Doughnut data={visibleDoughnutData} options={doughnutChartOptions} />
                  {!hasQuestions && <span className="pointer-events-none absolute inset-x-0 bottom-20 text-center text-xs font-semibold text-slate-400">No question data yet</span>}

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
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
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