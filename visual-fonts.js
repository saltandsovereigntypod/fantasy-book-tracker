(() => {
  'use strict';
  const LIMIT=5*1024*1024, loaded=new Map(), EXT={woff2:'woff2',woff:'woff',ttf:'truetype',otf:'opentype'};
  const allowedMime=new Set(['font/woff2','font/woff','font/ttf','font/otf','application/font-woff','application/x-font-ttf','application/x-font-opentype','application/octet-stream']);
  const clean=value=>String(value||'Custom Font').trim().replace(/[<>"'`]/g,'').slice(0,160)||'Custom Font';
  async function validate(file){const extension=String(file?.name||'').split('.').pop().toLowerCase();if(!EXT[extension]||!allowedMime.has(file.type))throw new Error('Choose a WOFF2, WOFF, TTF, or OTF font.');if(!file.size||file.size>LIMIT)throw new Error('Fonts must be smaller than 5 MB.');const data=new Uint8Array(await file.slice(0,4).arrayBuffer()),tag=String.fromCharCode(...data);if(!(['wOF2','wOFF','OTTO'].includes(tag)||(data[0]===0&&data[1]===1&&data[2]===0&&data[3]===0)))throw new Error('The font signature is not supported.');return{extension,fontFormat:EXT[extension]};}
  const cloud=()=>globalThis.VisualCloud;
  async function listFonts(){return cloud()?.list?.('custom_fonts')||[];}
  async function getFontUrl(font){return font?.storage_path?cloud()?.signedUrl?.('custom-fonts',font.storage_path):'';}
  async function uploadFont(file,metadata={}){if(!metadata.licenseConfirmed)throw new Error('Confirm that you own this font or have permission to use it.');const valid=await validate(file);if(!cloud()?.isSignedIn?.())throw new Error('Sign in to upload reusable fonts.');const id=crypto.randomUUID(),familyName=`UserFont_${id.replaceAll('-','')}`;return cloud().uploadLibraryFile({table:'custom_fonts',bucket:'custom-fonts',file,id,name:clean(metadata.displayName||file.name.replace(/\.[^.]+$/,'')),record:{display_name:clean(metadata.displayName||file.name),family_name:familyName,mime_type:file.type,file_size:file.size,font_format:valid.fontFormat,font_weight:Number(metadata.fontWeight)||400,font_style:metadata.fontStyle==='italic'?'italic':'normal',metadata:{license_confirmed_at:new Date().toISOString()}}});}
  async function loadFont(font){if(!font)return null;if(loaded.has(font.id))return loaded.get(font.id);const task=(async()=>{if(!globalThis.FontFace||!document?.fonts)throw new Error('Custom fonts are not supported in this browser.');const url=await getFontUrl(font);if(!url)throw new Error('The font file is unavailable.');const face=new FontFace(font.family_name,`url("${url}")`,{weight:String(font.font_weight||400),style:font.font_style||'normal'});await face.load();document.fonts.add(face);return face;})();loaded.set(font.id,task);try{return await task;}catch(error){loaded.delete(font.id);throw error;}}
  async function loadAllUserFonts(){const fonts=await listFonts();return Promise.allSettled(fonts.map(loadFont));}
  const deleteFont=id=>cloud()?.deleteLibraryRecord?.('custom_fonts','custom-fonts',id);
  const renameFont=(id,name)=>cloud()?.renameLibraryRecord?.('custom_fonts',id,clean(name),'display_name');
  const refreshFontLibrary=listFonts;
  globalThis.VisualFonts={LIMIT,validate,listFonts,uploadFont,loadFont,loadAllUserFonts,deleteFont,renameFont,refreshFontLibrary,getFontUrl};
})();
