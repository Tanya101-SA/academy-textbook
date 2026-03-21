import { useState, useEffect } from 'react';
import { authFetch } from '../hooks/useAuth';

interface Publisher {
  id: number;
  name: string;
}

interface Subject {
  id: number;
  name: string;
}

interface MissingTopic {
  id: number;
  publisherId: number;
  publisherName: string;
  grade: number;
  subjectId: number;
  subjectName: string;
  term: number;
  topic: string;
  subTopic: string | null;
  createdAt: string;
}

const GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const TERMS = [1, 2, 3, 4];

export default function MissingTopics() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [entries, setEntries] = useState<MissingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [publisherId, setPublisherId] = useState('');
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState('');
  const [topic, setTopic] = useState('');
  const [subTopic, setSubTopic] = useState('');

  const loadData = () => {
    Promise.all([
      authFetch('/api/publishers').then((r) => r.json()),
      authFetch('/api/topics/subjects?withIds=true').then((r) => r.json()),
      authFetch('/api/missing-topics').then((r) => r.json()),
    ])
      .then(([pubData, subData, entriesData]) => {
        setPublishers(pubData);
        setSubjects(subData);
        setEntries(entriesData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (!publisherId || !grade || !subjectId || !term || !topic.trim()) {
      alert('Please fill in Textbook, Grade, Subject, Term, and Topic');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/missing-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherId: parseInt(publisherId),
          grade,
          subjectId: parseInt(subjectId),
          term,
          topic: topic.trim(),
          subTopic: subTopic.trim() || null,
        }),
      });
      if (res.ok) {
        setTopic('');
        setSubTopic('');
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save');
      }
    } catch {
      alert('Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this entry?')) return;
    try {
      const res = await authFetch(`/api/missing-topics/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch {
      alert('Failed to delete');
    }
  };

  if (loading) {
    return <div className="text-gray-500 p-8">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Missing Textbook Topics</h1>
      <p className="text-sm text-gray-500 mb-6">
        Add topics and sub-topics that appear in textbooks but are not in our system.
      </p>

      {/* Add form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Entry</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Textbook</label>
            <select
              value={publisherId}
              onChange={(e) => setPublisherId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select textbook...</option>
              {publishers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select grade...</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select term...</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>Term {t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Enter the textbook topic..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sub-Topic (optional)</label>
            <input
              type="text"
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Enter the textbook sub-topic..."
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* List of entries */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Saved Entries ({entries.length})
          </h2>
        </div>
        {entries.length === 0 ? (
          <div className="p-6 text-gray-400 text-sm text-center">No entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Textbook</th>
                  <th className="px-4 py-3 text-left">Grade</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Term</th>
                  <th className="px-4 py-3 text-left">Topic</th>
                  <th className="px-4 py-3 text-left">Sub-Topic</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{entry.publisherName}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.grade}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.subjectName}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.term}</td>
                    <td className="px-4 py-3 text-gray-800">{entry.topic}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.subTopic || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
