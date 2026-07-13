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

// Register Chart.js modules cleanly to support Canvas rendering pipelines
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend
);

const API_URL = "http://localhost:8000";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalQuestions: 0,
    assessmentsGenerated: 12,
  });
  const [loading, setLoading] = useState(true);

  // Mock array data to track active distribution volumes (will map to actual question lists later)
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

  // 📊 Configuration 1: Bloom's Taxonomy Bar Chart
  const barChartData = {
    labels: Object.keys(bloomsData),
    datasets: [
      {
        label: "Number of Questions",
        data: Object.values(bloomsData),
        backgroundColor: [
          "rgba(239, 68, 68, 0.7)",   // Remember - Red
          "rgba(244, 63, 94, 0.7)",   // Understand - Rose
          "rgba(251, 146, 60, 0.7)",  // Apply - Orange
          "rgba(20, 184, 166, 0.7)",  // Analyze - Teal
          "rgba(59, 130, 246, 0.7)",  // Evaluate - Blue
          "rgba(168, 85, 247, 0.7)"   // Create - Purple
        ],
        borderColor: [
          "#EF4444", "#F43F5E", "#FB923C", "#14B8A6", "#3B82F6", "#A855F7"
        ],
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }, // Hiding since each bar has separate labeling context
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } }
    }
  };

  // 🍩 Configuration 2: Question Type Doughnut Chart
  const doughnutChartData = {
    labels: Object.keys(typeData),
    datasets: [
      {
        data: Object.values(typeData),
        backgroundColor: [
          "#3B82F6", // Blue
          "#10B981", // Green
          "#F59E0B", // Amber
          "#EC4899", // Pink
          "#6B7280"  // Grey
        ],
        hoverOffset: 4,
      }
    ]
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }
    }
  };

  return (
    <div className="w-full min-h-full p-8" style={{ backgroundColor: "#f3f4f6" }}>
      {/* Header Banner */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#7B1113" }}>
          Welcome to BloomQuest
        </h1>
        <p className="text-sm text-gray-500">Visualizing structural breakdown metrics of your active assessment items.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12">
          <svg className="animate-spin h-5 w-5 text-red-700" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Syncing chart data engines...
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* ─── KPI COUNTER ROW ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Managed Subjects</p>
                {/* Updated font stack to standard system clean typography */}
                <h3 className="text-3xl font-semibold tracking-tight text-gray-800" style={{ fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  {stats.totalSubjects}
                </h3>
              </div>
              <div className="p-2.5 bg-red-50 rounded-lg text-[#7B1113]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Question Pool</p>
                {/* Updated font stack to standard system clean typography */}
                <h3 className="text-3xl font-semibold tracking-tight text-gray-800" style={{ fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  {stats.totalQuestions}
                </h3>
              </div>
              <div className="p-2.5 bg-red-50 rounded-lg text-[#7B1113]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" /></svg>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Assessments Exported</p>
                {/* Updated font stack to standard system clean typography */}
                <h3 className="text-3xl font-semibold tracking-tight text-gray-800" style={{ fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  {stats.assessmentsGenerated}
                </h3>
              </div>
              <div className="p-2.5 bg-red-50 rounded-lg text-[#7B1113]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </div>
            </div>
          </div>
          {/* ─── GRAPHICAL CHART DECK PANEL ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* ChartJS Bar Graph Widget (Span 2 Columns) */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Cognitive Domain Spread (Bloom's Levels)</h3>
              <div className="h-72 w-full relative">
                <Bar data={barChartData} options={barChartOptions} />
              </div>
            </div>

            {/* ChartJS Doughnut Widget (Span 1 Column) */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Question Forms Spread</h3>
                <div className="h-64 w-full relative">
                  <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
                </div>
              </div>
            </div>

          </div>

          {/* ─── SYSTEM EVENT AUDIT LOG ─── */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Recent Account Activity</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-xs">
                <span className="p-1.5 bg-green-100 text-green-700 rounded-md font-bold">TOS</span>
                <div>
                  <p className="font-semibold text-gray-800">Generated an automated exam matrix via Module PDF analysis</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Subject Framework: System Administration • 45 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-xs">
                <span className="p-1.5 bg-blue-100 text-blue-700 rounded-md font-bold">MAN</span>
                <div>
                  <p className="font-semibold text-gray-800">Manually classified single query and appended to cloud storage</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Assigned Taxonomy Level: "Evaluate" • 3 hours ago</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Dashboard;