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

describe('access denied', function(){
  before(function(done){  
    orm.connect(dbProps, function(err, database){
      if(err){
        done(err);
      }
      db = database;

      restormify({
        db: db, 
        server: server,
        deletedColumn: false
      });

      baz = db.define('baz', {
        name: String, 
        email: String,
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


    it('rejecting a delete via PUT/PATCH', function(done){
      var name = {name: 'foobar', email: 't@t.com'};
      baz.create(name, function(err, bazName){
        client.patch('/api/baz/'+bazName.id, {deleted: true}, function(err, req, res, obj){
          assert.equal(res.statusCode, 200, 'Received HTTP 200');
          assert.equal(typeof obj.deleted, 'undefined', 'property did not pass through');
          done();
        });
      });
    });

    it('deleting an object', function(done){
      var name = {name: 'foobar', email: 't@t.com'};
      baz.create(name, function(err, bazName){
        client.del('/api/baz/'+bazName.id, function(err, req, res, obj){
          assert.ok(!err, 'no errors');
          assert.equal(res.statusCode, 200, 'Received HTTP 200');
          assert.equal(obj, 'OK', 'Recieved OK');
          baz.get(bazName.id, function(err, deletedBaz){
            assert.equal(typeof deletedBaz, 'undefined', 'object was removed');
            assert.ok(err.message, 'Not found', 'Error message is not found');
            done();
          });
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
