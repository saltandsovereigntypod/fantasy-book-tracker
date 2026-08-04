import { useEffect, useMemo, useRef, useState } from 'react';
import type { DesignElement } from './domain';
import { ELEMENT_CATALOG, ELEMENT_CATEGORIES, type ElementCategory } from './elementCatalog';
import {
  listLibraryItems,
  loadFontFace,
  readFileAsDataUrl,
  removeLibraryItem,
  saveLibraryItem,
  type FontLibraryItem,
  type UploadKind,
  type UploadLibraryItem,
} from './library';

export type CreativeSection = 'text' | 'elements' | 'uploads';

interface CreativeLibrariesProps {
  section: CreativeSection;
  onAddElement: (element: DesignElement) => void;
  onFontsChange: (fonts: FontLibraryItem[]) => void;
}

function makeTextElement(): DesignElement {
  return {
    id: `element-${crypto.randomUUID()}`,
    type: 'text',
    text: 'Custom text',
    x: 110,
    y: 105,
    width: 200,
    height: 56,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 400,
    color: '#f7ead2',
    textAlign: 'center',
    lineHeight: 1.15,
  };
}

function makeUploadElement(item: UploadLibraryItem): DesignElement {
  return {
    id: `element-${crypto.randomUUID()}`,
    type: 'image',
    src: item.dataUrl,
    x: 120,
    y: 72,
    width: 180,
    height: 220,
    fit: item.kind === 'element' ? 'contain' : 'cover',
    borderRadius: item.kind === 'element' ? 0 : 12,
  };
}

function cleanName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
}

