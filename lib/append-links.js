'use strict';

var format = require('util').format;


module.exports = function(resource, resourceName, apiPrefix){
  resource._links = {
    self: {
      href: format('/%s/%s/%s', apiPrefix, resourceName, resource.id),
      type: resourceName
    },
    associations: {
      href: format('/%s/%s/%s/associations', apiPrefix, resourceName, resource.id)
    },
    associate: {
      href: format('/%s/%s/%s/associate/{associationName}', apiPrefix, resourceName, resource.id),
      templated: true
    }
  };

  return resource;
};
