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

  // Every reading and theory action advances all six paths. Dark Wielders gain
  // one quarter of the base award because their four ranks are intentionally
  // much harder to reach.
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

  function loadStyle(href) {
    if ([...document.styleSheets].some(sheet => sheet.href && sheet.href.includes('investigation-features.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  loadStyle('investigation-features.css?v=20260731-1');
  loadScript('investigation-features.js?v=20260731-1')
    .then(() => {
      if (typeof renderAll === 'function') renderAll();
    })
    .catch(error => {
      console.error('Investigation features failed to load:', error);
    });
})();
