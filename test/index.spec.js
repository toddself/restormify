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


before(function(done){  
  orm.connect(dbProps, function(err, database){
    if(err){
      done(err);
    }
    db = database;
    restormify(db, server, /\/api.*/);
    baz = db.define('baz', {
      name: String, 
      email: String,
      foo: {type: 'boolean', serverOnly: true}, 
      deleted: {type: 'boolean', serverOnly: true}
    });
    done();
  });

  server.listen(1234);
  client = restify.createJsonClient({
    url: 'http://localhost:1234/api'
  });  
});

describe('api', function(){
  beforeEach(function(done){
    baz.sync(done);
  });

  it('baz should return nothing on a get', function(done){
    client.get('/api/baz', function(err, req, res, obj){
      assert.ok(!err, 'no errors');
      assert.equal(res.statusCode, 200, 'received a 200');
      assert.equal(obj.length, 0, 'no data recieved');
      done();
    });
  });

  it('creates a user', function(done){
    var name = {name: 'todd', email: 't@t.com'};
    client.post('/api/baz', name, function(err, req, res, obj){
      assert.ok(!err, 'no errors');
      assert.equal(res.statusCode, 201, 'received a 201');
      assert.equal(obj.name, name.name, 'accepted data');
      assert.equal(obj.email, name.email, 'accepted data');
      assert.ok(!obj.foo, 'server only data not sent');
      assert.ok(!obj.deleted, 'server only data not sent');
      done();
    });
  });

  it('returns a created user', function(done){
    var name = {name: 'foo bar'};

    baz.create(name, function(err, bazName){
      client.get('/api/baz/'+bazName.id, function(err, req, res, obj){
        assert.ok(!err, 'no errors');
        assert.equal(res.statusCode, 200, 'received a 200');
        assert.equal(obj.name, bazName.name, 'returned correct user data');
        assert.equal(obj.id, bazName.id, 'returned correct id');
        done();
      });
    });
  });

  it('returns all created users', function(done){
    var name = {name: 'foo bar'};

    baz.create(name, function(err, bazName){
      client.get('/api/baz/', function(err, req, res, obj){
        assert.ok(!err, 'no errors');
        assert.equal(res.statusCode, 200, 'received a 200');
        assert.ok(Array.isArray(obj), 'returned an array');
        assert.equal(obj[0].name, bazName.name, 'returned correct user data');
        assert.equal(obj[0].id, bazName.id, 'returned correct id');
        done();
      });
    });
  });


  it('updating a user (PUT)', function(done){
    var name = {name: 'foo bar'};

    baz.create(name, function(err, bazName){
      client.put('/api/baz/'+bazName.id, {name: 'baz wee', email: 't@t.com'}, function(err, req, res, obj){
        assert.ok(!err, 'no errors');
        assert.equal(res.statusCode, 200, 'received a 200');
        assert.equal(obj.name, 'baz wee', 'updated the user');
        assert.equal(obj.email, 't@t.com', 'updated the user');
        done();
      });
    });
  });

  it('updating a user (PATCH)', function(done){
    var name = {name: 'foo bar', email: 't@t.com'};

    baz.create(name, function(err, bazName){
      client.patch('/api/baz/'+bazName.id, {name: 'baz wee'}, function(err, req, res, obj){
        assert.ok(!err, 'no errors');
        assert.equal(res.statusCode, 200, 'received a 200');
        assert.equal(obj.name, 'baz wee', 'updated the user');
        assert.equal(obj.email, 't@t.com', 'did not update an unset prop');
        done();
      });
    });
  });

  it('rejecting a delete via PUT/PATCH', function(done){
    var name = {name: 'foobar', email: 't@t.com'};
    baz.create(name, function(err, bazName){
      client.patch('/api/baz/'+bazName.id, {deleted: true}, function(err, req, res, obj){
        assert.ok(err, 'got an error');
        assert.equal(res.statusCode, 400, 'Received HTTP 400');
        assert.equal(obj.message, 'PUT/PATCH may not delete content');
        assert.equal(obj.code, 'InvalidContent');
        done();
      });
    });
  });

  it('deleting an object', function(done){
    var name = {name: 'foobar', email: 't@t.com'};
    baz.create(name, function(err, bazName){
      client.del('/api/baz/'+bazName.id, function(err, req, res, obj){
        assert.ok(!err, 'no error');
        assert.equal(res.statusCode, 200, 'Received HTTP 400');
        assert.equal(obj, 'OK', 'received OK');
        done();
      });
    });
  });

  afterEach(function(done){
    db.drop(done);
  });
});

after(function(done){
  server.close();
  db.close();
  fs.unlink('test-db', done);
});
