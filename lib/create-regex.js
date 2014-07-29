'use strict';

var format = require('util').format;

/**
 * Create a regular expression for routing requests to
 * @method  createURLRegex
 * @private
 * @param   {string} base string to exist
 * @returns {object} regular expression matching string
 */
module.exports = function(base){
  var matcher = format('^/%s.*', base);
  return new RegExp(matcher);
};
