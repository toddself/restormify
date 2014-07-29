'use strict';

var restify = require('restify');
var isEmpty = require('lodash.isempty');

var getRelMethod = require('../lib/get-relation-accessor');
    

module.exports = function(resource, resourceName, resourceId, relationName, relationId, log, cb){
  var relAccessor = getRelMethod('get', relationName);

  if(!resource[relAccessor]){
    log.info('Trying to access a non-existing relationship', resourceName, relationName, relAccessor);
    return cb(new resource.ResourceNotFoundError());
  }
  
  resource[relAccessor](function(err, relations){
    if(err){
      log.error('Unable to access a list of relations that should exist', resourceName, resourceId, relationName);
      return cb(new restify.InternalError());
    }

    if(relationId){
      relations = relations.filter(function(rel){
        return rel.id === relationId;
      })[0];

      if(isEmpty(relations)){
        log.info('%s did not exist within the dataset for %s/%s/%s', relationId, resourceName, resourceId, relationName);
        return cb(new restify.ResourceNotFoundError());
      }
    }
    return cb(200, relations);
  });
};