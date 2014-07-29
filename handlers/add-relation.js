'use strict';

var restify = require('restify');

var getRelMethod = require('../lib/get-relation-accessor');
var getModelFromRelName = require('../lib/model-from-relation');
var filterObj = require('../lib/filter-object');
    

module.exports = function(resource, resourceName, relationName, relationContent, opts, cb){
  var relAccessor = getRelMethod('remove', relationName);
  var relatedModel = getModelFromRelName(relationName, opts.db);
  var relationId = relationContent.id;

  if(!resource[relAccessor] || !relatedModel){
    opts.log.info('Trying to access a non-existing relationship', resourceName, relationName, relAccessor);
    return cb(new restify.ResourceNotFoundError());
  }

  relatedModel.get(relationId, function(err, relation){
    resource[relAccessor](relation, function(err){
      if(err){
        opts.log.error('Cannot save relation between %s and %s', resourceName, relationName, relation);
        return cb(new restify.InternalError());
      }

      return cb(201, filterObj(relatedModel.properties, relation));
    });
  });

  opts.log.error('something went bizzare');
  cb(new restify.InternalError());
};