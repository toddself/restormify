'use strict';

var restify = require('restify');
var async = require('async');
var isEmpty = require('lodash.isempty');

var filterObj = require('../lib/filter-object');
var appendLinks = require('../lib/append-links');

module.exports = function(opts){
  var log = opts.logger.child({method: 'get association'});
  return function(resourceName, resourceId, assocType, assocId, assocContent, cb){
    var query = {
      baseType: resourceName,
      baseId: resourceId
    };

    var findAssociations = function(){
      opts.db.models.associations.find(query, function(err, associations){
        if(err){
          log.error('Unable to look up associations %j', query, err);
          return cb(new restify.InteralError());
        }

        // exit early if we have nothing
        if(isEmpty(associations)){
          log.info('No associations found for %j', query);
          return cb(200, {});
        }

        var getOriginalResource = function(assocItem, done){
          var assocModel = opts.db.models[assocItem.relatedType];
          assocModel.get(assocItem.relatedId, function(err, origItem){
            if(err){
              return done(err);
            }
            var filtered = filterObj(assocModel.properties, origItem);
            var linked = appendLinks(filtered, assocItem.relatedType, opts.apiPrefix);
            var populatedItem = {relation: assocItem.relationName, item: linked};
            done(null, populatedItem);
          });
        };

        var resolvedAssociations = function(err, items){
          if(err){
            log.error('Could not obtain original item', err);
            return cb(new restify.InteralError());
          }
          var assocObj = {};
          var assocLen = items.length;
          for(var i = 0; i < assocLen; i++){
            var item = items[i];
            if(!Array.isArray(assocObj[item.relation])){
              assocObj[item.relation] = [];
            }
            assocObj[item.relation].push(item.item);
          }

          cb(200, assocObj);
        };

        async.map(associations, getOriginalResource, resolvedAssociations);
      });
    };

    opts.db.models[resourceName].get(resourceId, function(err){
      if(err){
        if(err.literalCode === 'NOT_FOUND'){
          log.info('No base resource exists %s/%s', resourceName, resourceId);
          return cb(new restify.ResourceNotFoundError());
        } else {
          log.error('Unable to load base resource %s/%s', resourceName, resourceId, err);
          return cb(new restify.InternalError());
        }
      }

      findAssociations();
    });
  };
};
