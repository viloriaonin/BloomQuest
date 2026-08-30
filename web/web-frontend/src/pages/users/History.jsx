import React, { useState, useEffect } from 'react';

// Adjust this if your backend runs on a different host/port
const API_URL = "/api/history";

// Converts an ISO date string from the backend into a friendly display format
const formatDate = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString()}, ${time}`;
};

// Helper function to render the correct icon based on the activity type
const getIcon = (type, status) => {
  if (type === 'delete') {
    return (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    );
  }

  switch (type) {
    case 'generate':
      return (
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      );
    case 'upload':
      return (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
        </svg>
      );
    case 'download':
      return (
        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
      );
    case 'classify':
      return (
        <svg className="w-5 h-5 text-[#b90000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
        </svg>
      );
    case 'delete':
      return (
        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      );
    case 'question_set':
    case 'export':
      return (
        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5h6m-7 4h8m-9 4h10m-9 4h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"></path>
        </svg>
      );
    case 'security':
      return (
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4zm-2 9l1.5 1.5L15 10"></path>
        </svg>
      );
    case 'academic':
    case 'user':
    case 'analysis':
    case 'question':
      return (
        <svg className="w-5 h-5 text-[#B4454A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm4 3h8M8 12h8M8 16h5"></path>
        </svg>
      );
    case 'login':
    default:
      return (
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
        </svg>
      );
  }
};

const History = () => {
  const [activeTab, setActiveTab] = useState('logins');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newActivityIds, setNewActivityIds] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const userId = localStorage.getItem('user_id');
        const email = localStorage.getItem('email');
        const query = userId ? `user_id=${encodeURIComponent(userId)}` : `email=${encodeURIComponent(email || '')}`;
        const res = await fetch(`${API_URL}?${query}`);
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const data = await res.json();
        const formatted = data.map((item) => ({
          ...item,
          date: formatDate(item.date),
        }));
        setHistory(formatted);
        const seen = JSON.parse(localStorage.getItem('bloomquest-seen-history') || '[]');
        setNewActivityIds(formatted.filter((item) => !seen.includes(item.id)).map((item) => item.id));
        setError(null);
      } catch (err) {
        console.error("Failed to load history:", err);
        setError("Could not load activity history. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const isDeletedActivity = (item) => String(item.type).toLowerCase() === 'delete' || /\bdeleted?\b|permanently removed/i.test(`${item.action || ''} ${item.details || ''}`);

  const tabs = [
    { id: 'logins', label: 'Users logged', types: ['login'] },
    { id: 'generated', label: 'Question generation', types: ['generate', 'question', 'question_set', 'classify'] },
    { id: 'exports', label: 'Exports / downloads', types: ['export', 'download'] },
    { id: 'deleted', label: 'Deleted', deleted: true },
  ];

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab);
  const matchesTab = (item, tab) => tab.deleted ? isDeletedActivity(item) : tab.status ? item.status === tab.status : tab.types?.includes(String(item.type).toLowerCase());
  const hasNewActivity = (tab) => history.some((item) => newActivityIds.includes(item.id) && matchesTab(item, tab));

  const activateTab = (tab) => {
    setActiveTab(tab.id);
    const matchingIds = history.filter((item) => matchesTab(item, tab)).map((item) => item.id);
    const seen = JSON.parse(localStorage.getItem('bloomquest-seen-history') || '[]');
    const nextSeen = [...new Set([...seen, ...matchingIds])];
    localStorage.setItem('bloomquest-seen-history', JSON.stringify(nextSeen));
    setNewActivityIds((current) => current.filter((id) => !matchingIds.includes(id)));
  };

  const filteredHistory = history.filter((item) => matchesTab(item, activeTabConfig));

  return (
    <div className="bq-page">
      <div className="bq-page-inner">

      {/* Header */}
      <div className="bq-page-header">
        <div>
          <p className="bq-eyebrow">Monitor workspace</p>
          <h2 className="bq-page-title">Activity History</h2>
          <p className="bq-page-description">Review your recent actions and system logs.</p>
        </div>

      </div>

      <div className="mb-6 overflow-x-auto rounded-lg border border-gray-100 bg-white px-3 shadow-sm">
        <div className="flex min-w-max items-center gap-1" role="tablist" aria-label="Activity history categories">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => activateTab(tab)}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${isActive ? 'border-[#B4454A] text-[#B4454A]' : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700'}`}
              >
                {tab.label}
                {hasNewActivity(tab) && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#B4454A]" aria-label="New activity" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="bq-panel p-6">

        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p>Loading activity history...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-400">
            <p>{error}</p>
          </div>
        ) : filteredHistory.length > 0 ? (
          <div className="relative border-l-2 border-gray-100 ml-3 md:ml-6 space-y-8 pb-4">
            {filteredHistory.map((item) => (
              <div key={item.id} className="relative pl-8 md:pl-10">

                {/* Timeline Dot with Icon */}
                <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center
                  ${item.status === 'error' ? 'bg-red-50' : 'bg-gray-50'} shadow-sm`}
                >
                  {getIcon(item.type, item.status)}
                </div>

                {/* Activity Content Box */}
                <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                    <h3 className={`font-semibold text-base ${item.status === 'error' ? 'text-red-600' : 'text-gray-800'}`}>
                      {item.action}
                    </h3>
                    <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {item.date}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-gray-600 text-sm">{item.details}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{item.type || 'system'}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p>No activity found.</p>
          </div>
        )}

      </div>
      </div>
    </div>
  );
};

export default History;