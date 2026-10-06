import React, { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, BookOpen, Lightbulb, RefreshCw } from "lucide-react";
import { API_URL } from "../../config/api";

const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

const AssessmentAnalytics = () => {
  const [assessments, setAssessments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [reuse, setReuse] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/analytics/tos-list`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || "Could not load your assessments.");
        return body;
      })
      .then((records) => {
        if (cancelled) return;
        const list = Array.isArray(records) ? records : [];
        setAssessments(list);
        if (list.length) setSelectedId(String(list[0].tos_id));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Could not load your assessments.");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAnalytics(null);
      setReuse(null);
      return undefined;
    }

    let cancelled = false;
    setLoadingAnalytics(true);
    setError("");
    Promise.all([
      fetch(`${API_URL}/analytics/tos/${selectedId}/forecast`),
      fetch(`${API_URL}/analytics/tos/${selectedId}/reuse-suggestions`),
    ])
      .then(async ([forecastResponse, reuseResponse]) => {
        const [forecastBody, reuseBody] = await Promise.all([
          forecastResponse.json(),
          reuseResponse.json(),
        ]);
        if (!forecastResponse.ok) throw new Error(forecastBody.detail || "Could not load assessment analytics.");
        if (!reuseResponse.ok) throw new Error(reuseBody.detail || "Could not load question recommendations.");
        return [forecastBody, reuseBody];
      })
      .then(([forecastBody, reuseBody]) => {
        if (cancelled) return;
        setAnalytics(forecastBody);
        setReuse(reuseBody);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setAnalytics(null);
          setReuse(null);
          setError(loadError.message || "Could not load assessment analytics.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAnalytics(false);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  const predictive = analytics?.predictive;
  const recommendations = analytics?.prescriptive?.top_priorities || [];
  const reuseSuggestions = reuse?.suggestions || [];
  const selectedAssessment = assessments.find((item) => String(item.tos_id) === selectedId);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#B4454A]">Assessment insights</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Assessment Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review question coverage against the assessment blueprint and see actionable gaps.
          </p>
        </div>
        <label className="flex min-w-64 flex-col gap-1 text-sm font-medium text-slate-700">
          Assessment
          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={loadingList || assessments.length === 0}
          >
            {assessments.length === 0 && <option value="">No saved assessments</option>}
            {assessments.map((item) => (
              <option key={item.tos_id} value={item.tos_id}>
                {[item.subject_name, item.exam_type, `Assessment ${item.tos_id}`].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </label>
      </header>

      <aside className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <p>
          This is a coverage snapshot, not a time-based outcome prediction. At-risk levels are
          more than 15 percentage points behind overall completion. Counts and recommendations
          use the Bloom labels currently saved on questions; review those labels before acting.
        </p>
      </aside>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loadingList || loadingAnalytics ? (
        <div className={`${panelClass} flex items-center gap-3 text-sm text-slate-600`}>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading assessment analytics…
        </div>
      ) : !error && assessments.length === 0 ? (
        <section className={`${panelClass} text-center`}>
          <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-900">No saved assessments yet</h2>
          <p className="mt-1 text-sm text-slate-600">Generate and save an assessment to see its coverage analysis here.</p>
        </section>
      ) : predictive && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article className={panelClass}>
              <p className="text-sm font-medium text-slate-500">Overall coverage</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{predictive.overall_completion_pct}%</p>
              <p className="mt-1 text-sm text-slate-600">
                {predictive.overall_actual_total} of {predictive.overall_target_total} target questions
              </p>
            </article>
            <article className={panelClass}>
              <p className="text-sm font-medium text-slate-500">Questions saved</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{selectedAssessment?.questions_written_so_far ?? predictive.overall_actual_total}</p>
              <p className="mt-1 text-sm text-slate-600">Active questions linked to this assessment</p>
            </article>
            <article className={panelClass}>
              <p className="text-sm font-medium text-slate-500">Bloom levels at risk</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{predictive.at_risk_bloom_levels.length}</p>
              <p className="mt-1 text-sm text-slate-600">More than 15 points behind overall coverage</p>
            </article>
          </section>

          {predictive.at_risk_bloom_levels.length > 0 && (
            <section className={`${panelClass} border-amber-200`}>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <AlertTriangle className="h-5 w-5 text-amber-600" /> Coverage to review
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {predictive.at_risk_bloom_levels.map((item) => (
                  <span key={item.bloom_level} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                    {item.bloom_level}: {item.completion_pct}% ({item.actual}/{item.target})
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className={`${panelClass} space-y-5`}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BarChart3 className="h-5 w-5 text-[#B4454A]" /> Topic and Bloom-level coverage
            </h2>
            {predictive.topics.map((topic) => (
              <article key={topic.topic_name} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{topic.topic_name}</h3>
                  <span className="text-sm text-slate-600">
                    {topic.actual_total}/{topic.target_total} questions · {topic.completion_pct}%
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {BLOOM_LEVELS.filter((level) => topic.bloom_levels[level].target > 0).map((level) => {
                    const counts = topic.bloom_levels[level];
                    return (
                      <div key={level} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium text-slate-700">{level}</span>
                          <span className="text-slate-600">{counts.actual}/{counts.target}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[#B4454A]"
                            style={{ width: `${Math.min(100, (counts.actual / counts.target) * 100)}%` }}
                          />
                        </div>
                        {counts.gap > 0 && <p className="mt-1 text-xs text-amber-700">{counts.gap} still needed</p>}
                        {counts.surplus > 0 && <p className="mt-1 text-xs text-slate-500">{counts.surplus} over target</p>}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className={`${panelClass} space-y-4`}>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Lightbulb className="h-5 w-5 text-[#B4454A]" /> Recommended next steps
              </h2>
              {recommendations.length ? recommendations.map((item, index) => (
                <div key={`${item.topic_name}-${item.bloom_level}`} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-[#8F1424]">{index + 1}</span>
                  <p className="text-sm text-slate-700">{item.message}</p>
                </div>
              )) : <p className="text-sm text-slate-600">No Bloom-level gaps remain against this blueprint.</p>}
            </div>

            <div className={`${panelClass} space-y-4`}>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <BookOpen className="h-5 w-5 text-[#B4454A]" /> Similar questions to review
              </h2>
              <p className="text-xs text-slate-500">
                Matches are based on topic text and saved Bloom labels. Review and adapt them manually; they are not added automatically.
              </p>
              {reuseSuggestions.length ? reuseSuggestions.map((gap) => (
                <div key={`${gap.topic_name}-${gap.bloom_level}`} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {gap.topic_name} · {gap.bloom_level} · {gap.needed} needed
                  </p>
                  {gap.matches?.length ? gap.matches.map((match) => (
                    <div key={match.question_id} className="mt-2 rounded-lg bg-slate-50 p-3">
                      <p className="text-sm text-slate-800">{match.question}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {match.topic_name || "Other topic"} · {Math.round(match.similarity * 100)}% text similarity
                      </p>
                    </div>
                  )) : <p className="mt-2 text-xs text-slate-500">No sufficiently similar saved question was found.</p>}
                </div>
              )) : <p className="text-sm text-slate-600">{reuse?.note || "No question-bank matches are available for the remaining gaps."}</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default AssessmentAnalytics;
