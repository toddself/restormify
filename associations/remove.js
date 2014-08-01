'use strict';

var restify = require('restify');
var async = require('async');
var isEmpty = require('lodash.isempty');

module.exports = function(opts){
  var log = opts.logger.child({method: 'delete relation'});
  return function(resourceName, resourceId, assocType, assocId, assocBody, cb){
    opts.db.models[resourceName].get(resourceId, function(err){
      if(err){
        if(err.literalCode === 'NOT_FOUND'){
          log.info('Could not find base resource %s/%s', resourceName, resourceId);
          return cb(new restify.ResourceNotFoundError());
        } else {
          log.error('Could not get base resource %s/%s', resourceName, resourceId, err);
          return cb(new restify.InternalError());
        }
      }

      var query = {
        relationName: assocType,
        relatedId: assocId,
        baseType: resourceName,
        baseId: resourceId
      };

      opts.db.models.associations.find(query, function(err, associations){
        if(err){
          log.error('Could not get association data', err);
          return cb(new restify.InternalError());
        }

        if(isEmpty(associations)){
          log.info('Trying to delete a non-existing association', query);
          return cb(new restify.ResourceNotFoundError());
        }

        async.map(associations, function(assoc, done){
          assoc.remove(done);
        }, function(err){
          if(err){
            log.error('Could not drop relation');
            return cb(new restify.InternalError());  
          }
          cb(200, 'OK');
        });
      });
    });
  };
};