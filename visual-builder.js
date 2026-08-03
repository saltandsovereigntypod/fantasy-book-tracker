(() => {
  'use strict';

  /*
    Universal Visual Field Registry

    This file defines what information can be added
    to visual cards.

    The Visual Builder reads this registry and creates
    modules with dataBinding paths.

    Example:

    Title button clicked

    creates:

    {
      type: "title",
      dataBinding:{
        path:"title"
      }
    }

    The renderer then pulls:

    book.title
  */


  const BOOK_VISUAL_FIELDS = {


    identity: {

      label: "Identity",

      fields: [

        {
          id: "cover",
          label: "Cover Image",
          path: "coverUrl",
          moduleType: "image"
        },


        {
          id: "title",
          label: "Title",
          path: "title",
          moduleType: "title"
        },


        {
          id: "author",
          label: "Author",
          path: "author",
          moduleType: "metadata"
        },


        {
          id: "series",
          label: "Series",
          path: "series",
          moduleType: "metadata"
        }

      ]

    },


    tracking: {

      label: "Tracking",

      fields: [

        {
          id: "status",
          label: "Reading Status",
          path: "status",
          moduleType: "metadata"
        },


        {
          id: "progress",
          label: "Reading Progress",
          path: "progress",
          moduleType: "progress"
        }

      ]

    },


    ratings: {

      label: "Ratings",

      fields: [

        {
          id: "rating",
          label: "Overall Rating",
          path: "rating",
          moduleType: "rating"
        },


        {
          id: "spice",
          label: "Spice Rating",
          path: "spice",
          moduleType: "rating"
        },


        {
          id: "impact",
          label: "Emotional Impact",
          path: "impact",
          moduleType: "rating"
        },


        {
          id: "reaction",
          label: "Reaction",
          path: "reaction",
          moduleType: "metadata"
        }

      ]

    },


    content: {

      label: "Content",

      fields: [

        {
          id: "summary",
          label: "Summary",
          path: "summary",
          moduleType: "text"
        },


        {
          id: "about",
          label: "About This Book",
          path: "about",
          moduleType: "text"
        }

      ]

    },


    classification: {

      label: "Classification",

      fields: [

        {
          id: "genres",
          label: "Genres",
          path: "genres",
          moduleType: "tags"
        },


        {
          id: "tags",
          label: "Tags",
          path: "tags",
          moduleType: "tags"
        }

      ]

    },


    connections: {

      label: "Connections",

      fields: [

        {
          id: "dossiers",
          label: "Linked Dossiers",
          path: "linkedDossierIds",
          moduleType: "linked-dossier"
        },


        {
          id: "theories",
          label: "Linked Theories",
          path: "linkedTheoryIds",
          moduleType: "linked-theory"
        },


        {
          id: "walls",
          label: "Linked Walls",
          path: "linkedWallIds",
          moduleType: "linked-record"
        }

      ]

    },


    custom: {

      label: "Custom",

      fields: [

        {
          id: "customTrackers",
          label: "Custom Trackers",
          path: "trackerValues",
          moduleType: "custom"
        }

      ]

    }

  };



  function allVisualFields(){

    return Object
      .values(BOOK_VISUAL_FIELDS)
      .flatMap(section => section.fields);

  }



  function getVisualField(id){

    return allVisualFields()
      .find(field => field.id === id);

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
