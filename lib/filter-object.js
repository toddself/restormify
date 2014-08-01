'use strict';

/**
 * Enumerate through the response object to strip out all values that are marked
 * `serverOnly` as to not leak details to the client
 * @method  filterObj
 * @private
 * @param   {object} modelProps node-orm's model property
 * @param   {object} obj response from orm call
 * @returns {object} filtered object with all `serverOnly` fields removed
 */
module.exports = function(modelProps, obj){
  var returnObj = {};
  Object.keys(modelProps).forEach(function(key){
    if(key === 'deleted' && obj[key] === true){
      return;
    }

    if(!modelProps[key].serverOnly){
      returnObj[key] = obj[key];
    }
  });
  return returnObj;
}
