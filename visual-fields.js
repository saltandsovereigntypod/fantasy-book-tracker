(() => {
  'use strict';

  const FIELD_DEFINITIONS = [
    { id: 'coverUrl', label: 'Cover image', category: 'Identity', path: 'coverUrl', type: 'image', role: 'image', moduleType: 'image', defaultWidth: 120, defaultHeight: 172 },
    { id: 'title', label: 'Title', category: 'Identity', path: 'title', type: 'text', role: 'title', moduleType: 'title', defaultWidth: 260, defaultHeight: 72 },
    { id: 'author', label: 'Author', category: 'Identity', path: 'author', type: 'text', role: 'metadata', moduleType: 'metadata', defaultWidth: 180, defaultHeight: 48 },
    { id: 'series', label: 'Series', category: 'Identity', path: 'series', type: 'text', role: 'metadata', moduleType: 'metadata', defaultWidth: 180, defaultHeight: 48 },
    { id: 'genres', label: 'Genres', category: 'Identity', path: 'genres', type: 'list', role: 'tags', moduleType: 'tags', defaultWidth: 220, defaultHeight: 56 },
    { id: 'tags', label: 'Tags', category: 'Identity', path: 'tags', type: 'list', role: 'tags', moduleType: 'tags', defaultWidth: 220, defaultHeight: 56 },
    { id: 'status', label: 'Status', category: 'Reading', path: 'status', type: 'text', role: 'metadata', moduleType: 'metadata', defaultWidth: 150, defaultHeight: 48 },
    { id: 'progress', label: 'Progress', category: 'Reading', path: 'progress', type: 'number', role: 'progress', moduleType: 'progress', defaultWidth: 190, defaultHeight: 58, max: 100, display: 'percent' },
    { id: 'chapter', label: 'Chapter', category: 'Reading', path: 'chapter', type: 'number', role: 'metadata', moduleType: 'metadata', defaultWidth: 130, defaultHeight: 44 },
    { id: 'startedAt', label: 'Started date', category: 'Reading', path: 'startedAt', type: 'date', role: 'metadata', moduleType: 'metadata', defaultWidth: 180, defaultHeight: 44 },
    { id: 'completedAt', label: 'Completed date', category: 'Reading', path: 'completedAt', type: 'date', role: 'metadata', moduleType: 'metadata', defaultWidth: 180, defaultHeight: 44 },
    { id: 'rating', label: 'Overall rating', category: 'Ratings', path: 'rating', type: 'rating', role: 'rating', moduleType: 'rating', defaultWidth: 150, defaultHeight: 62, max: 5, display: 'stars' },
    { id: 'spice', label: 'Spice rating', category: 'Ratings', path: 'spice', type: 'rating', role: 'rating', moduleType: 'rating', defaultWidth: 140, defaultHeight: 62, max: 5, display: 'fire' },
    { id: 'impact', label: 'Impact rating', category: 'Ratings', path: 'impact', type: 'rating', role: 'rating', moduleType: 'rating', defaultWidth: 150, defaultHeight: 62, max: 5, display: 'hearts' },
    { id: 'reaction', label: 'Reaction', category: 'Ratings', path: 'reaction', type: 'text', role: 'metadata', moduleType: 'metadata', defaultWidth: 160, defaultHeight: 48 },
    { id: 'summary', label: 'Summary', category: 'Notes', path: 'summary', type: 'longtext', role: 'metadata', moduleType: 'text', defaultWidth: 260, defaultHeight: 96 },
    { id: 'about', label: 'About', category: 'Notes', path: 'about', type: 'longtext', role: 'metadata', moduleType: 'notes', defaultWidth: 280, defaultHeight: 110 },
    { id: 'notes', label: 'Notes', category: 'Notes', path: 'notes', type: 'list', role: 'metadata', moduleType: 'notes', defaultWidth: 240, defaultHeight: 88 },
    { id: 'images', label: 'Extra image', category: 'Media', path: 'images', type: 'image', role: 'image', moduleType: 'image', defaultWidth: 120, defaultHeight: 120 },
    { id: 'linkedDossierIds', label: 'Dossiers count', category: 'Connections', path: 'linkedDossierIds', type: 'count', role: 'metadata', moduleType: 'counter', defaultWidth: 130, defaultHeight: 48 },
    { id: 'linkedTheoryIds', label: 'Theories count', category: 'Connections', path: 'linkedTheoryIds', type: 'count', role: 'metadata', moduleType: 'counter', defaultWidth: 130, defaultHeight: 48 },
    { id: 'linkedWallIds', label: 'Walls count', category: 'Connections', path: 'linkedWallIds', type: 'count', role: 'metadata', moduleType: 'counter', defaultWidth: 130, defaultHeight: 48 },
    { id: 'bookConnections', label: 'Relationships count', category: 'Connections', path: 'bookConnections', type: 'count', role: 'metadata', moduleType: 'counter', defaultWidth: 160, defaultHeight: 48 },
    { id: '$actions', label: 'Action buttons', category: 'Actions', path: '$actions', type: 'actions', role: 'actions', moduleType: 'button', defaultWidth: 240, defaultHeight: 54 },
    { id: 'customTracker', label: 'Custom tracker', category: 'Custom', path: 'trackerValues', type: 'custom', role: 'custom-slider', moduleType: 'slider', defaultWidth: 180, defaultHeight: 64 }
  ];

  const pathValue = (source = {}, path = '') => String(path).split('.').reduce((current, key) => current?.[key], source);
  const cleanArray = value => Array.isArray(value) ? value.filter(Boolean) : typeof value === 'string' ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
  const imageUrl = value => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return imageUrl(value[0]);
    return value.url || value.src || value.href || '';
  };
  const fieldById = id => FIELD_DEFINITIONS.find(field => field.id === id || field.path === id) || null;
  const relationshipCount = record => {
    const all = globalThis.state?.bookConnections || [];
    return all.filter(item => item.fromBookId === record?.id || item.toBookId === record?.id).length;
  };

  function resolve(record = {}, fieldOrPath = '') {
    const field = typeof fieldOrPath === 'object' ? fieldOrPath : fieldById(fieldOrPath) || { id: fieldOrPath, path: fieldOrPath };
    const id = field.id, path = field.path || id;
    if (id === '$actions') return '';
    if (id === 'rating') return record.ratings?.overall ?? record.ratings?.rating ?? record.rating ?? 0;
    if (id === 'spice') return record.ratings?.spice ?? record.spice ?? 0;
    if (id === 'impact') return record.ratings?.impact ?? record.impact ?? 0;
    if (id === 'reaction') return record.ratings?.reaction ?? record.reaction ?? '';
    if (id === 'progress') return record.progress ?? record.readingProgress ?? record.percentComplete ?? 0;
    if (id === 'coverUrl') return imageUrl(record.coverUrl || record.coverImage || record.cover || record.images);
    if (id === 'images') return imageUrl(record.images || record.additionalImages);
    if (id === 'bookConnections') return relationshipCount(record);
    const direct = pathValue(record, path);
    return direct ?? '';
  }

  function display(record = {}, fieldOrPath = '') {
    const field = typeof fieldOrPath === 'object' ? fieldOrPath : fieldById(fieldOrPath) || { id: fieldOrPath, path: fieldOrPath };
    const value = resolve(record, field);
    if (field.type === 'image') return imageUrl(value);
    if (field.type === 'date') return value ? new Date(value).toLocaleDateString() : '';
    if (field.type === 'count') return String(Array.isArray(value) ? value.length : Number(value || 0));
    if (field.id === 'notes') return cleanArray(value).map(note => note.text || note.title || note).join(' · ');
    if (Array.isArray(value)) return cleanArray(value).map(item => item.name || item.title || item.text || item).join(', ');
    return String(value ?? '');
  }

  function categories() {
    return FIELD_DEFINITIONS.reduce((groups, field) => {
      groups[field.category] ||= [];
      groups[field.category].push({ ...field });
      return groups;
    }, {});
  }

  globalThis.VisualFields = {
    schemaVersion: 1,
    fields: () => FIELD_DEFINITIONS.map(field => ({ ...field })),
    byId: id => fieldById(id),
    categories,
    resolve,
    display
  };
})();
