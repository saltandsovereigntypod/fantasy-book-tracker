(() => {
  'use strict';
  const fields=[['title','Title'],['author','Author'],['series','Series'],['status','Status'],['progress','Progress'],['rating','Overall rating'],['spice','Spice'],['impact','Emotional impact'],['summary','Summary'],['about','About'],['tags','Tags'],['$actions','Actions']].map(([path,label])=>({path,label}));
  globalThis.VisualFields={fields,list:()=>fields.slice(),get:path=>fields.find(field=>field.path===path)||null};
})();
