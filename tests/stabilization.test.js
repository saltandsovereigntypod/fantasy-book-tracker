const assert=require('assert');
const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const bridge=fs.readFileSync('supabase-bridge.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const wall=fs.readFileSync('infinite-wall.js','utf8');
const mind=fs.readFileSync('mind-map.js','utf8');
const supabaseCss=fs.readFileSync('supabase.css','utf8');
const dossierCss=fs.readFileSync('dossier-experience.css','utf8');

// Authentication starts behind a hydration gate, never with the sign-in dialog visible.
assert.match(index,/<body class="auth-hydrating">/);
assert.match(index,/id="authHydration"/);
assert.match(index,/<div class="modal-backdrop" id="authModal" aria-hidden="true">/);
assert.doesNotMatch(index,/modal-backdrop is-open" id="authModal/);
assert.match(bridge,/await supabase\.auth\.getSession\(\)/);
assert.match(bridge,/if \(session\?\.user\)/);
assert.match(bridge,/else \{ finishHydration\(\); openAuth\(\); \}/);
assert.match(supabaseCss,/body\.auth-hydrating \.auth-hydration\{display:grid\}/);

// Location/filter state is local and restored without cloud save traffic.
assert.match(app,/UI_LOCATION_KEY/);
assert.match(app,/activeView=.*restoredUiLocation\.activeView/);
assert.match(app,/restoredUiLocation\.activeWallId/);
assert.match(wall,/WALL_FILTER_KEY/);
assert.match(mind,/MIND_UI_KEY/);
assert.match(mind,/selectedId/);

// Legacy migration cannot add Bodhi (or any dossier) twice on one wall.
assert.match(wall,/!appearanceOnWall\(dossier\.id,targetWallId\)/);
assert.match(wall,/skipped duplicate legacy appearance/);
assert.match(wall,/duplicateAppearanceGroups/);
assert.match(wall,/intentionalDuplicate/);

// Destructive book operations only exist inside the editor.
const cardStart=app.indexOf('function bookCard');
const cardEnd=app.indexOf('function renderSession',cardStart);
const cardSource=app.slice(cardStart,cardEnd);
assert.doesNotMatch(cardSource,/delete-book|>Delete</);
assert.match(app,/Remove From Library/);
assert.match(app,/Delete Permanently/);
assert.match(app,/if\(!confirm\(`Permanently delete/);
assert.match(app,/removedFromLibrary=true/);
assert.match(app,/state\.sessions=state\.sessions\.filter/);
assert.match(dossierCss,/\.book-delete-zone/);
assert.match(dossierCss,/var\(--ui-danger\)/);

for(const label of ['Recently Added','Recently Updated','Title A–Z','Title Z–A','Author A–Z','Series Order','Highest Rated','Lowest Rated','Highest Emotional Impact','Highest Spice','Completion Percentage','Date Started','Date Completed'])assert.ok(app.includes(label),label);
for(const label of ['None','Series','Author','Status','Genre','Rating','Reading Year','Favorites','Currently Reading','Completed'])assert.ok(app.includes(`'${label}'`),label);
assert.match(app,/layout:\{comfortable:'cards',compact:'list'/);

for(const label of ['Archive · everything','Series · any logged series','Book · any logged book','Author · any logged author','Custom · selected dossiers'])assert.ok(mind.includes(label),label);
assert.match(mind,/id="mindAuthor"/);
assert.match(mind,/settings\.scope==='author'/);
assert.match(mind,/settings\.scope==='custom'/);
assert.match(mind,/state\.books\.map\(book=>String\(book\.author/);

assert.match(index,/20260802-37/);
assert.match(bridge,/ASSET_VERSION = '20260802-37'/);
assert.match(bridge,/\['app\.js', 'hotfix\.js', 'runtime-patches\.js', 'investigation-features\.js', 'infinite-wall\.js', 'mind-map\.js', 'dossier-experience\.js', 'visual-fields\.js', 'visual-assets\.js', 'visual-fonts\.js', 'canvas-editor\.js', 'visual-builder\.js'\]/);
console.log('authentication and archive stabilization assertions passed');