export function CreativeLibraries({ section, onAddElement, onFontsChange }: CreativeLibrariesProps) {
  const [fonts, setFonts] = useState<FontLibraryItem[]>([]);
  const [uploads, setUploads] = useState<UploadLibraryItem[]>([]);
  const [elementSearch, setElementSearch] = useState('');
  const [elementCategory, setElementCategory] = useState<'all' | ElementCategory>('all');
  const [uploadSearch, setUploadSearch] = useState('');
  const [uploadKind, setUploadKind] = useState<'all' | UploadKind>('all');
  const [message, setMessage] = useState('');
  const fontInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    Promise.all([
      listLibraryItems<FontLibraryItem>('fonts'),
      listLibraryItems<UploadLibraryItem>('uploads'),
    ]).then(async ([storedFonts, storedUploads]) => {
      await Promise.all(storedFonts.map((font) => loadFontFace(font).catch(() => undefined)));
      setFonts(storedFonts);
      setUploads(storedUploads);
      onFontsChange(storedFonts);
    }).catch(() => setMessage('The local library could not be opened.'));
  }, [onFontsChange]);

  const filteredElements = useMemo(() => {
    const query = elementSearch.trim().toLowerCase();
    return ELEMENT_CATALOG.filter((item) => {
      const categoryMatch = elementCategory === 'all' || item.category === elementCategory;
      const searchMatch = !query || `${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
  }, [elementCategory, elementSearch]);

  const filteredUploads = useMemo(() => {
    const query = uploadSearch.trim().toLowerCase();
    return uploads.filter((item) => {
      const kindMatch = uploadKind === 'all' || item.kind === uploadKind;
      const searchMatch = !query || `${item.name} ${item.fileName}`.toLowerCase().includes(query);
      return kindMatch && searchMatch;
    });
  }, [uploadKind, uploadSearch, uploads]);

  async function refreshFonts(nextFonts?: FontLibraryItem[]) {
    const items = nextFonts ?? await listLibraryItems<FontLibraryItem>('fonts');
    setFonts(items);
    onFontsChange(items);
  }

  async function uploadFont(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const added: FontLibraryItem[] = [];
    for (const file of files) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const item: FontLibraryItem = {
          id: crypto.randomUUID(),
          name: cleanName(file.name),
          family: `EmpyreanFont-${crypto.randomUUID()}`,
          fileName: file.name,
          mimeType: file.type || 'font/unknown',
          dataUrl,
          createdAt: new Date().toISOString(),
        };
        await loadFontFace(item);
        await saveLibraryItem('fonts', item);
        added.push(item);
      } catch {
        setMessage(`Could not load ${file.name}. Try a WOFF, WOFF2, TTF, or OTF file.`);
      }
    }
    await refreshFonts([...added, ...fonts]);
  }

  async function renameFont(item: FontLibraryItem) {
    const name = window.prompt('Rename font', item.name)?.trim();
    if (!name || name === item.name) return;
    const updated = { ...item, name };
    await saveLibraryItem('fonts', updated);
    await refreshFonts(fonts.map((font) => font.id === item.id ? updated : font));
  }

  async function deleteFont(item: FontLibraryItem) {
    if (!window.confirm(`Delete “${item.name}” from your font library?`)) return;
    await removeLibraryItem('fonts', item.id);
    await refreshFonts(fonts.filter((font) => font.id !== item.id));
  }

  async function uploadAssets(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const added: UploadLibraryItem[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readFileAsDataUrl(file);
      const item: UploadLibraryItem = {
        id: crypto.randomUUID(),
        name: cleanName(file.name),
        kind: file.type === 'image/png' || file.type === 'image/svg+xml' ? 'element' : 'photo',
        fileName: file.name,
        mimeType: file.type,
        dataUrl,
        createdAt: new Date().toISOString(),
      };
      await saveLibraryItem('uploads', item);
      added.push(item);
    }
    setUploads([...added, ...uploads]);
  }

  async function renameUpload(item: UploadLibraryItem) {
    const name = window.prompt('Rename upload', item.name)?.trim();
    if (!name || name === item.name) return;
    const updated = { ...item, name };
    await saveLibraryItem('uploads', updated);
    setUploads((items) => items.map((upload) => upload.id === item.id ? updated : upload));
  }

  async function changeUploadKind(item: UploadLibraryItem) {
    const updated = { ...item, kind: item.kind === 'photo' ? 'element' as const : 'photo' as const };
    await saveLibraryItem('uploads', updated);
    setUploads((items) => items.map((upload) => upload.id === item.id ? updated : upload));
  }

  async function deleteUpload(item: UploadLibraryItem) {
    if (!window.confirm(`Delete “${item.name}” from your upload library?`)) return;
    await removeLibraryItem('uploads', item.id);
    setUploads((items) => items.filter((upload) => upload.id !== item.id));
  }

  if (section === 'text') {
    return (
      <div className="creative-library">
        <button className="library-primary-action" type="button" onClick={() => onAddElement(makeTextElement())}>+ Add text box</button>
        <section className="library-section">
          <div className="library-heading"><div><h3>Custom fonts</h3><span>WOFF, WOFF2, TTF, and OTF files are stored in this browser.</span></div><button type="button" onClick={() => fontInputRef.current?.click()}>Upload fonts</button></div>
          <input ref={fontInputRef} className="visually-hidden" type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" multiple onChange={uploadFont} />
          {message && <p className="library-message">{message}</p>}
          <div className="font-library-grid">
            {fonts.map((font) => (
              <article className="font-library-card" key={font.id}>
                <div className="font-preview" style={{ fontFamily: font.family }}>Aa</div>
                <div className="library-card-copy"><strong>{font.name}</strong><small>{font.fileName}</small></div>
                <div className="library-card-actions"><button type="button" onClick={() => renameFont(font)}>Rename</button><button type="button" onClick={() => deleteFont(font)}>Delete</button></div>
              </article>
            ))}
            {!fonts.length && <p className="empty-library">No custom fonts uploaded yet.</p>}
          </div>
        </section>
      </div>
    );
  }

  if (section === 'elements') {
    return (
      <div className="creative-library">
        <div className="library-search-row"><input value={elementSearch} onChange={(event) => setElementSearch(event.target.value)} placeholder="Search elements…" /><select value={elementCategory} onChange={(event) => setElementCategory(event.target.value as 'all' | ElementCategory)}>{ELEMENT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></div>
        <div className="catalog-grid">
          {filteredElements.map((item) => <button type="button" className="catalog-card" key={item.id} onClick={() => onAddElement(item.create())}><span>{item.preview}</span><strong>{item.name}</strong><small>{item.category}</small></button>)}
        </div>
        {!filteredElements.length && <p className="empty-library">No built-in elements match that search.</p>}
      </div>
    );
  }

  return (
    <div className="creative-library">
      <div className="library-heading"><div><h3>Personal uploads</h3><span>Photos, transparent PNGs, stickers, and personal decorative elements.</span></div><button type="button" onClick={() => uploadInputRef.current?.click()}>Upload files</button></div>
      <input ref={uploadInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={uploadAssets} />
      <div className="library-search-row"><input value={uploadSearch} onChange={(event) => setUploadSearch(event.target.value)} placeholder="Search uploads…" /><select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as 'all' | UploadKind)}><option value="all">All uploads</option><option value="photo">Photos</option><option value="element">Elements</option></select></div>
      <div className="upload-library-grid">
        {filteredUploads.map((item) => (
          <article className="upload-library-card" key={item.id}>
            <button type="button" className="upload-preview" onClick={() => onAddElement(makeUploadElement(item))}><img src={item.dataUrl} alt="" /><span>Add to card</span></button>
            <div className="library-card-copy"><strong>{item.name}</strong><small>{item.kind}</small></div>
            <div className="library-card-actions"><button type="button" onClick={() => renameUpload(item)}>Rename</button><button type="button" onClick={() => changeUploadKind(item)}>{item.kind === 'photo' ? 'Make element' : 'Make photo'}</button><button type="button" onClick={() => deleteUpload(item)}>Delete</button></div>
          </article>
        ))}
      </div>
      {!filteredUploads.length && <p className="empty-library">No uploads match this view.</p>}
    </div>
  );
}
