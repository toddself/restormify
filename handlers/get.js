'use strict';

var restify = require('restify');
var filterObj = require('../lib/filter-object');
var isEmpty = require('lodash.isempty');

module.exports = function(opts){
  var log = opts.logger.child({method: 'get'});
  return function(resourceName, resourceId, content, cb){
    var query = {};

    if(opts._actuallyDelete){
      query.deleted = false;
    }

    if(resourceId){
      query.id = parseInt(resourceId, 10);
      if(isNaN(query.id)){
        log.info('Resource ID did not parse as an integer', resourceId, query.id);
        return cb(new restify.ResourceNotFoundError());
      }
    }

    opts.db.models[resourceName].find(query, function(err, resource){
      resource = Array.isArray(resource) ? resource : [resource];
      var returnObject;
      if(err){
        log.error('Cannot get %s/%s', resourceName, resourceId, err);
        return cb(new restify.InternalError());
      }

      var filteredResource = resource.map(function(r){
        return filterObj(opts.db.models[resourceName].properties, r);
      });

      if(resourceId){
        returnObject = filteredResource[0];
        if(isEmpty(returnObject)){
          log.info('No results for query %j', query);
          return cb(new restify.ResourceNotFoundError('Not found'));
        }
      } else {
        returnObject = filteredResource;
      }
      log.info('got %s/%s', resourceName, resourceId);
      cb(200, returnObject);
    });
  };
};