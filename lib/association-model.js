'use strict';

module.exports = function(db){
  var associations = db.define('associations', {
    baseType: {type: 'text', mapsTo: 'base_type'},
    baseId: {type: 'number', mapsTo: 'base_id'},
    relationName: {type: 'text', mapsTo: 'relation_name'},
    relatedType: {type: 'text', mapsTo: 'related_type'},
    relatedId: {type: 'number', mapsTo: 'related_id'}
  });

  return associations;
};