'use strict';

var restify = require('restify');

var getRelMethod = require('../lib/get-relation-accessor');
var getModelFromRelName = require('../lib/model-from-relation');
    

module.exports = function(resource, resourceName, resourceId, relationName, relationId, opts, cb){
  var relAccessor = getRelMethod('remove', relationName);
  var relatedModel = getModelFromRelName(relationName, opts.db);

  if(!resource[relAccessor] || !relatedModel){
    opts.log.info('Trying to access a non-existing relationship', resourceName, relationName, relAccessor);
    return cb(new restify.ResourceNotFoundError());
  }

  if(relationId){
    relatedModel.get(relationId, function(err, related){
      if(err){
        opts.log.error('Unable to get related model', relationName, relationId);
        return cb(new restify.InternalError());
      }
      resource[relAccessor](related, function(err){
        if(err){
          opts.log.error('Unable to disassociate relation from model', relationName, relationId, resourceName, resourceId);
          return cb(new restify.InternalError());
        }
        return cb(200, 'OK');
      });
    });
  } 

  opts.log.info('No relation id given to remove');
  cb(new restify.ResourceNotFoundError());
};