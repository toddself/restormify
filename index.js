'use strict';

var restify = require('restify');
var xtend = require('xtend');

var createURLRegex = require('./lib/create-regex');
var association = require('./lib/association-model');

var updateHandler = require('./handlers/update');
var createHandler = require('./handlers/create');
var getHandler = require('./handlers/get');
var deleteHandler = require('./handlers/delete');

var getAssociation = require('./associations/get');
var createAssociation = require('./associations/create');
var removeAssociation = require('./associations/remove');

var opts;
var methods = {};
var associations = {};
var availableAssociations = {};
var availableMethods = {};
var _apiBaseString = 'api';

var defaults = {
  apiPrefix: _apiBaseString,
  apiBase: createURLRegex(_apiBaseString),
  deletedColumn: 'deleted',
  allowAccess: function(){
    return true;
  },
  logger: 'default',
  _actuallyDelete: false
};

var dummyLogger = function(){
  return {
    child: function(){
      return {
        info: function(){},
        error: function(){}
      };
    }
  };
};

/**
 * Listener for node-orm2 route method
 * @method  routeHandler
 * @async
 * @private
 * @param   {object} req Restify request object
 * @param   {object} res Resitfy response object
 * @returns {object} undefined
 */
function routeHandler(req, res){
  var method = req.method.toLowerCase();
  var url = req.url;
  var apiCall = url.split('/').slice(1);
  var resourceName = apiCall[1];
  var resourceId = apiCall[2];
  var assocName = apiCall[3];
  var assocType = apiCall[4];
  var assocId = apiCall[5];
  var resourceModel;
  var assocModel;
  var canAccessResource;
  var canAccessAssoc;

  if(method === 'patch' && !methods[method]){
    method = 'put';
  }

  // do we support the HTTP verb?
  if(availableMethods.indexOf(method) !== -1 || (assocName && availableAssociations.indexOf(method) !== -1)){
    // does the resource exist
    resourceModel = opts.db.models[resourceName];
    assocModel = opts.db.models.associations;
    canAccessResource = opts.allowAccess(req, method, resourceName, resourceId);
    canAccessAssoc = opts.allowAccess(req, method, assocName);

    if(!resourceModel || (assocName && !assocModel)){
      opts.logger.info('Not a model on this db instance', resourceName, assocName);
      return res.send(new restify.ResourceNotFoundError());
    }

    // is the current requestor allowed to perform this action on this resource
    if(!canAccessResource || (assocName && !canAccessAssoc)){
      opts.logger.info('Access has been denied for', req.url);
      return res.send(new restify.InvalidCredentialsError());
    }

    // we are assocating content to other content or not
    if(resourceId && assocName){
      return associations[method].call(null, resourceName, resourceId, assocType, assocId, req.body, function(){
        opts.logger.info('%s for %s/%s/%s/%s', method, resourceName, resourceId, assocName);
        return res.send.apply(res, Array.prototype.slice.call(arguments));
      });
    } else {
      return methods[method].call(null, resourceName, resourceId, req.body, function(){
        opts.logger.info('%s for %s/%s', method, resourceName, resourceId);
        return res.send.apply(res, Array.prototype.slice.call(arguments));
      });
    }
  }

  // we don't support the HTTP verb is the default
  opts.logger.info('Tried to call a method that we do not support', method, resourceName);
  res.header('Allow', availableMethods.join(', '));
  return res.send(new restify.BadMethodError('Not supported'));
}

/**
 * Create generic REST API
 * @method  restormify
 * @param   {object}   opts options for restormify or a db instance
 * @param   {object}   opts.db node-orm2 db instance
 * @param   {object}   opts.server restify server instance
 * @param   {string}   [opts.apiBase] base URL for API calls.
 * @param   {string}   [opts.deletedColumn] what column to use to mark an item deleted. `false` to disable
 * @param   {function} [opts.allowAccess] a function given the resourceName, the reource ID, the method and the request obj. Return boolean if this request should be processed
 * @param   {mixed}    [opts.logger] specify a logger to use. `default` will use `server.log`, `false` will not log
 * @param   {function} [cb] an optional callback for when the routes are initialized
 * @returns {object}   undefined
 */
module.exports = function(options, cb){
  if(typeof cb !== 'function'){
    cb = function(){};
  }

  opts = xtend(defaults, options);

  if(options.apiBase){
    opts.apiPrefix = options.apiBase;
    opts.apiBase = createURLRegex(opts.apiPrefix);
  }

  if(!opts.deletedColumn){
    opts._actuallyDelete = true;
  }

  if(opts.logger === 'default'){
    opts.logger = opts.server.log;
  } else if(!opts.logger){
    opts.logger = dummyLogger;
  }

  var associationModel = association(opts.db);
  associationModel.sync(function(err){
    var verbs = ['get', 'put', 'post', 'patch', 'del'];
    for(var i = 0; i < verbs.length; i++){
      opts.server[verbs[i]](opts.apiBase, routeHandler);
    }

    associations = {
      get: getAssociation(opts),
      post: createAssociation(opts),
      delete: removeAssociation(opts)
    };

    methods = {
      put: updateHandler(opts),
      post: createHandler(opts),
      get: getHandler(opts),
      delete: deleteHandler(opts)
    };
    availableAssociations = Object.keys(associations);
    availableMethods = Object.keys(methods);
    cb(err, associationModel);
  });
};
