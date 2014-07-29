/* global describe, before, beforeEach, afterEach, after, it */
'use strict';

var fs = require('fs');
var restify = require('restify');
var orm = require('orm');
var assert = require('assert');
var format = require('util').format;

var restormify = require('../');
var dbProps = {database: 'test', host: 'test-db', protocol: 'sqlite'};

var server = restify.createServer();
var client;
var db;
var baz;
server.use(restify.bodyParser());
server.use(restify.queryParser());

var messages = [];

function MockLog(){
 var logit = function(){
    var args = Array.prototype.slice.call(arguments);
    messages.push(format.apply(null, args));
  };

  var child = function(){
    return {
      info: logit,
      error: logit
    };
  };

  return {
    child: child,
    info: logit,
    error: logit
  };
}


describe('logger', function(){
  before(function(done){
    orm.connect(dbProps, function(err, database){
      if(err){
        done(err);
      }
      db = database;

      restormify({
        db: db,
        server: server,
        logger: new MockLog()
      });

      baz = db.define('baz', {
        name: String,
        email: String,
        deleted: {type: 'boolean', serverOnly: true},
        foo: {type: 'boolean', serverOnly: true}
      });
      done();
    });

    client = restify.createJsonClient({
      url: 'http://localhost:1234/api'
    });
  });

  describe('api', function(){
    beforeEach(function(done){
      server.listen(1234);
      baz.sync(done);
    });

    it('logs', function(done){
      client.get('/api/baz', function(err, req, res){
        assert.equal(res.statusCode, 200, 'Received HTTP 200');
        assert.notEqual(messages.length, 0, 'messages in the queue');
        done();
      });
    });

    afterEach(function(done){
      server.close();
      db.drop(done);
    });
  });

  after(function(done){
    db.close();
    fs.unlink('test-db', function(){
      done();
    });
  });
});
