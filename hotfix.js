(() => {
  'use strict';

  // V3 renamed this helper to saveCurrentPathRecord, but one path-change
  // handler still calls the old name. Keep the alias so path switching works.
  window.persistActivePathRecord = function persistActivePathRecord() {
    if (typeof window.saveCurrentPathRecord === 'function') {
      return window.saveCurrentPathRecord();
    }
  };

  // The original restore helper does not report whether a saved path existed.
  // The clicked path card already carries that status in its subtitle, so use
  // the UI state to preserve old bonds while still onboarding genuinely new paths.
  if (typeof window.restorePathRecord === 'function') {
    const originalRestorePathRecord = window.restorePathRecord;
    window.restorePathRecord = function restorePathRecordWithStatus(pathKey) {
      const activeButton = document.activeElement?.closest?.('[data-new-path]');
      const subtitle = activeButton?.querySelector('small')?.textContent?.trim() || '';
      const existed = subtitle !== 'New path record';
      originalRestorePathRecord(pathKey);
      return existed;
    };
  }
})();
