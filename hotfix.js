(() => {
  'use strict';

  // V3 renamed this helper to saveCurrentPathRecord, but one path-change
  // handler still calls the old name. Keep the alias so path switching works.
  window.persistActivePathRecord = function persistActivePathRecord() {
    if (typeof window.saveCurrentPathRecord === 'function') {
      return window.saveCurrentPathRecord();
    }
  };

  // The original restore helper did not report whether a saved path already
  // existed. The path picker needs that boolean to avoid restarting a sealed
  // questionnaire when returning to a previously used path.
  if (typeof window.restorePathRecord === 'function') {
    const originalRestorePathRecord = window.restorePathRecord;
    window.restorePathRecord = function restorePathRecordWithStatus(pathKey) {
      const existed = Boolean(
        window.state &&
        window.state.pathRecords &&
        Object.prototype.hasOwnProperty.call(window.state.pathRecords, pathKey)
      );
      originalRestorePathRecord(pathKey);
      return existed;
    };
  }
})();
