(() => {
  'use strict';

  // V3 renamed this helper to saveCurrentPathRecord, but one path-change
  // handler still calls the old name. Keep the alias so path switching works.
  persistActivePathRecord = saveCurrentPathRecord;

  // A progress-only record can earn standing before the path is chosen, but it
  // must not count as a previously entered path or skip its onboarding.
  const originalRestorePathRecord = restorePathRecord;
  restorePathRecord = function restorePathRecordWithStatus(pathKey) {
    const record = state.pathRecords?.[pathKey];
    const existed = Boolean(record && !record.progressOnly);
    originalRestorePathRecord(pathKey);
    return existed;
  };

})();
