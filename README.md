[![build status](https://secure.travis-ci.org/toddself/restormify.png)](http://travis-ci.org/toddself/restormify)

# REST-ORM-ify
A package designed to easily expose [node-orm2](https://github.com/dresende/node-orm2) models as REST interface using [node-restify](https://github.com/mcavage/node-restify). Requires the use of the `restify.bodyParser` middleware.

The API will generate a [HAL-compliant](http://stateless.co/hal_specification.html) REST interface allowing for abitrary content association and better automation for interacting with objects.

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
    }, function(err, relationsModel){
      server.listen(3000);
    });
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

```
> curl -X POST -H 'Content-type: application/json' -d '{"task": "Write tests", "completed": false}' myapi.com/api/todo

{
  "id": 1,
  "task": "Write tests",
  "completed": false,
  "_links": {
    "self": {
      "href": "/api/todo/1",
      "type": "todo"
    },
    "associations": {
      "href": "/api/todo/1/associations"
    },
    "associate": {
      "href": "/api/todo/1/{associatioName}",
      "templated": "true"
    }
  }
}
```

It will also allow you to associate content, and retrieve those associations, as well as information about the resource being retrieved.

```
curl -X POST -H 'Content-type: application/json' myapi.com/api/todo/1/assocate/todo -d '{"id": 1,"task": "Write tests","completed": false,"_links": {"self": {"href": "/api/todo/1","type": "todo"},"associations": {"href": "/api/todo/1/associations"},"associate": {"href": "/api/todo/1/{associatioName}","templated": "true"}}}'

{
  todo: [
    {
      "id": 1,
      "task": "Write tests",
      "completed": false,
      "_links": {
        "self": {
          "href": "/api/todo/1",
          "type": "todo"
        },
        "associations": {
          "href": "/api/todo/1/associations"
        },
        "associate": {
          "href": "/api/todo/1/{associatioName}",
          "templated": "true"
        }
      }
    }
  ]
}
```

## API

The default options are:

`restormify(opts, callback)`

### `opts`

```js
{
    apiBase: 'api',
    deletedColumn: 'deleted',
    allowAccess: function(){
      return true;
    },
    logger: server.logger
}
```

`options.apiBase`: what all requests to your API will be prefixed with.
`options.deletedColumn`: the name of the column to flag a piece of content as deleted. If set to `false` it **will destroy data in your database**
`options.allowAccess`: This method is called on each request. Returning `false` will return `401: Not authorized` to the client. It is passed in the restify `req` object, the name of the resource (and any ID), along with the HTTP method.
`options.logger`: Specify a [bunyan](https://github.com/trentm/node-bunyan) logger function to use. Defaults to `default` (which uses the logger available from restify object), `false` will disable logging.

### `callback(err, relationsModel)`

When the system has finished initlizing it'll call this with the db instance to the relations table or an error if any.

## Tests and Coverage

`npm test`
`npm test-coverage`

## License
restormify is ©2014 Todd Kennedy. Available for use under the [MIT License](LICENSE).

