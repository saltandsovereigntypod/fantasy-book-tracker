import type { CardAction, CardActionType, CardDesign, CardSize } from './domain';
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

function newAction(action: CardActionType): CardAction {
  const option = ACTION_OPTIONS.find((item) => item.action === action) ?? ACTION_OPTIONS[0];
  const danger = option.variant === 'danger';
  const primary = option.variant === 'primary';
  return {
    id: `action-${crypto.randomUUID()}`,
    action,
    label: option.label,
    icon: option.icon,
    variant: option.variant,
    background: danger ? '#351411' : primary ? '#a64f24' : option.variant === 'ghost' ? 'transparent' : '#2b160d',
    color: danger ? '#ffd0c9' : '#f7ead2',
    borderColor: danger ? '#7f352f' : primary ? '#d0783c' : '#75451f',
    borderRadius: 9,
    fontSize: 14,
    visibleOn: ['small', 'medium', 'large'],
  };
}

export function CardActionsDesigner({ design, onChange }: { design: CardDesign; onChange: (actions: CardAction[]) => void }) {
  const actions = design.actions ?? [];

  function update(id: string, changes: Partial<CardAction>) {
    onChange(actions.map((action) => action.id === id ? { ...action, ...changes } : action));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function toggleSize(action: CardAction, size: CardSize) {
    const visibleOn = action.visibleOn.includes(size) ? action.visibleOn.filter((item) => item !== size) : [...action.visibleOn, size];
    update(action.id, { visibleOn });
  }

  return <div className="card-actions-designer">
    <section className="card-actions-add">
      <h3>Add an action</h3>
      <div>{ACTION_OPTIONS.map((option) => <button key={option.action} type="button" disabled={actions.some((item) => item.action === option.action)} onClick={() => onChange([...actions, newAction(option.action)])}><span>{option.icon}</span>{option.label}</button>)}</div>
    </section>

    <section className="card-actions-list">
      <h3>Card actions</h3>
      {!actions.length && <p>No actions are shown beneath this card. Add one above.</p>}
      {actions.map((action, index) => <article key={action.id}>
        <header><strong>{action.icon} {action.label}</strong><div><button type="button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={index === actions.length - 1} onClick={() => move(index, 1)}>↓</button><button className="is-danger" type="button" onClick={() => onChange(actions.filter((item) => item.id !== action.id))}>Remove</button></div></header>
        <div className="card-action-fields">
          <label>Label<input value={action.label} onChange={(event) => update(action.id, { label: event.target.value })} /></label>
          <label>Icon<input value={action.icon ?? ''} maxLength={4} onChange={(event) => update(action.id, { icon: event.target.value })} /></label>
          <label>Style<select value={action.variant} onChange={(event) => update(action.id, { variant: event.target.value as CardAction['variant'] })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="ghost">Ghost</option><option value="danger">Danger</option></select></label>
          <label>Font size<input type="number" min="10" max="28" value={action.fontSize} onChange={(event) => update(action.id, { fontSize: Number(event.target.value) || 14 })} /></label>
          <label>Background<input type="color" value={action.background === 'transparent' ? '#100906' : action.background} onChange={(event) => update(action.id, { background: event.target.value })} /></label>
          <label>Text<input type="color" value={action.color} onChange={(event) => update(action.id, { color: event.target.value })} /></label>
          <label>Border<input type="color" value={action.borderColor} onChange={(event) => update(action.id, { borderColor: event.target.value })} /></label>
          <label>Radius<input type="number" min="0" max="999" value={action.borderRadius} onChange={(event) => update(action.id, { borderRadius: Number(event.target.value) || 0 })} /></label>
        </div>
        <div className="card-action-sizes"><span>Visible on</span>{(['small', 'medium', 'large'] as CardSize[]).map((size) => <button key={size} type="button" className={action.visibleOn.includes(size) ? 'is-active' : ''} onClick={() => toggleSize(action, size)}>{size}</button>)}</div>
      </article>)}
    </section>
  </div>;
}
