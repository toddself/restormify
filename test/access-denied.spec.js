/* jshint global: describe, before, beforeEach, afterEach, after, it */
'use strict';

var fs = require('fs');
var restify = require('restify');
var orm = require('orm');
var assert = require('assert');

var restormify = require('../');
var dbProps = {database: 'test', host: 'test-db', protocol: 'sqlite'};

var server = restify.createServer();
var client;
var db;
var baz;
server.use(restify.bodyParser());
server.use(restify.queryParser());

describe('actually delete', function(){
  before(function(done){  
    orm.connect(dbProps, function(err, database){
      if(err){
        done(err);
      }
      db = database;

      restormify({
        db: db, 
        server: server,
        allowAccess: function(){
          return false;
        }
      });

      baz = db.define('baz', {
        name: String, 
        email: String,
        foo: {type: 'boolean', serverOnly: true}, 
        deleted: {type: 'boolean', serverOnly: true}
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

    it('baz should return nothing on a get returns a 401 error', function(done){
      client.get('/api/baz', function(err, req, res, obj){
        assert.equal(res.statusCode, 401, 'received a 401');
        done();
      });
    });

    it('creates a user returns a 401 error', function(done){
      var name = {name: 'todd', email: 't@t.com'};
      client.post('/api/baz', name, function(err, req, res, obj){
        assert.equal(res.statusCode, 401, 'received a 401');
        done();
      });
    });

    it('returns a created user returns a 401 error', function(done){  
      var name = {name: 'foo bar'};

      baz.create(name, function(err, bazName){
        client.get('/api/baz/'+bazName.id, function(err, req, res, obj){
          assert.equal(res.statusCode, 401, 'received a 401');
          done();
        });
      });
    });

    it('returns all created users returns a 401 error', function(done){
      var name = {name: 'foo bar'};

      baz.create(name, function(err, bazName){
        client.get('/api/baz/', function(err, req, res, obj){
          assert.equal(res.statusCode, 401, 'received a 401');
          done();
        });
      });
    });


    it('updating a user (PUT) returns a 401 error', function(done){
      var name = {name: 'foo bar'};

      baz.create(name, function(err, bazName){
        client.put('/api/baz/'+bazName.id, {name: 'baz wee', email: 't@t.com'}, function(err, req, res, obj){
          assert.equal(res.statusCode, 401, 'received a 401');
          done();
        });
      });
    });

    it('updating a user (PATCH) returns a 401 error', function(done){
      var name = {name: 'foo bar', email: 't@t.com'};

      baz.create(name, function(err, bazName){
        client.patch('/api/baz/'+bazName.id, {name: 'baz wee'}, function(err, req, res, obj){
          assert.equal(res.statusCode, 401, 'received a 401');
          done();
        });
      });
    });

    it('rejecting a delete via PUT/PATCH returns a 401 error', function(done){
      var name = {name: 'foobar', email: 't@t.com'};
      baz.create(name, function(err, bazName){
        client.patch('/api/baz/'+bazName.id, {deleted: true}, function(err, req, res, obj){
          assert.equal(res.statusCode, 401, 'Received HTTP 401');
          done();
        });
      });
    });

    it('deleting an object returns a 401 error', function(done){
      var name = {name: 'foobar', email: 't@t.com'};
      baz.create(name, function(err, bazName){
        client.del('/api/baz/'+bazName.id, function(err, req, res, obj){
          assert.equal(res.statusCode, 401, 'Received HTTP 401');
          done();
        });
      });
    });

    afterEach(function(done){
      server.close();
      db.drop(done);
    });
  });

  after(function(done){
    db.close();
    fs.unlink('test-db', function(err){
      done();
    });
  });  
});
