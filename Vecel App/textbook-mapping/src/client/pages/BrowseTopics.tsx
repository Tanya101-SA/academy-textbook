import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authFetch } from '../hooks/useAuth';
import FilterBar from '../components/FilterBar';
import TopicTable from '../components/TopicTable';
import MappingPanel from '../components/MappingPanel';

interface Topic {
  id: number;
  language: string;
  grade: number;
  subjectName: string;
  term: number;
  topicName: string;
  submoduleName: string;
  submoduleId: number;
  mappingCount: number;
}

export default function BrowseTopics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    grade: searchParams.get('grade') || '',
    subject: searchParams.get('subject') || '',
    term: searchParams.get('term') || '',
    language: searchParams.get('language') || '',
    search: searchParams.get('search') || '',
  });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);

  const loadTopics = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.grade) params.set('grade', filters.grade);
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.term) params.set('term', filters.term);
    if (filters.language) params.set('language', filters.language);
    if (filters.search) params.set('search', filters.search);
    params.set('page', String(page));
    params.set('limit', '50');

    authFetch(`/api/topics?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setTopics(data.topics);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(loadTopics, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadTopics]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
    setSelectedTopicId(null);
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    setSearchParams(params);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Browse Topics</h1>

      <FilterBar filters={filters} onFilterChange={handleFilterChange} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {pagination.total.toLocaleString()} topics found
        </p>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Topics list */}
        <div>
          <TopicTable
            topics={topics}
            selectedId={selectedTopicId}
            onSelect={(topic) => setSelectedTopicId(topic.id)}
            loading={loading}
          />
        </div>

        {/* Right: white space until a topic is clicked, then mapping panel pops up */}
        <div>
          <div className="sticky top-4">
            {selectedTopicId ? (
              <MappingPanel
                topicId={selectedTopicId}
                onClose={() => setSelectedTopicId(null)}
                onMappingChanged={loadTopics}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 h-64" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
