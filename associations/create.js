'use strict';

var restify = require('restify');
var async = require('async');
var isEmpty = require('lodash.isempty');

var filterObj = require('../lib/filter-object');
var appendLinks = require('../lib/append-links');

module.exports = function(opts){
  var log = opts.logger.child({method: 'post association'});
  return function(resourceName, resourceId, assocType, assocId, assocBody, cb){
    assocBody = Array.isArray(assocBody) ? assocBody : [assocBody];
    var query = {
      baseType: resourceName,
      baseId: resourceId,
      relationName: assocType
    };

    var makeAssociations = function(err, res){
      var associate;
      var associationsCreated;
      var hasIds;
      var assocToMake;

      if(err){
        if(err.literalCode === 'NOT_FOUND'){
          log.info('Origina resource not found %s/%s', resourceName, resourceId);
          return cb(new restify.ResourceNotFoundError());
        } else {
          log.error('Unable to get resource or relations %j', query, err);
          return cb(new restify.InternalError());
        }
      }
        
      hasIds = res.associations.map(function(assoc){
        return assoc.id;
      });

      assocToMake = assocBody.filter(function(assoc){
        return hasIds.indexOf(assoc.id) === -1;
      });

      if(isEmpty(assocToMake)){
        log.info('Making associations that already exist');
        assocToMake = {};
        assocToMake[assocType] = res.associations.map(function(a){
          var filtered = filterObj(opts.db.models[assocType].properties, a);
          return appendLinks(filtered, a._links.self.type, opts.apiBase);
        });

        return cb(200, assocToMake);

      } else {
        associate = function(assoc, done){
          var rel;
          try{
            rel = {
              relationName: assocType,
              baseType: resourceName,
              baseId: resourceId,
              relatedType: assoc._links.self.type,
              relatedId: assoc.id
            };
          } catch(e){
            log.info('Malformed request from client: %j', assoc, err);
            return done(new restify.InvalidContentError());
          }

          opts.db.models[assoc._links.self.type].get(assoc.id, function(err){
            if(err){
              if(err.literalCode === 'NOT_FOUND'){
                log.info('Trying to make an association with a non-existing entity', err);
                return done(new restify.ResourceNotFoundError('Related objects must be created before they are associated'));
              } else {
                log.error('Could not get related object', err);
                return done(new restify.InternalError());
              }
            }
            opts.db.models.associations.create(rel, done);
          });
        };

        associationsCreated = function(err){
          if(err){
            return cb(err);
          }

          var filtered = assocBody.filter(function(assoc){
            var type = assoc._links.self.type;
            var filtered = filterObj(opts.db.models[type].properties, assoc);
            return appendLinks(filtered, type, opts.apiBase);
          });
          var returnObj = {};
          returnObj[assocType] = filtered;

          cb(200, returnObj);
        };

        async.map(assocToMake, associate, associationsCreated);
      }
    };

    async.parallel({
      resource: function(cb){
        opts.db.models[resourceName].get(resourceId, cb);
      },
      associations: function(cb){
        opts.db.models.associations.find(query, cb);
      }
    },
    makeAssociations);
  };
};