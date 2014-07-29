'use strict';

module.exports = function(relName, db){
  return db.models[relName] || db.models[relName.slice(1)] || undefined;
};