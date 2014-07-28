'use strict';

var restify = require('restify');
var log = require('../lib/logger');
var filterObj = require('../lib/filter-db-obj');
var format = require('util').format;
var boundFilter;
var db;

var methods = {
  put: function(resourceName, resourceId, content, cb){
    db.models[resourceName].get(resourceId, function(err, resource){
      if(err || !resource){
        log.error('Error or not found for', req.url, err);
        return cb(new restify.ResourceNotFoundError('Not found'));
      }

      if(content.deleted){
        return cb(new restify.InvalidContentError('PUT/PATCH may not delete content'));
      }

      resource.save(content, function(err, updatedResource){
        if(err){
          log.error('Error in saving changes to model', err);
          return cb(new restify.InternalError(err.message));
        }
        var filteredResource = boundFilter(updatedResource);
        cb(200, filteredResource);
      });
    });
  },
  post: function(resourceName, resouceId, content, cb){
    db.models[resourceName].find(content, function(err, resource){
      if(resource.length > 0){
        return cb(new restify.ConflictError(format('%s already exists', resourceName)));
      }

      var resource = new db.models[resourceName](content);
      resource.save(function(err){
        if(err){
          log.error('Cannot create new', resourceName, err);
          if(typeof err.value === 'undefined'){
            err = new restify.MissingContentError(format('%s is required', err.property));
          } else if (err.property) {
            err = new restify.InvalidContentError(err.msg);
          } else {
            err = new restify.InternalError(err.message || err.msg);
          }
          return cb(err);
        }
        var filteredResource = boundFilter(resource);
        cb(201, filteredResource);
      });
    });
  },
  get: function(resourceName, resourceId, content, cb){
    var query = {deleted: false};
    if(resourceId){
      query.id = resourceId;
    }
    db.models[resourceName].find(query, function(err, resource){
      resource = Array.isArray(resource) ? resource : [resource];
      if(err || resource.length === 0){
        log.error('No %s found', resourceName);
        return cb(new restify.ResourceNotFoundError('Not found'));
      }

      var filteredResource = resource.map(boundFilter);
      cb(200, resourceId ? filteredResource[0] : filteredResource);
    })
  },
  delete: function(resourceName, resourceId, content, cb){
    db.models[resourceName].get(resourceId, function(err, resource){
      if(err || !resource){
        log.error('Error or not found for', resourceName, err);
        return cb(new restify.ResourceNotFoundError('Not found'));
      }
      resource.deleted = true;
      resource.save(function(err){
        if(err){
          log.error('Problem deleting', resourceName, resourceId, err);
          return cb(new restify.InternalError(err.message));
        }
        cb(200, 'OK');
      });
    });
  }
};

module.exports = function(database){
  db = database;

  return {
    route: function(req, res, next){
      var method = req.method.toLowerCase();
      var url = req.url;
      var apiCall = url.split('/').slice(1);
      var resourceName;
      var resourceId;
      var that = this;

      if(apiCall[0] === 'api'){
        resourceName = apiCall[1];
        resourceId = apiCall[2];

        if(method === 'patch' && !methods[method]){
          method = 'put';
        }
        if(Object.keys(methods).indexOf(method) !== -1){
          if(!db.models[resourceName]){
            return res.send(new restify.MissingContentError(format('%s: not found', resourceName)));
          }

          boundFilter = filterObj.bind(null, db.models[resourceName].properties);
          log.info('%s %s, id %s, content %s', method, resourceName, resourceId, req.body);
          methods[method].call(null, resourceName, resourceId, req.body, function(){
            return res.send.apply(res, Array.prototype.slice.call(arguments));
          });

        } else {
          return res.send(new restify.BadMethodError(format('%s does not exist for %s', method, resourceName)));
        }

      } else {
        next();
      }
    },
    methods: ['get', 'put', 'post', 'patch', 'del']
  };
};
