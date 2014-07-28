# REST-ORM-ify
A package designed to easily expose [node-orm2](https://github.com/dresende/node-orm2) models as REST interface using [node-restify](https://github.com/mcavage/node-restify). Requires the use of the `restify.bodyParser` middleware.

Does not currently support relations (coming soon).

This has been tested against:

    "orm": "~2.1.17",
    "restify": "~2.8.1",

## Installation

```
npm i restormify
```

## Usage

```js
var restify = require('restify');
var orm = require('orm');
var restormify = require('restormify');

var server = restify.createServer();
server.use(restify.bodyParser());
orm.connect('some/db/string', function(err, db){
  db.define('todo', {
    task: String,
    completed: Boolean,
    deleted: {type: 'boolean', serverOnly: true},
    hiddenValue: {type: text, serverOnly: true}
  });
  db.sync('models', function(){
    
    restormify({
      db: db,
      server: server,
      apiBase: 'api',
      deletedColumn: 'deleted',
      allowAccess: function(req, method, resourceName, resourceId){
        return true;
      }
    });

    // OR:

    restormify(database, server);

    server.listen(3000);  
  });
});
```

This will expose `todo` as `/api/todo` responding to:

* `GET /api/todo`
* `GET /api/todo/[id]`
* `POST /api/todo`
* `PUT /api/todo/[id]`
* `PATCH /api/todo/[id]`
* `DELETE /api/todo/[id]`

## Options

The default options are:

```js
{
    apiBase: 'api',
    deletedColumn: 'deleted',
    allowAccess: function(){
      return true;
    }
  }
}
```

`options.apiBase`: what all requests to your API will be prefixed with.
`options.deletedColumn`: the name of the column to flag a piece of content as deleted. If set to `false` it **will destroy data in your database**
`options.allowAccess`: This method is called on each request. Returning `false` will return `401: Not authorized` to the client. It is passed in the restify `req` object, the name of the resource (and any ID), along with the HTTP method.

## Testing

```
> npm test

> restormify@0.0.1 test /Users/todd/src/restormify
> for spec in `ls test/*spec.js`; do mocha -R tap $spec; done;

1..8
ok 1 actually delete api baz should return nothing on a get returns a 401 error
ok 2 actually delete api creates a user returns a 401 error
ok 3 actually delete api returns a created user returns a 401 error
ok 4 actually delete api returns all created users returns a 401 error
ok 5 actually delete api updating a user (PUT) returns a 401 error
ok 6 actually delete api updating a user (PATCH) returns a 401 error
ok 7 actually delete api rejecting a delete via PUT/PATCH returns a 401 error
ok 8 actually delete api deleting an object returns a 401 error
# tests 8
# pass 8
# fail 0
1..2
ok 1 access denied api rejecting a delete via PUT/PATCH
ok 2 access denied api deleting an object
# tests 2
# pass 2
# fail 0
1..8
ok 1 multiple arity api baz should return nothing on a get
ok 2 multiple arity api creates a user
ok 3 multiple arity api returns a created user
ok 4 multiple arity api returns all created users
ok 5 multiple arity api updating a user (PUT)
ok 6 multiple arity api updating a user (PATCH)
ok 7 multiple arity api rejecting a delete via PUT/PATCH
ok 8 multiple arity api deleting an object
# tests 8
# pass 8
# fail 0
1..8
ok 1 single arity api baz should return nothing on a get
ok 2 single arity api creates a user
ok 3 single arity api returns a created user
ok 4 single arity api returns all created users
ok 5 single arity api updating a user (PUT)
ok 6 single arity api updating a user (PATCH)
ok 7 single arity api rejecting a delete via PUT/PATCH
ok 8 single arity api deleting an object
# tests 8
# pass 8
# fail 0
```

## License
restormify is ©2014 Todd Kennedy. Available for use under the [MIT License](LICENSE).
