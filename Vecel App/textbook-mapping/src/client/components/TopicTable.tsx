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

interface TopicTableProps {
  topics: Topic[];
  selectedId: number | null;
  onSelect: (topic: Topic) => void;
  loading: boolean;
}

export default function TopicTable({ topics, selectedId, onSelect, loading }: TopicTableProps) {
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading topics...</div>;
  }

  if (topics.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No topics found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sub-Topic</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lang</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mapped</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {topics.map((topic) => (
            <tr
              key={topic.id}
              onClick={() => onSelect(topic)}
              className={`cursor-pointer transition-colors ${
                selectedId === topic.id
                  ? 'bg-blue-50 border-l-4 border-l-blue-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <td className="px-4 py-3 text-sm text-gray-900">{topic.grade}</td>
              <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">{topic.subjectName}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{topic.term}</td>
              <td className="px-4 py-3 text-sm text-gray-700 max-w-[180px] truncate">{topic.topicName}</td>
              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{topic.submoduleName}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{topic.language === 'English' ? 'EN' : 'AF'}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                    topic.mappingCount > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {topic.mappingCount}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
