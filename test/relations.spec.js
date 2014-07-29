/* global describe, before, beforeEach, afterEach, after, it, xit */
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
var foo;
server.use(restify.bodyParser());
server.use(restify.queryParser());

describe('relations', function(){
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
        name: String
      });

      foo = db.define('foo', {
        name: String
      });

      foo.hasOne('baz', baz, {autoFetch: true});

      done();
    });

    client = restify.createJsonClient({
      url: 'http://localhost:1234/api'
    });  
  });

  describe('api', function(){
    beforeEach(function(done){
      server.listen(1234);
      baz.sync(function(){
        foo.sync(done);
      });
    });

    it('returns 404 trying to get a non-existing relationship', function(done){
      foo.create({name: 'foo'}, function(err, madeFoo){
        client.get('/api/foo/'+madeFoo.id+'/baz/1', function(err){
          assert.equal(err.statusCode, 404, '404 returned');
          done();
        });
      });
    });

    it('creates an association', function(done){
      foo.create({name: 'foo'}, function(err, madeFoo){
        baz.create({name: 'baz'}, function(err, madeBaz){
          client.post('/api/foo/'+madeFoo.id+'/baz/', madeBaz, function(err, req, res, obj){
            assert.equal(res.statusCode, 201, 'created association');
            assert.equal(obj.id, madeBaz.id, 'returned correct object');
            done();
          });
        });
      });
    });

    it('returns the full monty', function(done){
      foo.create({name: 'foo'}, function(err, madeFoo){
        baz.create({name: 'baz'}, function(err, madeBaz){
          madeFoo.setBaz(madeBaz, function(){
            client.get('/api/foo/'+madeFoo.id, function(err, req, res, obj){
              console.log(obj);
              done();
            });
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
    fs.unlink('test-db', function(){
      done();
    });
  });  
});
