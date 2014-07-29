'use strict';

var format = require('util').format;

function cap(str){
  return [str.slice(0,1).toUpperCase(), str.slice(1)].join('');
}

module.exports = function(verb, relName){
  var accessorVerb = {
    get: 'get',
    post: 'set',
    delete: 'remove'
  };

  if(accessorVerb[verb]){
    return format('%s%s', accessorVerb[verb], cap(relName));  
  }
};