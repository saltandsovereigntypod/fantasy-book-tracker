(() => {
  'use strict';

  const originalHandleAction = handleAction;
  const originalRenderWall = renderWall;
  const originalEnableWallDragging = enableWallDragging;
  const resizeObservers = new WeakMap();
  let resizeSaveTimer;

  function formatRevisionDate(value) {
    if (!value) return 'Unknown time';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleString();
    }
  }

  function snapshotTheory(theory) {
    return {
      id: theory.id,
      statement: theory.statement || '',
      notes: theory.notes || '',
      bookId: theory.bookId || '',
      confidence: Number(theory.confidence) || 0,
      status: theory.status || 'Under investigation',
      createdAt: theory.createdAt || null,
      updatedAt: theory.updatedAt || null
    };
  }

  function theoryChanged(before, after) {
    return ['statement', 'notes', 'bookId', 'confidence', 'status']
      .some(key => String(before[key] ?? '') !== String(after[key] ?? ''));
  }

  function describeChanges(before, after) {
    const labels = {
      statement: 'theory statement',
      notes: 'reasoning or evidence',
      bookId: 'source book',
      confidence: 'confidence',
      status: 'status'
    };
    return Object.keys(labels)
      .filter(key => String(before[key] ?? '') !== String(after[key] ?? ''))
      .map(key => labels[key]);
  }

  theoryCard = function theoryCardWithHistory(theory) {
    const book = state.books.find(item => item.id === theory.bookId);
    const revisions = Array.isArray(theory.history) ? theory.history.length : 0;
    return `<article class="theory-card">
      <h4>${esc(theory.statement)}</h4>
      <p>${esc(theory.notes || '')}</p>
      <div class="confidence">
        <small>Confidence ${theory.confidence || 50}%</small>
        <div class="confidence-bar"><span style="width:${theory.confidence || 50}%"></span></div>
      </div>
      <div class="theory-meta">
        <span class="tag">${esc(theory.status || 'Under investigation')}</span>
        ${book ? `<span class="tag">${esc(book.title)}</span>` : ''}
        ${revisions ? `<span class="tag">${revisions} revision${revisions === 1 ? '' : 's'}</span>` : ''}
        <button class="small-button" data-action="edit-theory" data-id="${theory.id}">Update</button>
        <button class="small-button" data-action="theory-history" data-id="${theory.id}">Change Log</button>
        <button class="small-button" data-action="pin-theory" data-id="${theory.id}">Pin to wall</button>
        <button class="small-button" data-action="delete-theory" data-id="${theory.id}">Delete</button>
      </div>
    </article>`;
  };

  function openTheoryEditor(theoryId) {
    const theory = state.theories.find(item => item.id === theoryId);
    if (!theory) return;
    const previous = snapshotTheory(theory);

    modal(`<p class="eyebrow">Theory revision</p>
      <h2 id="formModalTitle">Update Theory</h2>
      <label class="form-group">
        <span class="field-label">Theory statement</span>
        <textarea class="text-area" id="editTheoryStatement">${esc(theory.statement)}</textarea>
      </label>
      <label class="form-group">
        <span class="field-label">Source book</span>
        <select class="select-input" id="editTheoryBook">
          <option value="">No book</option>${bookOptions(theory.bookId)}
        </select>
      </label>
      <div class="form-grid">
        <label class="form-group">
          <span class="field-label">Confidence</span>
          <input class="shared-range" type="range" data-range-format="percent" id="editTheoryConfidence" min="0" max="100" value="${Number(theory.confidence) || 50}">
        </label>
        <label class="form-group">
          <span class="field-label">Status</span>
          <select class="select-input" id="editTheoryStatus">
            ${['Fleeting suspicion','Under investigation','Strong possibility','Nearly certain','Confirmed','Partially confirmed','Disproven','Technically correct, catastrophically misunderstood']
              .map(status => `<option ${status === theory.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="form-group">
        <span class="field-label">Reasoning and evidence</span>
        <textarea class="text-area" id="editTheoryNotes">${esc(theory.notes || '')}</textarea>
      </label>
      <label class="form-group">
        <span class="field-label">Why are you changing it?</span>
        <textarea class="text-area" id="editTheoryReason" placeholder="New evidence, contradicted detail, changed interpretation, confidence adjustment…"></textarea>
      </label>
      <button class="primary-button full-width" id="saveTheoryRevision">Save Revision</button>`);

    document.getElementById('saveTheoryRevision').addEventListener('click', () => {
      const next = {
        statement: v('editTheoryStatement'),
        notes: v('editTheoryNotes'),
        bookId: v('editTheoryBook'),
        confidence: Number(v('editTheoryConfidence')),
        status: v('editTheoryStatus')
      };
      const reason = v('editTheoryReason');
      if (!next.statement) return showToast('The theory still needs a statement.');
      if (!theoryChanged(previous, next)) return showToast('Nothing has changed yet.');
      if (!reason) return showToast('Record why the theory changed.');

      const changedAt = Date.now();
      const completeNext = { ...previous, ...next, updatedAt: changedAt };
      theory.history = Array.isArray(theory.history) ? theory.history : [];
      theory.history.push({
        id: uid(),
        changedAt,
        reason,
        changedFields: describeChanges(previous, next),
        before: { ...previous },
        after: { ...completeNext }
      });

      Object.assign(theory, completeNext);
      saveState();
      closeModal();
      award(4, 'Theory revision preserved.');
      renderAll();
    });
  }

  function openTheoryHistory(theoryId) {
    const theory = state.theories.find(item => item.id === theoryId);
    if (!theory) return;
    const history = Array.isArray(theory.history) ? theory.history.slice().reverse() : [];

    modal(`<p class="eyebrow">Permanent theory record</p>
      <h2 id="formModalTitle">Change Log</h2>
      <p class="history-current"><strong>Current theory:</strong> ${esc(theory.statement)}</p>
      <div class="theory-history-list">
        ${history.length ? history.map((entry, index) => {
          const beforeBook = state.books.find(item => item.id === entry.before?.bookId)?.title || 'No book';
          const afterBook = state.books.find(item => item.id === entry.after?.bookId)?.title || 'No book';
          return `<article class="theory-history-entry">
            <div class="history-entry-header">
              <div><small>Revision ${history.length - index}</small><strong>${formatRevisionDate(entry.changedAt)}</strong></div>
              <span class="tag">${esc((entry.changedFields || []).join(', ') || 'Updated')}</span>
            </div>
            <p><strong>Reason:</strong> ${esc(entry.reason || 'No reason recorded.')}</p>
            <details>
              <summary>Compare before and after</summary>
              <div class="revision-compare">
                <section>
                  <small>Before</small>
                  <strong>${esc(entry.before?.statement || '')}</strong>
                  <p>${esc(entry.before?.notes || '')}</p>
                  <ul>
                    <li>Status: ${esc(entry.before?.status || '')}</li>
                    <li>Confidence: ${Number(entry.before?.confidence) || 0}%</li>
                    <li>Book: ${esc(beforeBook)}</li>
                  </ul>
                </section>
                <section>
                  <small>After</small>
                  <strong>${esc(entry.after?.statement || '')}</strong>
                  <p>${esc(entry.after?.notes || '')}</p>
                  <ul>
                    <li>Status: ${esc(entry.after?.status || '')}</li>
                    <li>Confidence: ${Number(entry.after?.confidence) || 0}%</li>
                    <li>Book: ${esc(afterBook)}</li>
                  </ul>
                </section>
              </div>
            </details>
          </article>`;
        }).join('') : '<div class="empty-state"><p>This theory has not been revised yet.</p></div>'}
      </div>`);
  }

  function cardReferenceName(cardId) {
    const card = state.wallCards.find(item => item.id === cardId);
    if (!card) return 'Missing card';
    const wall = state.walls.find(item => item.id === card.wallId);
    return `${wall?.name || 'Unknown wall'} › ${card.title}`;
  }

  wallCardHtml = function structuredWallCardHtml(card) {
    const incoming = state.wallLinks.filter(link => link.toCardId === card.id).length;
    const outgoing = state.wallLinks.filter(link => link.fromCardId === card.id).length;
    const sections = Array.isArray(card.sections) ? card.sections : [];
    const width = Math.max(210, Number(card.width) || 270);
    const height = Math.max(150, Number(card.height) || 0);
    const sizeStyle = `width:${width}px;${height ? `height:${height}px;` : ''}`;

    return `<article class="wall-card wall-card-structured" data-card-id="${card.id}" data-type="${esc(card.category || 'Custom')}" style="left:${card.x || 30}px;top:${card.y || 30}px;${sizeStyle}--rot:${card.rot || 0}deg">
      <span class="wall-pin"></span>
      <small>${esc(card.category || 'Custom')}</small>
      <h4>${esc(card.title)}</h4>
      ${card.text ? `<p>${esc(card.text)}</p>` : ''}
      ${sections.length ? `<div class="wall-card-sections">${sections.map(section => `
        <section class="wall-card-section">
          <strong>${esc(section.title || 'Untitled section')}</strong>
          ${section.value ? `<p>${esc(section.value)}</p>` : ''}
          ${(section.linkedCardIds || []).length ? `<div class="section-reference-list">${section.linkedCardIds.map(cardId => `
            <button type="button" class="section-reference" data-section-card-link="${cardId}">${esc(cardReferenceName(cardId))}</button>
          `).join('')}</div>` : ''}
        </section>
      `).join('')}</div>` : ''}
      <footer>
        <button class="card-link-count" data-action="card-links" data-id="${card.id}">${incoming + outgoing} links</button>
        <button class="card-menu" data-action="edit-wall-card" data-id="${card.id}">•••</button>
      </footer>
      <span class="resize-hint" aria-hidden="true">↘</span>
    </article>`;
  };

  function sectionEditorRow(section = {}) {
    const sectionId = section.id || uid();
    const selected = new Set(section.linkedCardIds || []);
    return `<div class="card-section-editor" data-section-editor="${sectionId}">
      <div class="section-editor-heading">
        <strong>Custom Section</strong>
        <div class="button-row">
          <button type="button" class="small-button" data-move-section="up" aria-label="Move section up">↑</button>
          <button type="button" class="small-button" data-move-section="down" aria-label="Move section down">↓</button>
          <button type="button" class="small-button" data-remove-section="${sectionId}">Remove</button>
        </div>
      </div>
      <label class="form-group">
        <span class="field-label">Section name</span>
        <input class="text-input section-title-input" value="${esc(section.title || '')}" placeholder="Signet, Dragon, Allegiance, Injury, Evidence…">
      </label>
      <label class="form-group">
        <span class="field-label">Section details</span>
        <textarea class="text-area section-value-input" placeholder="Record the information for this section.">${esc(section.value || '')}</textarea>
      </label>
      <label class="form-group">
        <span class="field-label">Reference cards from any wall</span>
        <select class="select-input section-links-input" multiple size="5">
          ${state.walls.flatMap(wall => state.wallCards
            .filter(card => card.wallId === wall.id && card.id !== section.cardId)
            .map(card => `<option value="${card.id}" ${selected.has(card.id) ? 'selected' : ''}>${esc(wall.name)} › ${esc(card.title)}</option>`)
          ).join('')}
        </select>
        <small class="field-help">Hold Ctrl on Windows or Command on Mac to select several cards.</small>
      </label>
    </div>`;
  }

  openEditCard = function openStructuredCardEditor(cardId) {
    const card = state.wallCards.find(item => item.id === cardId);
    if (!card) return;
    const sections = Array.isArray(card.sections) ? card.sections : [];

    modal(`<p class="eyebrow">Edit card dossier</p>
      <h2 id="formModalTitle">${esc(card.title)}</h2>
      <label class="form-group">
        <span class="field-label">Category</span>
        <input class="text-input" id="ecCategory" value="${esc(card.category)}">
      </label>
      <label class="form-group">
        <span class="field-label">Title</span>
        <input class="text-input" id="ecTitle" value="${esc(card.title)}">
      </label>
      <label class="form-group">
        <span class="field-label">Summary</span>
        <textarea class="text-area" id="ecText">${esc(card.text || '')}</textarea>
      </label>
      <div class="custom-sections-header">
        <div><p class="eyebrow">Structured dossier</p><h3>Custom Sections</h3></div>
        <button type="button" class="secondary-button" id="addCardSection">＋ Add Section</button>
      </div>
      <div id="cardSectionEditors">${sections.map(section => sectionEditorRow({ ...section, cardId })).join('')}</div>
      <div class="button-row">
        <button class="primary-button" id="saveEditCard">Save Card</button>
        <button class="secondary-button" id="deleteCard">Delete Card</button>
      </div>`);

    const editors = document.getElementById('cardSectionEditors');

    function bindSectionRemoveButtons() {
      editors.querySelectorAll('[data-remove-section]').forEach(button => {
        button.onclick = () => button.closest('.card-section-editor')?.remove();
      });
      editors.querySelectorAll('[data-move-section]').forEach(button => {
        button.onclick = () => {
          const row = button.closest('.card-section-editor');
          const sibling = button.dataset.moveSection === 'up' ? row?.previousElementSibling : row?.nextElementSibling;
          if (!row || !sibling) return;
          if (button.dataset.moveSection === 'up') editors.insertBefore(row, sibling);
          else editors.insertBefore(sibling, row);
        };
      });
    }

    document.getElementById('addCardSection').onclick = () => {
      editors.insertAdjacentHTML('beforeend', sectionEditorRow({ cardId }));
      bindSectionRemoveButtons();
      editors.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    bindSectionRemoveButtons();

    document.getElementById('saveEditCard').onclick = () => {
      const title = v('ecTitle');
      if (!title) return showToast('The card still needs a title.');

      card.category = v('ecCategory') || 'Custom';
      card.title = title;
      card.text = v('ecText');
      card.sections = [...editors.querySelectorAll('.card-section-editor')].map(editor => ({
        id: editor.dataset.sectionEditor,
        title: editor.querySelector('.section-title-input').value.trim(),
        value: editor.querySelector('.section-value-input').value.trim(),
        linkedCardIds: [...editor.querySelector('.section-links-input').selectedOptions].map(option => option.value)
      })).filter(section => section.title || section.value || section.linkedCardIds.length);

      saveState();
      closeModal();
      renderWall();
      showToast('Card dossier updated.');
    };

    document.getElementById('deleteCard').onclick = () => {
      state.wallCards = state.wallCards.filter(item => item.id !== cardId);
      state.wallLinks = state.wallLinks.filter(link => link.fromCardId !== cardId && link.toCardId !== cardId);
      state.wallCards.forEach(item => {
        if (!Array.isArray(item.sections)) return;
        item.sections.forEach(section => {
          section.linkedCardIds = (section.linkedCardIds || []).filter(id => id !== cardId);
        });
      });
      saveState();
      closeModal();
      renderWall();
    };
  };

  function focusReferencedCard(cardId) {
    const card = state.wallCards.find(item => item.id === cardId);
    if (!card) return showToast('That referenced card no longer exists.');
    state.activeWallId = card.wallId;
    saveState();
    renderWall();
    requestAnimationFrame(() => {
      const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`);
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      element.classList.add('is-reference-target');
      setTimeout(() => element.classList.remove('is-reference-target'), 1800);
    });
  }

  function bindSectionReferences(root = document) {
    root.querySelectorAll('[data-section-card-link]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        focusReferencedCard(button.dataset.sectionCardLink);
      });
    });
  }

  function bindResizePersistence() {
    const board = document.getElementById('wallBoard');
    if (!board || typeof ResizeObserver === 'undefined') return;

    board.querySelectorAll('.wall-card').forEach(element => {
      if (resizeObservers.has(element)) return;
      const observer = new ResizeObserver(entries => {
        const entry = entries[0];
        const card = state.wallCards.find(item => item.id === element.dataset.cardId);
        if (!card || !entry) return;
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        if (Math.abs((card.width || 270) - width) < 2 && (!card.height || Math.abs(card.height - height) < 2)) return;
        card.width = width;
        card.height = height;
        clearTimeout(resizeSaveTimer);
        resizeSaveTimer = setTimeout(() => saveState(), 350);
        drawWallLinks();
      });
      observer.observe(element);
      resizeObservers.set(element, observer);
    });
  }

  enableWallDragging = function enableDraggingAndResizing() {
    const board = document.getElementById('wallBoard');
    if (board) {
      board.querySelectorAll('.wall-card').forEach(card => {
        card.addEventListener('mousedown', event => {
          const rect = card.getBoundingClientRect();
          if (rect.right - event.clientX <= 22 && rect.bottom - event.clientY <= 22) {
            event.stopImmediatePropagation();
          }
        }, true);
      });
    }
    originalEnableWallDragging();
    bindResizePersistence();
  };

  renderWall = function renderWallWithDossiers() {
    originalRenderWall();
    bindSectionReferences(document.getElementById('wall'));
    bindResizePersistence();
  };

  handleAction = function handleInvestigationAction(action, id) {
    if (action === 'edit-theory') return openTheoryEditor(id);
    if (action === 'theory-history') return openTheoryHistory(id);
    return originalHandleAction(action, id);
  };

  function rangePercent(value, min, max) {
    const low = Number.isFinite(Number(min)) ? Number(min) : 0;
    const high = Number.isFinite(Number(max)) ? Number(max) : 100;
    const current = Number.isFinite(Number(value)) ? Number(value) : low;
    if (high <= low) return 0;
    return Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  }

  function formatRangeValue(input) {
    const value = Number(input.value), max = Number(input.max || 100);
    const format = input.dataset.rangeFormat || (max === 100 ? 'percent' : 'value');
    if (format === 'percent') return `${value}%`;
    if (['rating', 'spice', 'impact'].includes(format)) return `${value} / ${max}`;
    return String(input.value);
  }

  function updateRange(input) {
    const percent = rangePercent(input.value, input.min, input.max), text = formatRangeValue(input);
    input.style.setProperty('--range-percent', `${percent}%`);
    input.setAttribute('aria-valuemin', input.min || '0');
    input.setAttribute('aria-valuemax', input.max || '100');
    input.setAttribute('aria-valuenow', input.value);
    input.setAttribute('aria-valuetext', text);
    const output = document.querySelector(`[data-range-value-for="${CSS.escape(input.id)}"]`);
    const bubble = document.querySelector(`[data-range-bubble-for="${CSS.escape(input.id)}"]`);
    if (output) output.textContent = `Current value: ${text}`;
    if (bubble) { bubble.textContent = text; bubble.style.setProperty('--range-percent', `${percent}%`); }
  }

  function enhanceRange(input) {
    if (!input || input.dataset.rangeEnhanced === 'true') return input;
    input.dataset.rangeEnhanced = 'true';
    input.classList.add('shared-range');
    if (!input.id) input.id = `range-${uid()}`;
    let shell = input.closest('.shared-range-shell');
    if (!shell) { shell = document.createElement('span'); shell.className = 'shared-range-shell'; input.before(shell); shell.append(input); }
    let output = document.querySelector(`[data-range-value-for="${CSS.escape(input.id)}"]`);
    if (!output) { output = document.createElement('output'); output.className = 'range-value'; output.dataset.rangeValueFor = input.id; shell.before(output); }
    if (!output.id) output.id = `${input.id}-value`;
    if (!(input.getAttribute('aria-describedby') || '').split(/\s+/).includes(output.id)) input.setAttribute('aria-describedby', `${input.getAttribute('aria-describedby') || ''} ${output.id}`.trim());
    let bubble = shell.querySelector(`[data-range-bubble-for="${CSS.escape(input.id)}"]`);
    if (!bubble) { bubble = document.createElement('output'); bubble.className = 'range-bubble'; bubble.dataset.rangeBubbleFor = input.id; bubble.setAttribute('aria-hidden', 'true'); shell.append(bubble); }
    const show = () => shell.classList.add('is-active'), hide = () => shell.classList.remove('is-active');
    input.addEventListener('input', () => { updateRange(input); show(); });
    input.addEventListener('change', () => updateRange(input));
    input.addEventListener('pointerdown', show);
    input.addEventListener('pointerup', hide);
    input.addEventListener('pointercancel', hide);
    input.addEventListener('blur', hide);
    input.addEventListener('keydown', () => { show(); requestAnimationFrame(() => updateRange(input)); });
    input.addEventListener('dragstart', event => event.preventDefault());
    updateRange(input);
    return input;
  }

  function enhanceRanges(root = document) { root.querySelectorAll?.('input[type="range"]').forEach(enhanceRange); }
  globalThis.RangeUI = { enhance: enhanceRanges, enhanceRange, update: updateRange, rangePercent, formatRangeValue };
  enhanceRanges();
  let viewportFrame;
  const updateVisualViewport = () => {
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(globalThis.visualViewport?.height || globalThis.innerHeight)}px`));
  };
  updateVisualViewport();
  globalThis.visualViewport?.addEventListener('resize', updateVisualViewport, { passive: true });
  globalThis.addEventListener('orientationchange', updateVisualViewport, { passive: true });
  if (!globalThis.__rangeObserver && typeof MutationObserver !== 'undefined') {
    globalThis.__rangeObserver = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) { if (node.matches?.('input[type="range"]')) enhanceRange(node); enhanceRanges(node); }
    })));
    globalThis.__rangeObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
