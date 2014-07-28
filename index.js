'use strict';

var restify = require('restify');
var format = require('util').format;
var db;
var apiBase;

/**
 * Enumerate through the response object to strip out all values that are marked
 * `serverOnly` as to not leak details to the client
 * @method  filterObj
 * @private
 * @param   {object} modelProps node-orm's model property
 * @param   {object} obj response from orm call
 * @returns {object} filtered object with all `serverOnly` fields removed
 */
function filterObj(modelProps, obj){
  var returnObj = {};
  Object.keys(modelProps).forEach(function(key){
    if(!modelProps[key].serverOnly){
      returnObj[key] = obj[key];
    }
  });
  return returnObj;
}

var methods = {
  put: function(resourceName, resourceId, content, cb){
    db.models[resourceName].get(resourceId, function(err, resource){
      if(err || !resource){
        return cb(new restify.ResourceNotFoundError('Not found'));
      }

      if(content.deleted){
        return cb(new restify.InvalidContentError('PUT/PATCH may not delete content'));
      }

      resource.save(content, function(err, updatedResource){
        if(err){
          return cb(new restify.InternalError(err.message));
        }
        var filteredResource = filterObj(db.models[resourceName].properties, updatedResource);
        cb(200, filteredResource);
      });
    });
  },
  post: function(resourceName, resouceId, content, cb){
    db.models[resourceName].find(content, function(err, resource){
      if(err){
        return cb(new restify.InternalError(err.message));
      }

      if(resource.length > 0){
        return cb(new restify.ConflictError(format('%s already exists', resourceName)));
      }

      var resource = new db.models[resourceName](content);
      resource.save(function(err){
        if(err){
          if(typeof err.value === 'undefined'){
            err = new restify.MissingContentError(format('%s is required', err.property));
          } else if (err.property) {
            err = new restify.InvalidContentError(err.msg);
          } else {
            err = new restify.InternalError(err.message || err.msg);
          }
          return cb(err);
        }
        var filteredResource = filterObj(db.models[resourceName].properties, resource);
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
      if(err){
        return cb(new restify.InternalError(err.message));
      }

      var filteredResource = resource.map(function(r){
        return filterObj(db.models[resourceName].properties, r);
      });
      
      cb(200, resourceId ? filteredResource[0] : filteredResource);
    })
  },
  delete: function(resourceName, resourceId, content, cb){
    db.models[resourceName].get(resourceId, function(err, resource){
      if(err || !resource){
        return cb(new restify.ResourceNotFoundError('Not found'));
      }
      resource.deleted = true;
      resource.save(function(err){
        if(err){
          return cb(new restify.InternalError(err.message));
        }
        cb(200, 'OK');
      });
    });
  }
};

/**
 * Listener for node-orm2 route method
 * @method  routeHandler
 * @async
 * @private
 * @param   {object} req Restify request object
 * @param   {object} res Resitfy response object
 * @param   {Function} next Function to pass to next handler
 * @returns {object} undefined
 */
function routeHandler(req, res, next){
  var method = req.method.toLowerCase();
  var url = req.url;
  var apiCall = url.split('/').slice(1);
  var resourceName = apiCall[1];
  var resourceId = apiCall[2];
  var that = this;

  if(method === 'patch' && !methods[method]){
    method = 'put';
  }

  if(Object.keys(methods).indexOf(method) !== -1){
    if(!db.models[resourceName]){
      return res.send(new restify.MissingContentError(format('%s: not found', resourceName)));
    }

    methods[method].call(null, resourceName, resourceId, req.body, function(){
      return res.send.apply(res, Array.prototype.slice.call(arguments));
    });

  } else {
    return res.send(new restify.BadMethodError(format('%s does not exist for %s', method, resourceName)));
  }
};

/**
 * Create generic REST API 
 * @method  restormify
 * @param   {object} database node-orm database object
 * @param   {object} server restify server instance
 * @param   {string} [base=''] base URL for API calls
 * @returns {object} server
 */
module.exports = function(database, server, base){
  db = database;
  apiBase = base || '';
  var methods = ['get', 'put', 'post', 'patch', 'del'];

  for(var i = 0; i < methods.length; i++){

    server[methods[i]](apiBase, routeHandler);
  }

  return server;
};

