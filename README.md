# Express Mustache Overlays

Serves mustache templates and partials, checking each directory in turn for matches, and reloading on file changes.


## Configuration

The components in this package make use of the `app.locals.mustache` namespace. The `prepareMustache()` function helps set up the data structure correctly.

Configuration environment variables for the example.

* `MUSTACHE_DIRS` - A `:`-separated list of directories to check for templates e.g. `mustache-overlay:mustache`.

**Any configuration from `MUSTACHE_DIRS` gets merged into existing configuration such that it is used in preference to it. Effectively, the `MUSTACHE_DIRS` settings override settings defined in code.**

Additionally:

* `DEBUG` - Include `express-mustache-overlays` to get debug output from the `express-mustache-overlays` library itself and `express-mustache-overlays:server` for messages from the example server. Also include `express-public-files-overlays` to get debug from the public files server in the example.


## Internal Workings

Internally, the code is designed to work in these stages:

* `mustacheFromEnv(app)` - Parses and returns the config from the `MUSTACHE_DIRS` environment variable
* `prepareMustache(app, userDirs)` - Sets up the `app.locals.mustache` data structure with a `userDirs` and a `libDirs` key and makes `app.locals.mustache.overlay()` available (see next). The `userDirs` argument is optional. You usually pass the output of `mustacheFromEnv(app)` as the `userDirs` variable. Any library directories (that should be used if a match can't be found in the `userDirs`) can be set up using `overlay()` described next to add them into `libDirs`.
* `app.locals.mustache.overlay(dirs)` - A function other libraries can use to merge any overlays they need into the `libDirs` configuration. The `userDirs` configuration will always overlay over the `libDirs` configuration, even if it is set up earlier.
* `setupMustache(app)` - Installs the middleware based on the settings in `app.locals.mustache`. This should always come last.

Internally a watch is set up using `chokidar` on any partials that are present
so that the updated contents can be used by the templates. Since templates (but
not partials) are read each time they are rendered, the watches are only added
to the partials since the latest template content will be rendered anyway.

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
const express = require('express')
const path = require('path')
const { prepareMustache, setupMustache, mustacheFromEnv } = require('../index.js')

const app = express()
prepareMustache(app, mustacheFromEnv(app))

// Any other express setup can change app.locals.mustache.libDirs here to add
// additional library-defined public files directories to be served.  Any user
// defined directories will be prepended before any corresponding URL path in
// the library directories list. The safest way to add overlays is with the
// overlay() function demonstrated here.
app.locals.mustache.overlay([path.join(__dirname, 'mustache')])

// Add any routes here:
app.get('', (req, res) => {
  res.render('hello', {})
})

// Set up the engine
const mustacheEngine = setupMustache(app)
app.engine('mustache', mustacheEngine)
app.set('views', app.locals.mustache.dirs)
app.set('view engine', 'mustache')

app.listen(8000, () => console.log(`Example app listening on port 8000`))
```

The `mustache` directory contains a `hello.mustache` template.

See the `./example` directory for an example.

```
cd example
npm install
```

Then follow the instructions in the `README.md` in the `example` directory.


## Dev

```
npm run fix
```


## Changelog

### 0.5.3 2019-02-15

* Doc fixes
* Changed `prepareMustache = (app, userDirs, libDirs)` -> `prepareMustache = (app, userDirs)`
* Added a warning if directories don't exist

### 0.5.2 2019-02-07

* Don't throw an error in the renderer, it creates an `UnhandledPromiseRejectionWarning`. Calling the callback with an error is enough?
* Improved the Docker example
* Improved logging

### 0.5.1 2019-02-07

* Changed debug behaviour to use own `debug()`, not `app.locals.debug()`.
* Moved the example to `./example`.

### 0.5.0 2019-02-06

* Complete refactor. See old `CHANGELOG.md` for older changes. Removed all functionality apart from the overlays behaviour. See `express-public-files-overlays` for static file serving.
