"use client";

import { useState, useEffect } from "react";

interface Impression {
  query: string;
  image_id: string;
  display_count: number;
  feedback_count: number;
  avg_rating: number;
  is_firm: boolean;
  firm_action: string;
  admin_override: string | null;
  updated_at: string;
}

export default function AdminFeedbackPage() {
  const [impressions, setImpressions] = useState<Impression[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "firm" | "overridden">("all");

  const fetchImpressions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feedback");
      const data = await res.json();
      setImpressions(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchImpressions(); }, []);

  const handleOverride = async (query: string, imageId: string, action: string) => {
    try {
      await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, image_id: imageId, action }),
      });
      fetchImpressions();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = impressions.filter(i => {
    if (filter === "firm") return i.is_firm;
    if (filter === "overridden") return i.admin_override != null;
    return true;
  });

  const actionColor = (action: string) => {
    switch (action) {
      case "remove": return "text-red-700 bg-red-100";
      case "penalize": return "text-orange-700 bg-orange-100";
      case "boost": return "text-green-700 bg-green-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Search Feedback Admin</h1>
            <p className="text-sm text-gray-500 mt-1">
              Review human feedback on search results. Auto-firmed at 100+ displays with 3%+ feedback rate.
            </p>
          </div>
          <a href="/" className="text-sm text-blue-600 hover:underline">Back to app</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Show:</span>
          {(["all", "firm", "overridden"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full ${filter === f ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
            >
              {f === "all" ? `All (${impressions.length})` : f === "firm" ? `Auto-firmed (${impressions.filter(i => i.is_firm).length})` : `Admin overridden (${impressions.filter(i => i.admin_override).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-20">No feedback data yet</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Query</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Image ID</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Displays</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Feedback</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Rate</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Avg Rating</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(imp => {
                  const rate = imp.display_count > 0 ? (imp.feedback_count / imp.display_count * 100).toFixed(1) : "0";
                  const effectiveAction = imp.admin_override || imp.firm_action;

                  return (
                    <tr key={`${imp.query}-${imp.image_id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-blue-600">{imp.query}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{imp.image_id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-right text-gray-700">{imp.display_count}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{imp.feedback_count}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{rate}%</td>
                      <td className={`px-4 py-3 text-right font-medium ${imp.avg_rating > 0 ? "text-green-600" : imp.avg_rating < 0 ? "text-red-600" : "text-gray-500"}`}>
                        {imp.avg_rating > 0 ? "+" : ""}{imp.avg_rating.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {imp.is_firm ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">FIRM</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs text-gray-400">pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(effectiveAction)}`}>
                          {effectiveAction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={imp.admin_override || ""}
                          onChange={e => handleOverride(imp.query, imp.image_id, e.target.value || "clear")}
                          className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-700"
                        >
                          <option value="">auto</option>
                          <option value="boost">boost</option>
                          <option value="penalize">penalize</option>
                          <option value="remove">remove</option>
                          <option value="none">none</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
