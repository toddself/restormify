'use strict';

var restify = require('restify');
var filterObj = require('../lib/filter-object');
var format = require('util').format;

var addRelation = require('./add-relation');

module.exports = function(opts){
  var log = opts.logger.child({method: 'post'});
  return function(resourceName, resourceId, relationName, relationId, content, cb){
    opts.db.models[resourceName].find(content, function(err, resource){
      if(err){
        log.error('Unable to query %s with %j', resourceName, content, err);
        return cb(new restify.InternalError());
      }

      if(relationName && resource.length === 1 && resource[0]){
        return addRelation(resource[0], resourceName, relationName, content, opts, cb);
      }

      if(resource.length > 0){
        log.info('Resource already exists, %s', resourceName, resource[0].id);
        return cb(new restify.ConflictError(format('%s already exists', resourceName)));
      }

      resource = new opts.db.models[resourceName](content);
      resource.save(function(err){
        if(err){
          if(typeof err.value === 'undefined'){
            log.info('Could not validate %j as a valid %s object', content, resourceName, err);
            err = new restify.ResourceNotFoundError(format('%s is required', err.property));
          } else if (err.property) {
            log.info('Could not validate %j as a valid %s object', content, resourceName, err);
            err = new restify.InvalidContentError(err.msg);
          } else {
            log.error('Could not save %s to database', resourceName, err);
            err = new restify.InternalError();
          }
          return cb(err);
        }
        var filteredResource = filterObj(opts.db.models[resourceName].properties, resource);
        log.info('Successfully created %s with id %s', resourceName, filteredResource.id);
        cb(201, filteredResource);
      });
    });
  };
};