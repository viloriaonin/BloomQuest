import React, { useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Activity, BookOpen, GraduationCap, Users } from "lucide-react";
import { API_URL } from "../../config/api";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const COLORS = ["#C4485A", "#E0A458", "#378A87", "#5587B8", "#758B54", "#8C6AA8", "#9B7465"];
const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0);

const CampusAdminOverview = ({ departmentId, selectedDepartment }) => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const loadOverview = async () => {
      try {
        const params = new URLSearchParams();
        if (departmentId) params.set("department_id", departmentId);
        const query = params.toString();
        const response = await fetch(`${API_URL}/admin/campus-overview${query ? `?${query}` : ""}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || "Could not load campus overview.");
        }
        setOverview(await response.json());
      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message || "Could not load campus overview.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadOverview();
    return () => controller.abort();
  }, [departmentId]);

  const totals = overview?.totals || {};
  const campus = overview?.campuses?.[0];
  const bloomEntries = Object.entries(overview?.bloom_distribution || {});
  const questionTypeEntries = Object.entries(overview?.question_type_distribution || {});
  const statCards = [
    { label: "Departments", value: totals.departments, detail: selectedDepartment === "All Departments" ? "Academic departments" : "Selected department", icon: GraduationCap, color: COLORS[1] },
    { label: "Programs", value: totals.programs, detail: "Registered programs", icon: BookOpen, color: COLORS[2] },
    { label: "Subjects", value: totals.subjects, detail: "Active subjects", icon: BookOpen, color: COLORS[3] },
    { label: "Faculty", value: totals.faculty, detail: "Active faculty accounts", icon: Users, color: COLORS[4] },
    { label: "Users", value: totals.users, detail: "Active accounts", icon: Users, color: COLORS[5] },
    { label: "Questions", value: totals.questions, detail: "Campus-attributed questions", icon: Activity, color: COLORS[6] },
  ];

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="bq-admin-panel border border-red-500/40 text-sm text-red-300">{error}</div>}
      <div className="bq-admin-panel flex flex-wrap items-center justify-between gap-3">
        <div><h2>Campus Overview</h2><p className="bq-admin-muted mt-1">Campus-scoped totals and analytics{selectedDepartment !== "All Departments" ? ` for ${selectedDepartment}` : ""}.</p></div>
        <span className="bq-admin-mono">{selectedDepartment}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, detail, icon: Icon, color }) => (
          <section key={label} className="bq-admin-stat flex min-h-32 flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="bq-admin-stat-label">{label}</div>
                <div className="mt-2 text-3xl font-semibold leading-none" style={{ color: "var(--admin-text, #ecedef)" }}>
                  {loading ? "..." : formatNumber(value)}
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
                <Icon size={19} />
              </span>
            </div>
            <p className="bq-admin-muted mt-4 text-xs">{detail}</p>
          </section>
        ))}
      </div>

      <section className="bq-admin-panel">
        <div className="flex items-center justify-between gap-3">
          <div><h2>{selectedDepartment === "All Departments" ? "Campus Summary" : `${selectedDepartment} Summary`}</h2><p className="bq-admin-muted mt-1">Counts reflect records attributed to your assigned campus and selected department.</p></div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Campus</th><th className="py-2 pr-3">Departments</th><th className="py-2 pr-3">Programs</th><th className="py-2 pr-3">Faculty</th><th className="py-2">Questions</th></tr></thead>
            <tbody>{campus && <tr className="border-b border-slate-800"><td className="py-2 pr-3">{campus.name}</td><td className="py-2 pr-3">{formatNumber(campus.departments)}</td><td className="py-2 pr-3">{formatNumber(campus.programs)}</td><td className="py-2 pr-3">{formatNumber(campus.faculty)}</td><td className="py-2">{formatNumber(campus.questions)}</td></tr>}</tbody>
          </table>
          {!loading && !campus && <p className="bq-admin-muted py-4">No campus data is available.</p>}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="bq-admin-panel">
          <h2>Questions by {selectedDepartment === "All Departments" ? "Campus" : "Department"}</h2>
          <div className="mt-4 h-72">
            {campus ? <Bar data={{ labels: [selectedDepartment === "All Departments" ? campus.name : selectedDepartment], datasets: [{ label: "Questions", data: [campus.questions], backgroundColor: COLORS[0], borderRadius: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /> : <p className="bq-admin-muted pt-8">{loading ? "Loading campus analytics..." : "No campus question data yet."}</p>}
          </div>
        </section>
        <section className="bq-admin-panel">
          <h2>Bloom Level Distribution</h2>
          <div className="mt-4 h-72">
            {bloomEntries.length ? <Doughnut data={{ labels: bloomEntries.map(([label]) => label), datasets: [{ data: bloomEntries.map(([, count]) => count), backgroundColor: COLORS, borderWidth: 1 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} /> : <p className="bq-admin-muted pt-8">{loading ? "Loading classification analytics..." : "No question classification data yet."}</p>}
          </div>
        </section>
        <section className="bq-admin-panel xl:col-span-2">
          <h2>Question Type Distribution</h2>
          <div className="mt-4 h-72">
            {questionTypeEntries.length ? <Bar data={{ labels: questionTypeEntries.map(([label]) => label), datasets: [{ label: "Questions", data: questionTypeEntries.map(([, count]) => count), backgroundColor: COLORS[2], borderRadius: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /> : <p className="bq-admin-muted pt-8">{loading ? "Loading question analytics..." : "No question type data yet."}</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CampusAdminOverview;
