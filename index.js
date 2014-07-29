'use strict';

var restify = require('restify');
var xtend = require('xtend');
var format = require('util').format;

var createURLRegex = require('./lib/create-regex');

var updateHandler = require('./handlers/update');
var createHandler = require('./handlers/create');
var getHandler = require('./handlers/get');
var deleteHandler = require('./handlers/delete');

var opts;
var methods;
var _apiBaseString = 'api';

var defaults = {
  apiBase: createURLRegex(_apiBaseString),
  deletedColumn: 'deleted',
  allowAccess: function(){
    return true;
  },
  logger: 'default',
  _actuallyDelete: false
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
  var relationName = apiCall[3];
  var relationId = apiCall[4];

  if(method === 'patch' && !methods[method]){
    method = 'put';
  }

  if(Object.keys(methods).indexOf(method) !== -1){
    if(!opts.db.models[resourceName]){
      opts.logger.info('%s is not a model on this db instance', resourceName, Object.keys(opts.db.models));
      return res.send(new restify.ResourceNotFoundError(format('%s: not found', resourceName)));
    }

    if(!opts.allowAccess(req, method, resourceName, resourceId)){
      opts.logger.info('Access has been denied for', req.url);
      return res.send(new restify.InvalidCredentialsError('Not authorized'));
    }

    methods[method].call(null, resourceName, resourceId, relationName, relationId, req.body, function(){
      opts.logger.info('%s for %s/%s', method, resourceName, resourceId);
      return res.send.apply(res, Array.prototype.slice.call(arguments));
    });

  } else {
    opts.logger.info('requested a resource that does not exist, %s %s', method, resourceName);
    return res.send(new restify.BadMethodError(format('%s does not exist for %s', method, resourceName)));
  }
}

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
    };
  }
  opts = xtend(defaults, options);

  if(!opts.deletedColumn){
    opts._actuallyDelete = true;
  }

  if(opts.logger === 'default'){
    opts.logger = opts.server.log;
  } else if(!opts.logger){
    opts.logger = function(){
      return {
        child: function(){
          return {
            info: function(){},
            error: function(){}
          };
        }
      };
    };
  }

  var verbs = ['get', 'put', 'post', 'patch', 'del'];
  for(var i = 0; i < verbs.length; i++){
    opts.server[verbs[i]](opts.apiBase, routeHandler);
  }

  methods = {
    put: updateHandler(opts),
    post: createHandler(opts),
    get: getHandler(opts),
    delete: deleteHandler(opts)
  };

  return server;
};

