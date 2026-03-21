import { useState, useEffect } from 'react';
import { authFetch } from '../hooks/useAuth';

interface Mapping {
  id: number;
  publisherId: number;
  publisherName: string;
  textbookTopic: string | null;
  textbookTopicName: string;
  notes: string | null;
  updatedAt: string;
}

interface Publisher {
  id: number;
  name: string;
}

interface TopicDetail {
  id: number;
  language: string;
  grade: number;
  subjectName: string;
  term: number;
  topicName: string;
  submoduleName: string;
  submoduleId: number;
  mappings: Mapping[];
}

interface MappingPanelProps {
  topicId: number;
  onClose: () => void;
  onMappingChanged: () => void;
}

export default function MappingPanel({ topicId, onClose, onMappingChanged }: MappingPanelProps) {
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [addingPublisherId, setAddingPublisherId] = useState<number | null>(null);
  const [addValue, setAddValue] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [saving, setSaving] = useState(false);
  // ONE topic value per publisher
  const [pubTopics, setPubTopics] = useState<Record<number, string>>({});
  // Track which publisher's topic is saved (from DB)
  const [savedTopics, setSavedTopics] = useState<Record<number, string>>({});
  // Which publisher's topic is in edit mode
  const [editingTopicPubId, setEditingTopicPubId] = useState<number | null>(null);

  const loadTopic = () => {
    Promise.all([
      authFetch(`/api/topics/${topicId}`).then((r) => r.json()),
      authFetch('/api/publishers').then((r) => r.json()),
    ])
      .then(([topicData, pubData]) => {
        setTopic(topicData);
        setPublishers(pubData);
        // Build fresh topic map from loaded data (replace, not merge)
        const topics: Record<number, string> = {};
        topicData.mappings.forEach((m: Mapping) => {
          if (m.textbookTopic && !topics[m.publisherId]) {
            topics[m.publisherId] = m.textbookTopic;
          }
        });
        setPubTopics(topics);
        setSavedTopics({ ...topics });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPubTopics({});
    setSavedTopics({});
    setEditingTopicPubId(null);
    loadTopic();
  }, [topicId]);

  // Group mappings by publisher ID
  const mappingsByPublisher = new Map<number, Mapping[]>();
  if (topic) {
    topic.mappings.forEach((m) => {
      const existing = mappingsByPublisher.get(m.publisherId) ?? [];
      mappingsByPublisher.set(m.publisherId, [...existing, m]);
    });
  }

  // Save the topic value to ALL mappings for this publisher
  const savePublisherTopic = async (publisherId: number) => {
    const pubMappings = mappingsByPublisher.get(publisherId) ?? [];
    const topicValue = (pubTopics[publisherId] ?? '').trim() || null;
    if (!topicValue) {
      setEditingTopicPubId(null);
      return;
    }
    if (pubMappings.length === 0) {
      // No sub-topics yet — create a topic-only stub mapping
      await authFetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemTopicId: topicId,
          publisherId,
          textbookTopic: topicValue,
          textbookTopicName: '',
        }),
      });
    } else {
      for (const mapping of pubMappings) {
        if (mapping.textbookTopic !== topicValue) {
          await authFetch(`/api/mappings/${mapping.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              textbookTopic: topicValue,
              textbookTopicName: mapping.textbookTopicName,
              notes: mapping.notes,
            }),
          });
        }
      }
    }
    setSavedTopics((prev) => ({ ...prev, [publisherId]: topicValue }));
    setEditingTopicPubId(null);
    loadTopic();
    onMappingChanged();
  };

  // Remove the topic value from ALL mappings for this publisher
  const removePublisherTopic = async (publisherId: number) => {
    const pubMappings = mappingsByPublisher.get(publisherId) ?? [];
    for (const mapping of pubMappings) {
      if (!mapping.textbookTopicName) {
        // Delete stub (topic-only) mappings entirely
        await authFetch(`/api/mappings/${mapping.id}`, { method: 'DELETE' });
      } else if (mapping.textbookTopic) {
        // Clear topic from real sub-topic mappings
        await authFetch(`/api/mappings/${mapping.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textbookTopic: null,
            textbookTopicName: mapping.textbookTopicName,
            notes: mapping.notes,
          }),
        });
      }
    }
    setPubTopics((prev) => { const next = { ...prev }; delete next[publisherId]; return next; });
    setSavedTopics((prev) => { const next = { ...prev }; delete next[publisherId]; return next; });
    setEditingTopicPubId(null);
    loadTopic();
    onMappingChanged();
  };

  const handleSaveNew = async (publisherId: number) => {
    const topicValue = (pubTopics[publisherId] ?? '').trim() || null;
    const subTopicValue = addValue.trim();
    const notesValue = addNotes.trim() || null;
    // If no sub-topic, save topic if present then close the form
    if (!subTopicValue) {
      if (topicValue) {
        setSaving(true);
        await savePublisherTopic(publisherId);
        setSaving(false);
      }
      setAddValue('');
      setAddNotes('');
      setAddingPublisherId(null);
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemTopicId: topicId,
          publisherId,
          textbookTopic: topicValue,
          textbookTopicName: subTopicValue,
          notes: notesValue,
        }),
      });
      if (res.ok) {
        setAddValue('');
        setAddNotes('');
        loadTopic();
        onMappingChanged();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save');
      }
    } catch (e) {
      alert('Failed to save mapping');
    }
    setSaving(false);
  };

  const handleUpdate = async (mappingId: number, publisherId: number) => {
    setSaving(true);
    try {
      const res = await authFetch(`/api/mappings/${mappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textbookTopic: (pubTopics[publisherId] ?? '').trim() || null,
          textbookTopicName: editValue.trim(),
          notes: editNotes.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        loadTopic();
        onMappingChanged();
      }
    } catch (e) {
      alert('Failed to update mapping');
    }
    setSaving(false);
  };

  const handleDelete = async (mappingId: number) => {
    if (!confirm('Are you sure you want to remove this mapping?')) return;
    try {
      const res = await authFetch(`/api/mappings/${mappingId}`, { method: 'DELETE' });
      if (res.ok) {
        loadTopic();
        onMappingChanged();
      }
    } catch (e) {
      alert('Failed to delete mapping');
    }
  };

  const startAdding = (publisherId: number) => {
    setAddingPublisherId(publisherId);
    setAddValue('');
    setAddNotes('');
    setEditingId(null);
  };

  const cancelAdding = () => {
    setAddingPublisherId(null);
    setAddValue('');
    setAddNotes('');
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (!topic) return <div className="p-6 text-red-500">Topic not found</div>;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 border-b border-blue-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{topic.submoduleName}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Grade {topic.grade} &middot; {topic.subjectName} &middot; Term {topic.term} &middot;{' '}
              {topic.language}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Topic: {topic.topicName} &middot; ID: {topic.submoduleId}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>
      </div>

      {/* Publisher mapping list */}
      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {publishers.map((pub) => {
          const allPubMappings = mappingsByPublisher.get(pub.id) ?? [];
          const pubMappings = allPubMappings.filter((m) => m.textbookTopicName !== '');
          const isAdding = addingPublisherId === pub.id;
          const hasMappings = allPubMappings.some((m) => m.textbookTopic || m.textbookTopicName);

          return (
            <div key={pub.id} className="px-4 py-2 hover:bg-gray-50">
              {/* Not mapped — single row */}
              {!hasMappings && !savedTopics[pub.id] && !isAdding && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-gray-700 w-40 shrink-0">{pub.name}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-gray-400 italic">Not mapped</span>
                    <button
                      onClick={() => startAdding(pub.id)}
                      className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1 rounded"
                    >
                      + Add Match
                    </button>
                  </div>
                </div>
              )}

              {/* Has mappings or is adding */}
              {(hasMappings || savedTopics[pub.id] || isAdding) && (
                <>
                  {/* Row 1: Publisher name + ONE Topic (saved badge or input) */}
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-sm font-medium text-gray-700 w-40 shrink-0">{pub.name}</span>
                    {savedTopics[pub.id] && editingTopicPubId !== pub.id ? (
                      <>
                        <span className="text-sm text-teal-800 bg-teal-50 border border-teal-200 px-2 py-1 rounded">
                          {savedTopics[pub.id]}
                        </span>
                        <button
                          onClick={() => {
                            setEditingTopicPubId(pub.id);
                            setPubTopics((prev) => ({ ...prev, [pub.id]: savedTopics[pub.id] }));
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removePublisherTopic(pub.id)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={pubTopics[pub.id] ?? ''}
                          onChange={(e) => setPubTopics((prev) => ({ ...prev, [pub.id]: e.target.value }))}
                          className="border border-teal-300 rounded px-2 py-1 text-sm w-36 bg-teal-50 text-teal-800"
                          placeholder="Topic"
                          autoFocus={editingTopicPubId === pub.id}
                        />
                        <button
                          onClick={() => savePublisherTopic(pub.id)}
                          className="text-xs bg-teal-600 text-white hover:bg-teal-700 px-3 py-1 rounded"
                        >
                          Save
                        </button>
                        {editingTopicPubId === pub.id && (
                          <button
                            onClick={() => {
                              setEditingTopicPubId(null);
                              setPubTopics((prev) => ({ ...prev, [pub.id]: savedTopics[pub.id] ?? '' }));
                            }}
                            className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Sub-topic rows (skip topic-only stubs) */}
                  {pubMappings.map((mapping, idx) => {
                    const isEditingThis = editingId === mapping.id;
                    return (
                      <div key={mapping.id} className="flex items-center justify-between py-1 pl-40">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                              placeholder="Sub-Topic"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-28"
                              placeholder="Notes"
                            />
                            <button
                              onClick={() => handleUpdate(mapping.id, pub.id)}
                              disabled={saving}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm text-green-700 bg-green-50 px-2 py-1 rounded truncate">
                              {mapping.textbookTopicName}
                            </span>
                            <div className="flex gap-1 shrink-0 items-center">
                              <button
                                onClick={() => {
                                  setEditingId(mapping.id);
                                  setEditValue(mapping.textbookTopicName);
                                  setEditNotes(mapping.notes || '');
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(mapping.id)}
                                className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                              >
                                Remove
                              </button>
                              {idx === pubMappings.length - 1 && !isAdding && (
                                <button
                                  onClick={() => startAdding(pub.id)}
                                  className="text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-2 py-1 rounded"
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Show + Add when there are no visible sub-topics */}
                  {pubMappings.length === 0 && !isAdding && (
                    <div className="flex items-center py-1 pl-40">
                      <button
                        onClick={() => startAdding(pub.id)}
                        className="text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-2 py-1 rounded"
                      >
                        + Add Sub-Topic
                      </button>
                    </div>
                  )}

                  {/* Add Sub-Topic form (no Topic input — uses the one above) */}
                  {isAdding && (
                    <div className="flex items-center gap-2 py-1 pl-40">
                      <input
                        type="text"
                        value={addValue}
                        onChange={(e) => setAddValue(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                        placeholder="Sub-Topic"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={addNotes}
                        onChange={(e) => setAddNotes(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-28"
                        placeholder="Notes"
                      />
                      <button
                        onClick={() => handleSaveNew(pub.id)}
                        disabled={saving}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelAdding}
                        className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
