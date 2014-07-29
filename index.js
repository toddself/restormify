'use strict';

var restify = require('restify');
var xtend = require('xtend');
var format = require('util').format;
var opts;
var _actuallyDelete = false;
var _apiBaseString = 'api';
var logger;

var defaults = {
  apiBase: createURLRegex(_apiBaseString),
  deletedColumn: 'deleted',
  allowAccess: function(){
    return true;
  },
  logger: 'default'
};

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

/**
 * Create a regular expression for routing requests to
 * @method  createURLRegex
 * @private
 * @param   {string} base string to exist
 * @returns {object} regular expression matching string
 */
function createURLRegex(base){
  var matcher = format('^/%s.*', base)
  return new RegExp(matcher);
}

var methods = {
  put: function(resourceName, resourceId, content, cb){
    opts.db.models[resourceName].get(resourceId, function(err, resource){
      if(err || !resource){
        return cb(new restify.ResourceNotFoundError('Not found'));
      }

      if(!_actuallyDelete && opts.db.models[resourceName].properties.deleted && content.deleted){
         return cb(new restify.InvalidContentError('PUT/PATCH may not delete content'));
      }

      resource.save(content, function(err, updatedResource){
        if(err){
          return cb(new restify.InternalError(err.message));
        }
        var filteredResource = filterObj(opts.db.models[resourceName].properties, updatedResource);
        cb(200, filteredResource);
      });
    });
  },
  post: function(resourceName, resouceId, content, cb){
    opts.db.models[resourceName].find(content, function(err, resource){
      if(err){
        return cb(new restify.InternalError(err.message));
      }

      if(resource.length > 0){
        return cb(new restify.ConflictError(format('%s already exists', resourceName)));
      }

      var resource = new opts.db.models[resourceName](content);
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
        var filteredResource = filterObj(opts.db.models[resourceName].properties, resource);
        cb(201, filteredResource);
      });
    });
  },
  get: function(resourceName, resourceId, content, cb){
    var query = {};

    if(_actuallyDelete){
      query.deleted = false;
    }

    if(resourceId){
      query.id = resourceId;
    }

    opts.db.models[resourceName].find(query, function(err, resource){
      resource = Array.isArray(resource) ? resource : [resource];
      if(err){
        return cb(new restify.InternalError(err.message));
      }

      var filteredResource = resource.map(function(r){
        return filterObj(opts.db.models[resourceName].properties, r);
      });

      cb(200, resourceId ? filteredResource[0] : filteredResource);
    })
  },

  delete: function(resourceName, resourceId, content, cb){
    opts.db.models[resourceName].get(resourceId, function(err, resource){
      if(err || !resource){
        return cb(new restify.ResourceNotFoundError('Not found'));
      }

      if(_actuallyDelete){
        resource.remove(function(err){
          if(err){
            return cb(new restify.InternalError(err.message));
          }
          cb(200, 'OK');
        });
      } else if(opts.db.models[resourceName].properties.deleted){
        resource.deleted = true;
        return resource.save(function(err){
          if(err){
            return cb(new restify.InternalError(err.message));
          }
          cb(200, 'OK');
        });
      } else {
        return cb(new restify.InvalidContentError('Cannot delete resource'));
      }
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

  if(method === 'patch' && !methods[method]){
    method = 'put';
  }

  if(Object.keys(methods).indexOf(method) !== -1){
    if(!opts.db.models[resourceName]){
      opts.logger.info('%s is not a model on this db instance', Object.keys(db.models));
      return res.send(new restify.MissingContentError(format('%s: not found', resourceName)));
    }

    if(!opts.allowAccess(req, method, resourceName, resourceId)){
      opts.logger.info('Access has been denied for', req.url);
      return res.send(new restify.InvalidCredentialsError('Not authorized'));
    }

    methods[method].call(null, resourceName, resourceId, req.body, function(){
      opts.logger.info('%s for %s/%s', method, resourceName, resourceId);
      return res.send.apply(res, Array.prototype.slice.call(arguments));
    });

  } else {
    opts.logger.info('requested a resource that does not exist, %s %s', method, resourceName);
    return res.send(new restify.BadMethodError(format('%s does not exist for %s', method, resourceName)));
  }
};

/**
 * Create generic REST API
 * @method  restormify
 * @param   {object} opts options for restormify or a db instance
 * @param   {object} opts.db database instance
 * @param   {object} opts.server server instance
 * @param   {string} [opts.apiBase] base URL for API calls.
 * @param   {string} [opts.deletedColumn] what column to use to mark an item deleted. `false` to disable
 * @param   {function} [opts.allowAccess] a function given the resourceName, the reource ID, the method and the request obj. Return boolean if this request should be processed
 * @param   {mixed} [opts.logger] specify a logger to use. `default` will use `server.log`, `false` will not log
 * @param   {object} [server] restify server instance
 * @param   {string} [base=''] base URL for API calls
 * @returns {object} server
 */
module.exports = function(options, server, apiBase){
  if(server){
    options = {
      db: options,
      server: server,
      apiBase: createURLRegex(apiBase || _apiBaseString)
    }
  }
  opts = xtend(defaults, options);

  if(!opts.deletedColumn){
    _actuallyDelete = true;
  }

  if(opts.logger === 'default'){
    opts.logger = opts.server.log;
  } else if(!opts.logger){
    opts.logger = function(){};
  }

  var methods = ['get', 'put', 'post', 'patch', 'del'];
  for(var i = 0; i < methods.length; i++){
    opts.server[methods[i]](opts.apiBase, routeHandler);
  }

  return server;
};

