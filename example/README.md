# Example

```
DEBUG="express-mustache-overlays" npm start
```

Visit http://localhost:8000/ and you'll see `Hello world!` served from `./mustache/hello.mustache` and `./mustache/partials/world.mustache`.

If you specify `MUSTACHE_DIRS` too, the directories specified will be used in preference.

In the next example, templates will first be searched for in `./mustache` and then be searched for in `./mustache-overlay`. You can try moving or deleting the files in those directories to see the behaviour in action:

```
DEBUG="express-mustache-overlays" MUSTACHE_DIRS="./mustache-overlay" npm start
```

Visit http://localhost:8000/ this time and you'll see `Goodbye world!` with the `hello.mustache` template served from `./bin/mustache-overlay/hello.mustache` but the `world.mustache` partial coming from `./bin/mustache/partials`.

If you delete, move or change files, the overlays will automatically reflect your changes so free free to experiment.


## Dev

```
npm run fix
```

## Docker

Install the published package first:

```
npm install --save express-mustache-overlays
npm run "docker:build"
npm run "docker:run"
npm run "docker:push"
```
