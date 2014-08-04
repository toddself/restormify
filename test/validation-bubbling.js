/* jshint unused: false */
/* global describe, before, beforeEach, afterEach, after, it, xdescribe, xit */
'use strict';

var fs = require('fs');
var restify = require('restify');
var orm = require('orm');
var assert = require('assert');

var restormify = require('../');
var dbProps = {host: 'logger', protocol: 'sqlite'};

var server = restify.createServer();
var client;
var db;
var baz;
server.use(restify.bodyParser());
server.use(restify.queryParser());

describe('node-orm2 validations', function(){
  before(function(done){
    orm.connect(dbProps, function(err, database){
      if(err){
        done(err);
      }
      db = database;

      restormify({
        db: db,
        server: server
      }, function(){
        baz = db.define('baz', {
          name: String,
          email: {type: 'text', unique: true},
          deleted: {type: 'boolean', serverOnly: true},
          foo: {type: 'boolean', serverOnly: true}
        }, 
        {validations: {
          name: orm.enforce.ranges.length(3, undefined, 'too small')
        }});
        done();
      });
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

    it('rejects unique constraints', function(done){
      var bazzer = {name: 'foo', email: 'foo@foo.bar'};
      client.post('/api/baz', bazzer, function(err, req, res){
        client.post('/api/baz', bazzer, function(err, req, res){
          assert.equal(res.statusCode, 409, '490 Conflict recieved');
          assert.equal(err.message, 'baz already exists', 'unique constraint');
          done();
        });
      });
    });

    it('rejects validation matching', function(done){
      var bazzer = {name: 'fo', email:'foo@foo.bar'};
      client.post('/api/baz', bazzer, function(err, req, res){
        assert.equal(res.statusCode, 400, 'invalid content rejected');
        assert.equal(err.message, 'too small', 'validation message matches');
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
    fs.unlink(dbProps.host, function(){
      done();
    });
  });
});
