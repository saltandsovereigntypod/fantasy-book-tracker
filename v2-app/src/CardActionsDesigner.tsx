import type { CardAction, CardActionType, CardDesign, CardSize } from './domain';
import { CARD_WIDTHS } from './domain';
import './card-actions.css';

const ACTION_OPTIONS: Array<{ action: CardActionType; label: string; icon: string; variant: CardAction['variant'] }> = [
  { action: 'profile', label: 'Profile', icon: '◫', variant: 'primary' },
  { action: 'edit', label: 'Edit', icon: '✦', variant: 'secondary' },
  { action: 'favorite', label: 'Favorite', icon: '☆', variant: 'ghost' },
  { action: 'progress', label: 'Update Progress', icon: '↗', variant: 'secondary' },
  { action: 'add-note', label: 'Add Note', icon: '+', variant: 'secondary' },
  { action: 'start-reading', label: 'Start Reading', icon: '▶', variant: 'primary' },
  { action: 'finish-reading', label: 'Finish Reading', icon: '✓', variant: 'primary' },
  { action: 'archive', label: 'Archive', icon: '◇', variant: 'ghost' },
  { action: 'delete', label: 'Delete', icon: '×', variant: 'danger' },
];

function newAction(action: CardActionType, index: number): CardAction {
  const option = ACTION_OPTIONS.find((item) => item.action === action) ?? ACTION_OPTIONS[0];
  const danger = option.variant === 'danger';
  const primary = option.variant === 'primary';
  return {
    id: `action-${crypto.randomUUID()}`, action, label: option.label, icon: option.icon, variant: option.variant,
    x: 18 + (index % 3) * 126, y: 346 - Math.floor(index / 3) * 34, width: 112, height: 28,
    background: danger ? '#351411' : primary ? '#a64f24' : option.variant === 'ghost' ? 'transparent' : '#2b160d',
    color: danger ? '#ffd0c9' : '#f7ead2', borderColor: danger ? '#7f352f' : primary ? '#d0783c' : '#75451f',
    borderRadius: 9, fontFamily: 'Inter', fontSize: 12, fontWeight: 700, textAlign: 'center', visibleOn: ['small', 'medium', 'large'],
  };
}

export function CardActionsPreview({ actions, size, interactive = false, onAction }: { actions: CardAction[] | undefined; size: CardSize; interactive?: boolean; onAction?: (action: CardAction) => void }) {
  const visible = (actions ?? []).filter((action) => action.visibleOn.includes(size));
  if (!visible.length) return null;
  const scale = CARD_WIDTHS[size] / 420;
  return <div className="v2-runtime-actions v2-runtime-actions--overlay" aria-label="Card actions">
    {visible.map((action) => <button
      key={action.id} type="button" disabled={!interactive} data-action-type={action.action}
      onClick={(event) => { event.stopPropagation(); if (interactive) onAction?.(action); }}
      style={{
        left: action.x * scale, top: action.y * scale, width: action.width * scale, height: action.height * scale,
        background: action.background, color: action.color, border: `${Math.max(1, scale)}px solid ${action.borderColor}`,
        borderRadius: action.borderRadius * scale, fontFamily: action.fontFamily, fontSize: action.fontSize * scale,
        fontWeight: action.fontWeight, textAlign: action.textAlign, padding: `${4 * scale}px ${7 * scale}px`,
      }}
    >{action.icon && <span aria-hidden="true">{action.icon}</span>}{action.label}</button>)}
  </div>;
}

export function CardActionsDesigner({ design, onChange }: { design: CardDesign; onChange: (actions: CardAction[]) => void }) {
  const actions = design.actions ?? [];
  function update(id: string, changes: Partial<CardAction>) { onChange(actions.map((action) => action.id === id ? { ...action, ...changes } : action)); }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= actions.length) return; const next = [...actions]; [next[index], next[target]] = [next[target], next[index]]; onChange(next); }
  function toggleSize(action: CardAction, size: CardSize) { update(action.id, { visibleOn: action.visibleOn.includes(size) ? action.visibleOn.filter((item) => item !== size) : [...action.visibleOn, size] }); }

  return <div className="card-actions-designer">
    <section className="card-actions-add"><h3>Add an action</h3><div>{ACTION_OPTIONS.map((option) => <button key={option.action} type="button" disabled={actions.some((item) => item.action === option.action)} onClick={() => onChange([...actions, newAction(option.action, actions.length)])}><span>{option.icon}</span>{option.label}</button>)}</div></section>
    <section className="card-actions-list"><h3>On-card actions</h3>{!actions.length && <p>No actions are placed on this card.</p>}{actions.map((action, index) => <article key={action.id}>
      <header><strong>{action.icon} {action.label}</strong><div><button type="button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={index === actions.length - 1} onClick={() => move(index, 1)}>↓</button><button className="is-danger" type="button" onClick={() => onChange(actions.filter((item) => item.id !== action.id))}>Remove</button></div></header>
      <div className="card-action-fields">
        <label>Label<input value={action.label} onChange={(event) => update(action.id, { label: event.target.value })} /></label>
        <label>Icon<input value={action.icon ?? ''} maxLength={4} onChange={(event) => update(action.id, { icon: event.target.value })} /></label>
        <label>X<input type="number" value={action.x} onChange={(event) => update(action.id, { x: Number(event.target.value) || 0 })} /></label>
        <label>Y<input type="number" value={action.y} onChange={(event) => update(action.id, { y: Number(event.target.value) || 0 })} /></label>
        <label>Width<input type="number" min="24" value={action.width} onChange={(event) => update(action.id, { width: Math.max(24, Number(event.target.value) || 24) })} /></label>
        <label>Height<input type="number" min="18" value={action.height} onChange={(event) => update(action.id, { height: Math.max(18, Number(event.target.value) || 18) })} /></label>
        <label>Font<select value={action.fontFamily} onChange={(event) => update(action.id, { fontFamily: event.target.value })}><option>Inter</option><option>Libre Baskerville</option><option>Georgia</option><option>Arial</option><option>Trebuchet MS</option><option>Courier New</option></select></label>
        <label>Font size<input type="number" min="8" max="48" value={action.fontSize} onChange={(event) => update(action.id, { fontSize: Number(event.target.value) || 12 })} /></label>
        <label>Font weight<select value={action.fontWeight} onChange={(event) => update(action.id, { fontWeight: Number(event.target.value) })}><option value="400">Regular</option><option value="600">Semi-bold</option><option value="700">Bold</option><option value="800">Extra bold</option></select></label>
        <label>Alignment<select value={action.textAlign} onChange={(event) => update(action.id, { textAlign: event.target.value as CardAction['textAlign'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label>Background<input type="color" value={action.background === 'transparent' ? '#100906' : action.background} onChange={(event) => update(action.id, { background: event.target.value })} /></label>
        <label>Text<input type="color" value={action.color} onChange={(event) => update(action.id, { color: event.target.value })} /></label>
        <label>Border<input type="color" value={action.borderColor} onChange={(event) => update(action.id, { borderColor: event.target.value })} /></label>
        <label>Radius<input type="number" min="0" max="999" value={action.borderRadius} onChange={(event) => update(action.id, { borderRadius: Number(event.target.value) || 0 })} /></label>
      </div>
      <div className="card-action-sizes"><span>Visible on</span>{(['small', 'medium', 'large'] as CardSize[]).map((size) => <button key={size} type="button" className={action.visibleOn.includes(size) ? 'is-active' : ''} onClick={() => toggleSize(action, size)}>{size}</button>)}</div>
    </article>)}</section>
  </div>;
}
