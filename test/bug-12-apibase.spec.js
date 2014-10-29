/* jshint unused: false */
/* global describe, before, beforeEach, afterEach, after, it, xdescribe, xit */
'use strict';

var fs = require('fs');
var restify = require('restify');
var orm = require('orm');
var assert = require('assert');

var restormify = require('../');
var dbProps = {host: 'index', protocol: 'sqlite'};

var server = restify.createServer();
var client;
var db;
var baz;
server.use(restify.bodyParser());
server.use(restify.queryParser());

describe('passing in a new apibase', function(){
  before(function(done){
    orm.connect(dbProps, function(err, database){
      if(err){
        done(err);
      }
      db = database;

      restormify({
        db: db,
        server: server,
        apiBase: 'foobar'
      }, function(){
        baz = db.define('baz', {
          name: String,
          email: String,
          foo: {type: 'boolean', serverOnly: true},
          deleted: {type: 'boolean', serverOnly: true}
        });
        done();
      });
    });

    client = restify.createJsonClient({
      url: 'http://localhost:1234/foobar'
    });
  });

  describe('api', function(){
    beforeEach(function(done){
      server.listen(1234);
      baz.sync(done);
    });

    it('baz should return nothing on a get', function(done){
      client.get('/foobar/baz', function(err, req, res, obj){
        assert.ok(!err, 'no errors');
        assert.equal(res.statusCode, 200, 'received a 200');
        assert.equal(obj.length, 0, 'no data recieved');
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
