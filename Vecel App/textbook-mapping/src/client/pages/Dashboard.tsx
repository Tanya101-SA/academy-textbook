import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../hooks/useAuth';

interface Stats {
  totalTopics: number;
  mappedTopics: number;
  totalMappings: number;
  percentMapped: number;
  gradeStats: { grade: number; totalTopics: number; mappedTopics: number }[];
  subjectStats: { subjectName: string; totalTopics: number; mappedTopics: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading stats...</div>;
  if (!stats) return <div className="text-center py-12 text-red-500">Failed to load stats</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Topics</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.totalTopics.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Topics Mapped</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{stats.mappedTopics.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Mappings</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{stats.totalMappings.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">% Mapped</div>
          <div className="text-3xl font-bold text-purple-600 mt-1">{stats.percentMapped}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-purple-600 h-2 rounded-full"
              style={{ width: `${stats.percentMapped}%` }}
            />
          </div>
        </div>
      </div>

      {/* Per-grade progress */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress by Grade</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.gradeStats.map((gs) => {
          const pct = gs.totalTopics > 0 ? Math.round((gs.mappedTopics / gs.totalTopics) * 100) : 0;
          return (
            <Link
              key={gs.grade}
              to={`/topics?grade=${gs.grade}`}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">Grade {gs.grade}</span>
                <span className="text-sm text-gray-500">
                  {gs.mappedTopics}/{gs.totalTopics} topics
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-right text-xs text-gray-500 mt-1">{pct}%</div>
            </Link>
          );
        })}
      </div>

      {/* Per-subject progress */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress by Subject</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mapped</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stats.subjectStats.map((ss) => {
              const pct = ss.totalTopics > 0 ? Math.round((ss.mappedTopics / ss.totalTopics) * 100) : 0;
              return (
                <tr key={ss.subjectName} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{ss.subjectName}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{ss.totalTopics}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{ss.mappedTopics}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
