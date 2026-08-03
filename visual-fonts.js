(() => {
  'use strict';
  const LIMIT = 5 * 1024 * 1024, loaded = new Map(), EXT = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
  const allowedMime = new Set(['font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'application/font-woff', 'application/x-font-ttf', 'application/x-font-opentype', 'application/octet-stream', '']);
  const clean = value => String(value || 'Custom Font').trim().replace(/[<>"'`]/g, '').slice(0, 160) || 'Custom Font';
  const debug = (label, payload) => console.debug?.(`[VisualFonts] ${label}`, payload);
  const fail = (label, error, context = {}) => {
    console.error(`[VisualFonts] ${label}`, { ...context, error });
    throw new Error(`${label}: ${error?.message || error}`);
  };
  async function validate(file) {
    try {
      const extension = String(file?.name || '').split('.').pop().toLowerCase();
      if (!EXT[extension] || !allowedMime.has(file.type || '')) throw new Error('Choose a WOFF2, WOFF, TTF, or OTF font.');
      if (!file.size || file.size > LIMIT) throw new Error('Fonts must be smaller than 5 MB.');
      const data = new Uint8Array(await file.slice(0, 4).arrayBuffer()), tag = String.fromCharCode(...data);
      if (!(['wOF2', 'wOFF', 'OTTO'].includes(tag) || (data[0] === 0 && data[1] === 1 && data[2] === 0 && data[3] === 0))) throw new Error('The font signature is not supported.');
      return { extension, fontFormat: EXT[extension] };
    } catch (error) {
      fail('Font validation failed', error, { fileName: file?.name, fileType: file?.type, fileSize: file?.size });
    }
  }
  const cloud = () => globalThis.VisualCloud;
  async function listFonts() {
    try {
      debug('Listing custom fonts');
      return await (cloud()?.list?.('custom_fonts') || []);
    } catch (error) {
      fail('Font library refresh failed', error);
    }
  }
  async function getFontUrl(font) {
    try {
      return font?.storage_path ? await cloud()?.signedUrl?.('custom-fonts', font.storage_path) : '';
    } catch (error) {
      fail('Font signed URL failed', error, { id: font?.id, storagePath: font?.storage_path });
    }
  }
  async function uploadFont(file, metadata = {}) {
    if (!metadata.licenseConfirmed) throw new Error('Confirm that you own this font or have permission to use it.');
    const valid = await validate(file);
    if (!cloud()?.isSignedIn?.()) throw new Error('Sign in to upload reusable fonts.');
    const id = crypto.randomUUID(), familyName = `UserFont_${id.replaceAll('-', '')}`;
    try {
      debug('Uploading custom font', { fileName: file.name, displayName: metadata.displayName });
      return await cloud().uploadLibraryFile({
        table: 'custom_fonts',
        bucket: 'custom-fonts',
        file,
        id,
        name: clean(metadata.displayName || file.name.replace(/\.[^.]+$/, '')),
        onStatus: message => metadata.onStatus?.(message === 'Saving library record…' ? 'Saving font record…' : message),
        record: { display_name: clean(metadata.displayName || file.name), family_name: familyName, mime_type: file.type || `font/${valid.extension}`, file_size: file.size, font_format: valid.fontFormat, font_weight: Number(metadata.fontWeight) || 400, font_style: metadata.fontStyle === 'italic' ? 'italic' : 'normal', metadata: { license_confirmed_at: new Date().toISOString() } }
      });
    } catch (error) {
      fail('Font upload failed', error, { fileName: file?.name, displayName: metadata.displayName });
    }
  }
  async function loadFont(font) {
    if (!font) return null;
    if (loaded.has(font.id)) return loaded.get(font.id);
    const task = (async () => {
      try {
        if (!globalThis.FontFace || !document?.fonts) throw new Error('Custom fonts are not supported in this browser.');
        const url = await getFontUrl(font);
        if (!url) throw new Error('The font file is unavailable.');
        const face = new FontFace(font.family_name, `url("${url}")`, { weight: String(font.font_weight || 400), style: font.font_style || 'normal' });
        await face.load();
        document.fonts.add(face);
        return face;
      } catch (error) {
        fail('FontFace load failed', error, { id: font?.id, familyName: font?.family_name });
      }
    })();
    loaded.set(font.id, task);
    try { return await task; } catch (error) { loaded.delete(font.id); throw error; }
  }
  async function loadAllUserFonts() { const fonts = await listFonts(); return Promise.allSettled(fonts.map(loadFont)); }
  const deleteFont = async id => {
    try { return await cloud()?.deleteLibraryRecord?.('custom_fonts', 'custom-fonts', id); }
    catch (error) { fail('Font delete failed', error, { id }); }
  };
  const renameFont = async (id, name) => {
    try { return await cloud()?.renameLibraryRecord?.('custom_fonts', id, clean(name), 'display_name'); }
    catch (error) { fail('Font rename failed', error, { id, name }); }
  };
  const refreshFontLibrary = listFonts;
  globalThis.VisualFonts = { LIMIT, validate, listFonts, uploadFont, loadFont, loadAllUserFonts, deleteFont, renameFont, refreshFontLibrary, getFontUrl };
})();
