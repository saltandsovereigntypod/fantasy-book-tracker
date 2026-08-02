(() => {
  'use strict';

  const BOOK_VISUAL_FIELDS = {

    identity: {
      label: "Identity",
      fields: [
        {
          id: "title",
          label: "Title",
          path: "title",
          type: "text",
          moduleType: "title"
        },
        {
          id: "author",
          label: "Author",
          path: "author",
          type: "text",
          moduleType: "metadata"
        },
        {
          id: "series",
          label: "Series",
          path: "series",
          type: "text",
          moduleType: "metadata"
        },
        {
          id: "cover",
          label: "Cover Image",
          path: "coverUrl",
          type: "image",
          moduleType: "image"
        }
      ]
    },


    classification: {
      label: "Classification",
      fields: [
        {
          id:"genres",
          label:"Genres",
          path:"genres",
          type:"tags",
          moduleType:"tags"
        },
        {
          id:"tags",
          label:"Tags",
          path:"tags",
          type:"tags",
          moduleType:"tags"
        }
      ]
    },


    tracking:{
      label:"Tracking",
      fields:[
        {
          id:"status",
          label:"Reading Status",
          path:"status",
          type:"text",
          moduleType:"metadata"
        },
        {
          id:"progress",
          label:"Progress",
          path:"progress",
          type:"progress",
          moduleType:"progress"
        }
      ]
    },


    ratings:{
      label:"Ratings",
      fields:[
        {
          id:"rating",
          label:"Overall Rating",
          path:"ratings.overall",
          type:"rating",
          moduleType:"rating"
        },
        {
          id:"spice",
          label:"Spice Rating",
          path:"ratings.spice",
          type:"rating",
          moduleType:"rating"
        },
        {
          id:"impact",
          label:"Emotional Impact",
          path:"ratings.impact",
          type:"rating",
          moduleType:"rating"
        },
        {
          id:"reaction",
          label:"Reaction",
          path:"ratings.reaction",
          type:"text",
          moduleType:"metadata"
        }
      ]
    },


    content:{
      label:"Content",
      fields:[
        {
          id:"summary",
          label:"Summary",
          path:"summary",
          type:"longText",
          moduleType:"text"
        },
        {
          id:"about",
          label:"About This Book",
          path:"about",
          type:"longText",
          moduleType:"text"
        }
      ]
    },


    archive:{
      label:"Archive",
      fields:[
        {
          id:"notes",
          label:"Notes",
          path:"notes",
          type:"notes",
          moduleType:"notes"
        },
        {
          id:"images",
          label:"Additional Images",
          path:"images",
          type:"gallery",
          moduleType:"uploaded-image"
        }
      ]
    },


    connections:{
      label:"Connections",
      fields:[
        {
          id:"dossiers",
          label:"Linked Dossiers",
          path:"linkedDossierIds",
          type:"linked",
          moduleType:"linked-dossier"
        },
        {
          id:"theories",
          label:"Linked Theories",
          path:"linkedTheoryIds",
          type:"linked",
          moduleType:"linked-theory"
        },
        {
          id:"walls",
          label:"Linked Walls",
          path:"linkedWallIds",
          type:"linked-record"
        }
      ]
    },


    custom:{
      label:"Custom",
      fields:[
        {
          id:"trackers",
          label:"Custom Trackers",
          path:"trackerValues",
          type:"tracker",
          moduleType:"custom"
        }
      ]
    }

  };


  function allVisualFields(){
    return Object.values(BOOK_VISUAL_FIELDS)
      .flatMap(section => section.fields);
  }


  function getVisualField(id){
    return allVisualFields().find(field => field.id === id);
  }


  function fieldSections(){
    return BOOK_VISUAL_FIELDS;
  }


  globalThis.VisualFields = {
    BOOK_VISUAL_FIELDS,
    allVisualFields,
    getVisualField,
    fieldSections
  };

})();
