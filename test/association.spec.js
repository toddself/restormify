/* jshint unused: false */
/* global describe, before, beforeEach, afterEach, after, it, xdescribe, xit */
'use strict';

var fs = require('fs');
var restify = require('restify');
var orm = require('orm');
var assert = require('assert');
var format = require('util').format;
var async = require('async');

var restormify = require('../');
var dbProps = {host: 'relations', protocol: 'sqlite'};

var server = restify.createServer();
var client;
var db;
var baz;
var foo;
var assoc;
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
        server: server
      }, function(err, association){
        baz = db.define('baz', {
          name: String,
          email: String,
          deleted: {type: 'boolean', serverOnly: true},
          foo: {type: 'boolean', serverOnly: true}
        });

        foo = db.define('foo', {
          name: String,
          deleted: {type: 'boolean', serverOnly: true}
        });

        assoc = association;

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
      baz.sync(function(){
        foo.sync(function(){
          assoc.sync(done);
        });
      });
    });

    it('gets an association', function(done){
      async.parallel({
        Baz: function(cb){
           baz.create({name: 'baz', email: 'boo@baz.foo'}, cb);
        },
        Foo: function(cb){
          foo.create({name: 'foo'}, cb);
        }
      }, function(err, results){
        if(err){
          done(err);
        }
        var rel = {
          relationName: 'bazfoo',
          baseType: 'baz',
          baseId: results.Baz.id,
          relatedType: 'foo',
          relatedId: results.Foo.id
        };

        db.models.associations.create(rel, function(){
          client.get('/api/baz/'+results.Baz.id+'/associations', function(err, req, res, obj){
            assert.ok(Object.keys(obj).indexOf('bazfoo') !== -1, 'bazfoo relationship exists');
            assert.equal(obj.bazfoo.length, 1, 'there is one item in the relationship');
            assert.equal(obj.bazfoo[0].name, results.Foo.name, 'name is foo');
            assert.ok(obj.bazfoo[0]._links, 'is populated with HAL links property');
            assert.equal(obj.bazfoo[0]._links.self.type, 'foo', 'object type exposed');
            assert.equal(obj.bazfoo[0]._links.self.href, '/api/foo/'+results.Foo.id, 'self reference correct');
            assert.equal(obj.bazfoo[0]._links.associations.href, '/api/foo/'+results.Foo.id+'/associations', 'associations reference ok');
            assert.equal(obj.bazfoo[0]._links.associate.templated, true, 'associate is templated');
            assert.equal(obj.bazfoo[0]._links.associate.href, '/api/foo/'+results.Foo.id+'/associate/{associationName}', 'associate is templated');
            done();
          });
        });
      });
    });

    it('return an empty object with no associations on existing model', function(done){
      client.post('/api/foo', {name: 'test'}, function(err, req, res, Foo){
        client.get(Foo._links.associations.href, function(err, req, res, obj){
          assert.equal(res.statusCode, 200, 'got a 200');
          assert.deepEqual(obj, {}, 'nothing in object');
          done();
        });
      });
    });

    it('returns a 404 trying to get associations on a non-existing model', function(done){
      client.get('/api/foo/1/associations', function(err, req, res, obj){
        assert.equal(res.statusCode, 404, 'not found');
        done();
      });
    });


    it('makes an association', function(done){
      async.parallel({
        Baz: function(cb){
          var data = {name: 'baz', email: 'baz@bazoom.com'};
          client.post('/api/baz', data, function(err, req, res, obj){
            cb(err, obj);
          });
        },
        Foo: function(cb){
          var data = {name: 'foo'};
          client.post('/api/foo', data, function(err, req, res, obj){
            cb(err, obj);
          });
        }
      },
      function(err, results){
        if(err){
          done(err);
        }
        var assocUrl = results.Baz._links.associate.href.replace('{associationName}', 'bazfoo');
        client.post(assocUrl, results.Foo, function(err, req, res, obj){
          assert.equal(res.statusCode, 200, 'recieved a 200');
          assert.ok(Object.keys(obj).indexOf('bazfoo') !== -1, 'returned association type');
          assert.deepEqual(results.Foo, obj.bazfoo[0], 'Foo was associated with Baz');
          done();
        });
      }
      );
    });

    it('returns a 404 making associations on a non-existing item', function(done){
      client.post('/api/foo', {name: 'test'}, function(err, req, res, Foo){
        client.post('/api/baz/1/associate/bazfoo', Foo, function(err, req, res, obj){
          assert.equal(res.statusCode, 404, 'recieved a 404');
          done();
        });
      });
    });

    it('returns a 400 when associating invalid objects', function(done){
      client.post('/api/foo', {name: 'test'}, function(err, req, res, Foo){
        var assocUrl = Foo._links.associate.href.replace('{associationName}', 'foofoo');
        client.post(assocUrl, {name: 'blerg', id: 2}, function(err, req, res, obj){
          assert.equal(res.statusCode, 400, 'not found');
          done();
        });
      });
    });

    it('returns a 404 when associating missing associations', function(done){
      client.post('/api/foo', {name: 'test'}, function(err, req, res, Foo){
        var assocUrl = Foo._links.associate.href.replace('{associationName}', 'foofoo');
        var fakeItem = {
          name: 'blerg',
          id: 2,
          _links: {
            self: {
              href: '/api/foo/2',
              type: 'foo'
            }
          }
        };
        client.post(assocUrl, fakeItem, function(err, req, res, obj){
          assert.equal(res.statusCode, 404, 'not found');
          done();
        });
      });
    });

    it('removes an association', function(done){
      var newFoo = {name: 'test'};
      client.post('/api/foo', newFoo, function(err, req, res, Foo){
        var assocUrl = Foo._links.associate.href.replace('{associationName}', 'foo');
        client.post(assocUrl, Foo, function(err, req, res, obj){
          client.del(assocUrl+'/'+Foo.id, function(err, req, res, obj){
            assert.equal(res.statusCode, 200, 'got a 200');
            assert.equal(obj, 'OK', 'got OK');
            done();
          });
        });
      });
    });

    it('404 on removing an non-existing base object', function(done){
      client.del('/api/foo/1/associate/foo/1', function(err, req, res, obj){
        assert.equal(res.statusCode, 404, 'not found');
        done();
      });
    });

    it('404 on removing an association that does not exist', function(done){
      var test = {name: 'test'};
      client.post('/api/foo', test, function(err, res, req, obj){
        var assocUrl = obj._links.associate.href.replace('{associationName}', 'foo');
        client.del(assocUrl+'/1', function(err, req, res, obj){
          assert.equal(res.statusCode, 404, 'not found');
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
    fs.unlink(dbProps.host, function(){
      done();
    });
  });
});
