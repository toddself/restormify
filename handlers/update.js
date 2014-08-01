'use strict';

var restify = require('restify');
var filterObj = require('../lib/filter-object');
var appendLinks = require('../lib/append-links');

module.exports = function(opts){
  var log = opts.logger.child({method: 'update'});
  return function(resourceName, resourceId, content, cb){
    opts.db.models[resourceName].get(resourceId, function(err, resource){
      if(err){
        log.error('Could not get %s/%s', resourceName, resourceId, err);
        return cb(new restify.InternalError());
      }

      if(!resource){
        log.info('Nothing found for %s/%s', resourceName, resourceId);
        return cb(new restify.ResourceNotFoundError());
      }

      if(!opts._actuallyDelete && opts.db.models[resourceName].properties.deleted && content.deleted){
        log.info('Trying to delete object via PUT/PATCH');
        return cb(new restify.InvalidContentError('PUT/PATCH may not delete content'));
      }

      resource.save(content, function(err, updatedResource){
        if(err){
          log.error('Cannot update %s/%s', resourceName, resourceId, err);
          return cb(new restify.InternalError());
        }
        var filteredResource = filterObj(opts.db.models[resourceName].properties, updatedResource);
        log.info('Updated %s/%s', resourceName, resourceId);
        cb(200, appendLinks(filteredResource, resourceName, opts.apiPrefix));
      });
    });
  };
};