'use strict';

var restify = require('restify');
var removeRelation = require('./remove-relation');

module.exports = function(opts){
  var log = opts.logger.child({method: 'delete'});

  return function(resourceName, resourceId, relationName, relationId, content, cb){
    opts.db.models[resourceName].get(resourceId, function(err, resource){
      if(err){
        log.error('Error on delete', err);
        return cb(new restify.InternalError());
      }

      if(!resource){
        log.info('%s/%s not found', resourceName, resourceId);
        return cb(new restify.ResourceNotFoundError());
      }


      if(resourceId && relationName){
        return removeRelation(resource, resourceName, resourceId, relationName, relationId, opts, cb);
      }

      if(opts._actuallyDelete){
        resource.remove(function(err){
          if(err){
            log.error('Error in deleting %s/%s from database. opts._actuallyDelete was', resourceName, resourceId, opts._actuallyDelete, err);
            return cb(new restify.InternalError());
          }
          log.info('Successfully removed %s/%s from database', resourceName, resourceId);
          cb(200, 'OK');
        });
      } else if(opts.db.models[resourceName].properties.deleted){
        resource.deleted = true;
        return resource.save(function(err){
          if(err){
            log.error('Error in deleting %s/%s from database. opts._actuallyDelete was', resourceName, resourceId, opts._actuallyDelete, err);
            return cb(new restify.InternalError());
          }
          log.info('Successfully removed %s/%s from database', resourceName, resourceId);
          cb(200, 'OK');
        });
      } else {
        log.info('No delete method specified');
        return cb(new restify.InvalidContentError('Cannot delete resource'));
      }
    });
  };
};