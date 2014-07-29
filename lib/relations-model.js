'use strict';

module.exports = function(db){
  db.define('_hal', )
}


module.exports = {
  baseType: {type: 'text', mapsTo: 'base_type'},
  baseID: {type: 'number', mapsTo: 'base_id'},
  relationName: {type: 'text', mapsTo: 'relation_name'},
  relatedType: {type: 'text', mapsTo: 'related_type'},
  relatedID: {type: 'number', mapsTo: 'related_id'}
};