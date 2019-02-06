# Express Mustache Overlays

Serves mustache templates and partials, checking each directory in turn for matches, and reloading on file changes.


## Configuration

Configuration environment variables for the example.

* `MUSTACHE_DIRS` - A `:`-separated list of directories to check for templates e.g. `mustache-overlay:mustache`.

**Any configuration from `MUSTACHE_DIRS` gets merged into existing configuration such that it is used in preference to it. Effecrtively, the `MUSTACHE_DIRS` settings override settings defined in code.**

Additionally:

* `DEBUG` - Include `express-mustache-overlays` to get debug output from the `express-mustache-overlays` library itself and `express-mustache-overlays:server` for messages from the example server.


## Internal Workings

Internally, the code is designed to work in these stages:

* `mustacheFromEnv(app)` - Parses and returns the config from the `MUSTACHE_DIRS` environment variable
* `prepareMustache(app, userDirs, libDirs)` - Sets up the `app.locals.mustache` data structure and makes `app.locals.mustache.overlay()` available (see next). `userDirs` and `libDirs` are optional. You usually pass the output of `mustacheFilesFromEnv(app)` as the `userDirs` variable and any mustache files directoires your library needs as the `libDirs` setting.
* `app.locals.mustache.overlay(dirs)` - A function other libraries can use to merge any overlays they need into the `libDirs` configuration. The `userDirs` configuration will always overlay over the `libDirs` configuration, even if it is set up earlier.
* `setupMustache(app)` - Installs the middleware based on the settings in `app.locals.mustache`. This should always come last.

### Accessing the Overlays Object

You can access the overlays object like this once `prepareMustache()` is called:

```
app.locals.mustache.overlaysPromise.then((overlays) => {
  // Use overlays here
})
```

Ordinarily you wouldn't need this, but the object can be useful if you want to use the template system outside of Express.

The `overlays` object from the promise has these methods:

* `findView(template)` - async function (requires `await` when called) which resolves to the path on the filesystem of the view
* `renderView(template, options)` - async function (requires `await` when called) which resolves to the template named `template`, rendered with `options`. E.g. `const html = await renderView('content', {content: 'hello'})`
* `renderFile(path, options)` - async function (requires `await` when called) which resolves takes the `path` as the full path to the mustache template, and the same `options` as `renderView()`.

## Example

```
DEBUG="express-mustache-overlays,express-mustache-overlays:server" npm start
```

Visit http://localhost:8000/ and you'll see `Hello world!` served from `./bin/mustache/hello.mustache` and `./bin/mustache/partials/world.mustache`.

If you specify `MUSTACHE_DIRS` too, the directories specified will be used in preference.

In the next example, templates will first be searched for in `./bin/mustache` and then be searched for in `./bin/mustache-overlay`. You can try moving or deleting the files in those directories to see the behaviour in action:

```
DEBUG="express-mustache-overlays,express-mustache-overlays:server" MUSTACHE_DIRS="./bin/mustache-overlay" npm start
```

Visit http://localhost:8000/ this time and you'll see `Goodbye world!` with the `hello.mustache` template served from `./bin/mustache-overlay/hello.mustache` but the `world.mustache` partial coming from `./bin/mustache/partials`.

If you delete, move or change files, the overlays will automatically reflect your changes so free free to experiment.


## Dev

```
npm run fix
npm run "docker:build"
npm run "docker:run"
npm run "docker:push"
```


## Changelog

### 0.5.0 2019-02-06

* Complete refactor. See old `CHANGELOG.md` for older changes. Removed all functionality apart from the overlays behaviour. See `express-public-files-overlays` for static file serving.
