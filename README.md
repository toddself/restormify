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
    restormify(db, server, 'api');
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

If you add the property `deleted` to your model, it will use this as a flag to mark deletion, without actually deleting the content from the database. If this property is not defined, it will destructively (and uncoverably) delete that resource from your database

## Testing

```
> npm test

> restormify@0.0.0 test /Users/todd/src/restormify
> mocha -R tap test/*spec.js

1..8
ok 1 api baz should return nothing on a get
ok 2 api creates a user
ok 3 api returns a created user
ok 4 api returns all created users
ok 5 api updating a user (PUT)
ok 6 api updating a user (PATCH)
ok 7 api rejecting a delete via PUT/PATCH
ok 8 api deleting an object
# tests 8
# pass 8
# fail 0
```

## License
restormify is ©2014 Todd Kennedy. Available for use under the [MIT License](LICENSE).
