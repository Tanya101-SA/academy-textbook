import { useState, useEffect } from 'react';
import { authFetch } from '../hooks/useAuth';

interface FilterBarProps {
  filters: {
    grade: string;
    subject: string;
    term: string;
    language: string;
    search: string;
  };
  onFilterChange: (filters: any) => void;
}

export default function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const [subjects, setSubjects] = useState<string[]>([]);

  // Load subjects when grade changes
  useEffect(() => {
    const url = filters.grade
      ? `/api/topics/subjects?grade=${filters.grade}`
      : '/api/topics/subjects';
    authFetch(url)
      .then((res) => res.json())
      .then(setSubjects)
      .catch(console.error);
  }, [filters.grade]);

  const handleChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    // Reset subject when grade changes
    if (key === 'grade') newFilters.subject = '';
    onFilterChange(newFilters);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Grade */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
          <select
            value={filters.grade}
            onChange={(e) => handleChange('grade', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Grades</option>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
          <select
            value={filters.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Term */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Term</label>
          <select
            value={filters.term}
            onChange={(e) => handleChange('term', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Terms</option>
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>
                Term {t}
              </option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
          <select
            value={filters.language}
            onChange={(e) => handleChange('language', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Languages</option>
            <option value="English">English</option>
            <option value="Afrikaans">Afrikaans</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            placeholder="Search sub-topics..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
