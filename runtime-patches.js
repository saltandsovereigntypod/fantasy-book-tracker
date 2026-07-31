(() => {
  'use strict';

  // Preserve compatibility with the earlier path-switch handler.
  persistActivePathRecord = saveCurrentPathRecord;

  // A progress-only record is allowed to accumulate standing before the path
  // is chosen, but it must not count as a previously entered path.
  const originalRestorePathRecord = restorePathRecord;
  restorePathRecord = function restorePathRecordWithStatus(pathKey) {
    const record = state.pathRecords?.[pathKey];
    const existed = Boolean(record && !record.progressOnly);
    originalRestorePathRecord(pathKey);
    return existed;
  };

  function calculateRank(pathKey, record) {
    const config = PATHS[pathKey];
    let rankIndex = 0;
    config.thresholds.forEach((threshold, index) => {
      if ((record.points || 0) >= threshold) rankIndex = index;
    });

    if ((pathKey === 'rider' || pathKey === 'gryphon') && !record.eventComplete) {
      rankIndex = Math.min(rankIndex, 1);
    }

    return Math.min(rankIndex, config.ranks.length - 1);
  }

  // Reading and theory activity advances every path, no matter which visual
  // theme is active. Dark Wielders receive 25% of the base award because their
  // four formal ranks are intentionally much harder to reach.
  award = function awardEveryPath(amount, message) {
    const baseAward = Math.max(0, Number(amount) || 0);
    const activePath = state.profile.path;
    const previousActiveRank = state.profile.rankIndex;

    saveCurrentPathRecord();
    state.pathRecords = state.pathRecords || {};

    Object.keys(PATHS).forEach(pathKey => {
      let record = state.pathRecords[pathKey];
      if (!record) {
        record = { ...blankPathRecord(pathKey), progressOnly: pathKey !== activePath };
      }

      const pathAward = pathKey === 'dark'
        ? (baseAward > 0 ? Math.max(1, Math.round(baseAward * 0.25)) : 0)
        : baseAward;

      record.points = Math.max(0, Number(record.points) || 0) + pathAward;
      record.rankIndex = calculateRank(pathKey, record);
      state.pathRecords[pathKey] = record;
    });

    const activeRecord = state.pathRecords[activePath];
    activeRecord.progressOnly = false;
    state.profile.points = activeRecord.points;
    state.profile.rankIndex = activeRecord.rankIndex;

    saveState();
    applyTheme();

    const activeGain = activePath === 'dark'
      ? (baseAward > 0 ? Math.max(1, Math.round(baseAward * 0.25)) : 0)
      : baseAward;

    if (state.profile.rankIndex > previousActiveRank) {
      showToast(`Promoted to ${currentRank()}.`);
    } else {
      showToast(message || `+${activeGain} ${path().progressName}`);
    }
  };
})();
