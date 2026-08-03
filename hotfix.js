(() => {
  'use strict';

  // V3 renamed this helper to saveCurrentPathRecord, but one path-change
  // handler still calls the old name. Keep the alias so path switching works.
  globalThis.persistActivePathRecord = saveCurrentPathRecord;

  // A progress-only record can earn standing before the path is chosen, but it
  // must not count as a previously entered path or skip its onboarding.
  const originalRestorePathRecord = restorePathRecord;
  restorePathRecord = function restorePathRecordWithStatus(pathKey) {
    const record = state.pathRecords?.[pathKey];
    const existed = Boolean(record && !record.progressOnly);
    originalRestorePathRecord(pathKey);
    return existed;
  };

  // VisualBuilder renders data-builder-zoom="fit" and "100", while its bind
  // routine still queries the obsolete data-builder-zoom-fit/-100 selectors.
  // Translate only those two legacy selectors so editor binding cannot crash.
  const originalQuerySelector = Element.prototype.querySelector;
  Element.prototype.querySelector = function querySelectorWithVisualZoomAliases(selector) {
    if (selector === '[data-builder-zoom-fit]') {
      return originalQuerySelector.call(this, '[data-builder-zoom="fit"]');
    }
    if (selector === '[data-builder-zoom-100]') {
      return originalQuerySelector.call(this, '[data-builder-zoom="100"]');
    }
    return originalQuerySelector.call(this, selector);
  };

})();
