(() => {
  'use strict';
  const LIMIT=8*1024*1024,urlCache=new Map(), TYPES={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
  const bytes=file=>file.slice(0,16).arrayBuffer().then(value=>new Uint8Array(value));
  const signature=(data,type)=>type==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v)||type==='image/jpeg'&&data[0]===255&&data[1]===216&&data[2]===255||type==='image/webp'&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP';
  async function validate(file){const ext=String(file?.name||'').split('.').pop().toLowerCase(),expected=TYPES[ext];if(!expected||file.type!==expected)throw new Error('Choose a PNG, JPG, or WebP image.');if(!file.size||file.size>LIMIT)throw new Error('Images must be smaller than 8 MB.');if(!signature(await bytes(file),expected))throw new Error('The image signature does not match its format.');return{mimeType:expected,extension:ext};}
  const cloud=()=>globalThis.VisualCloud;
  async function listAssets(){const items=await (cloud()?.list?.('visual_assets')||[]);await Promise.allSettled(items.map(item=>getAssetUrl(item)));return items;}
  async function getAssetUrl(asset){if(asset?.url&&!asset.storage_path)return asset.url;if(!asset?.storage_path)return'';const cached=urlCache.get(asset.id);if(cached&&cached.expiresAt>Date.now())return cached.url;const url=await (cloud()?.signedUrl?.('visual-assets',asset.storage_path)||'');if(url)urlCache.set(asset.id,{url,expiresAt:Date.now()+55*60*1000});return url;}
  async function uploadAsset(file,options={}){const valid=await validate(file);if(!cloud()?.isSignedIn?.())throw new Error('Sign in to upload reusable elements.');const dimensions=await new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve({width:image.naturalWidth,height:image.naturalHeight});};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('The image could not be decoded.'));};image.src=url;});return cloud().uploadLibraryFile({table:'visual_assets',bucket:'visual-assets',file,name:options.name||file.name,record:{asset_type:options.assetType||'element',category:options.category||'element',mime_type:valid.mimeType,file_size:file.size,...dimensions,metadata:{transparent:valid.extension==='png'}}});}
  const deleteAsset=async id=>{const result=await cloud()?.deleteLibraryRecord?.('visual_assets','visual-assets',id);urlCache.delete(id);return result;};
  const renameAsset=(id,name)=>cloud()?.renameLibraryRecord?.('visual_assets',id,name,'name');
  const refreshAssetLibrary=listAssets;
  globalThis.VisualAssets={LIMIT,validate,peekAssetUrl:id=>urlCache.get(id)?.url||'',listAssets,uploadAsset,deleteAsset,renameAsset,getAssetUrl,refreshAssetLibrary,revokeTemporaryUrls() {}};
})();
