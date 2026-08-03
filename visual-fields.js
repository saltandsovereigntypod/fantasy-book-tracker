(() => {
  'use strict';
  const fields=[
    ['identity','coverUrl','Cover Image','image'],['identity','title','Title','title'],['identity','author','Author','metadata'],['identity','series','Series','metadata'],
    ['tracking','status','Reading Status','metadata'],['tracking','progress','Reading Progress','progress'],
    ['ratings','rating','Overall Rating','rating'],['ratings','spice','Spice Rating','rating'],['ratings','impact','Emotional Impact','rating'],['ratings','reaction','Reaction','metadata'],
    ['content','summary','Summary','text'],['content','about','About This Book','text'],
    ['classification','genres','Genres','tags'],['classification','tags','Tags','tags'],
    ['connections','linkedDossierIds','Linked Dossiers','linked-dossier'],['connections','linkedTheoryIds','Linked Theories','linked-theory'],['connections','linkedWallIds','Linked Walls','linked-record'],
    ['custom','trackerValues','Custom Trackers','counter']
  ].map(([category,path,label,moduleType])=>Object.freeze({category,path,label,moduleType}));
  globalThis.VisualFields={fields:Object.freeze(fields),list:(category='')=>fields.filter(field=>!category||field.category===category),categories:()=>[...new Set(fields.map(field=>field.category))],get:path=>fields.find(field=>field.path===path)||null};
})();
