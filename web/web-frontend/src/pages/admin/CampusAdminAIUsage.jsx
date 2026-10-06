import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { API_URL } from "../../config/api";

ChartJS.register(BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const EMPTY_FILTERS = { date_from: "", date_to: "", model_name: "", request_status: "" };
const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

const CampusAdminAIUsage = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadUsage = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        const response = await fetch(`${API_URL}/admin/ai-usage?${params.toString()}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || "Could not load campus AI usage.");
        }
        setUsage(await response.json());
      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message || "Could not load campus AI usage.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadUsage();
    return () => controller.abort();
  }, [filters]);

  const totals = usage?.totals || {};
  const monthRows = usage?.requests_by_month || [];
  const modelRows = usage?.model_usage || [];
  const userRows = usage?.requests_by_user || [];
  const errorRows = usage?.error_types || [];
  const tokenUsage = usage?.token_usage;
  const modelOptions = [...new Set([...(usage?.available_models || []), ...(filters.model_name ? [filters.model_name] : [])])];
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const stats = [
    ["AI Requests", totals.total_ai_requests, "#C4485A"],
    ["Generation Requests", totals.generation_requests, "#5587B8"],
    ["Questions Generated", totals.total_questions_generated, "#378A87"],
    ["Successful", totals.successful_requests, "#758B54"],
    ["Failed", totals.failed_requests, "#E0A458"],
    ["Rate-Limit Events", totals.rate_limit_events, "#9B7465"],
    ["Gemini API Calls", totals.gemini_api_calls, "#8C6AA8"],
  ];

  return (
    <div className="space-y-4">
      <section className="bq-admin-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2>AI usage filters</h2><p className="bq-admin-muted mt-1 text-sm">View Gemini activity for your assigned campus.</p></div>
          <button type="button" className="bq-admin-action" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">From<input aria-label="AI usage start date" type="date" value={filters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} className="bq-field mt-1 w-full" /></label>
          <label className="text-sm">To<input aria-label="AI usage end date" type="date" value={filters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} className="bq-field mt-1 w-full" /></label>
          <label className="text-sm">Gemini model<select aria-label="Filter AI usage by Gemini model" value={filters.model_name} onChange={(event) => updateFilter("model_name", event.target.value)} className="bq-field mt-1 w-full"><option value="">All models</option>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <label className="text-sm">Status<select aria-label="Filter AI usage by status" value={filters.request_status} onChange={(event) => updateFilter("request_status", event.target.value)} className="bq-field mt-1 w-full"><option value="">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option><option value="rate_limited">Rate limited</option><option value="in_progress">In progress</option></select></label>
        </div>
      </section>

      {error && <div role="alert" className="bq-admin-panel border border-red-500/40 text-sm text-red-300">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, color]) => (
          <section key={label} className="bq-admin-stat flex min-h-28 flex-col justify-between">
            <div className="bq-admin-stat-label">{label}</div>
            <div className="mt-3 text-3xl font-semibold leading-none" style={{ color: "var(--admin-text, #ecedef)" }}>{loading ? "..." : formatNumber(value)}</div>
            <span className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: color }} />
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="bq-admin-panel"><h2>Requests and questions by month</h2><div className="mt-4 h-72">{monthRows.length ? <Bar data={{ labels: monthRows.map((row) => row.month), datasets: [{ label: "Requests", data: monthRows.map((row) => row.requests), backgroundColor: "#5587B8", borderRadius: 3 }, { label: "Questions", data: monthRows.map((row) => row.questions), backgroundColor: "#E0A458", borderRadius: 3 }] }} options={CHART_OPTIONS} /> : <p className="bq-admin-muted pt-8">{loading ? "Loading monthly activity..." : "No monthly activity in this range."}</p>}</div></section>
        <section className="bq-admin-panel"><h2>Gemini model usage</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Model</th><th className="py-2 pr-3">Requests</th><th className="py-2 pr-3">API calls</th><th className="py-2">Questions</th></tr></thead><tbody>{modelRows.map((row) => <tr key={row.model} className="border-b border-slate-800"><td className="py-3 pr-3">{row.model}</td><td className="py-3 pr-3">{formatNumber(row.requests)}</td><td className="py-3 pr-3">{formatNumber(row.api_calls)}</td><td className="py-3">{formatNumber(row.questions)}</td></tr>)}</tbody></table>{!loading && !modelRows.length && <p className="bq-admin-muted py-5">No model activity recorded.</p>}</div></section>
      </div>

      <section className="bq-admin-panel">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2>Requests by user</h2><p className="bq-admin-muted mt-1 text-sm">AI requests recorded for accounts at your campus.</p></div><span className="bq-admin-mono">{formatNumber(userRows.length)} USERS</span></div>
        <div className="mt-4 max-h-[32rem] overflow-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="sticky top-0 bq-admin-panel"><tr className="border-b border-slate-700"><th className="py-2 pr-3">User</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Requests</th><th className="py-2">Questions</th></tr></thead><tbody>{userRows.map((row) => <tr key={row.user_id} className="border-b border-slate-800"><td className="py-3 pr-3">{row.name}<span className="bq-admin-muted block text-xs">{row.email}</span></td><td className="py-3 pr-3">{row.role || "-"}</td><td className="py-3 pr-3">{formatNumber(row.requests)}</td><td className="py-3">{formatNumber(row.questions)}</td></tr>)}</tbody></table>{!loading && !userRows.length && <p className="bq-admin-muted py-5">No requesters match these filters.</p>}</div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="bq-admin-panel"><h2>Token usage</h2>{tokenUsage?.available ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Input", tokenUsage.input_tokens], ["Output", tokenUsage.output_tokens], ["Total", tokenUsage.total_tokens]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-700 p-4"><p className="bq-admin-stat-label">{label} tokens</p><p className="mt-2 text-2xl font-semibold">{formatNumber(value)}</p></div>)}</div> : <p className="bq-admin-muted mt-4 text-sm">Token totals are hidden when complete Gemini usage metadata is not available for every request in this selection.</p>}</section>
        <section className="bq-admin-panel"><h2>Failure and rate-limit types</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[360px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Type</th><th className="py-2">Requests</th></tr></thead><tbody>{errorRows.map((row) => <tr key={row.error_type} className="border-b border-slate-800"><td className="py-3 pr-3">{row.error_type}</td><td className="py-3">{formatNumber(row.requests)}</td></tr>)}</tbody></table>{!loading && !errorRows.length && <p className="bq-admin-muted py-5">No error or rate-limit events for these filters.</p>}</div></section>
      </div>
    </div>
  );
};

export default CampusAdminAIUsage;
