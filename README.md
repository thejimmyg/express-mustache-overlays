# Express Mustache Overlays

Some key features of this particular [Express](https://expressjs.com) and [Mustache](https://mustache.github.io) integration:

* Loads partials from a `partials` subdirectory of a view directory and made available to the template based on their name (e.g. `partials/top.mustache` can be used as `{{>top}}`)
* Reloads views or partials when you make a change
* Searches in a series of view directories in turn for each template or partial, effectively allowing you to *overlay* one view directory on another
* Demonstrates how to use template defaults that can also take information from the Express request
* Can also be used to overlay public static files required by the views and partials
* Provides a basic Bootstrap Flex layout, `400`, `500` and `content` templates and `top` and `bottom` partials
* Sets `publicURLPath`, `scriptName`, and `title` on `app.locals` (and `res.locals` for access by views during requests)

## Configuration

Configuration environment variables for the example.

* `MUSTACHE_DIRS` - A `:` separated list of directories to overlay on top of the default views provided by `express-mustache-overlays`
* `PUBLIC_FILE_DIRS` - A `:` separated list of directories to overlay on top of the default publis static files provided by `express-mustache-overlays`
* `DEBUG` - Include `express-mustache-overlays` to get debug output from `express-mustache-overlays`
* `SCRIPT_NAME` - Where the app that uses this is located. The public files will be served from `${SCRIPT_NAME}/public` by default
* `PUBLIC_URL_PATH` - the full URL path to the public files directory

Some of these can all be overriden when you set up mustache. For example:

`mustacheDirs: []`, `publicFilesDirs: []`, `scriptName='/some/path'`

There is also `publicURLPath` option that allows you to specify the full path that the public files directories should be hosted at. `publicURLPath` is NOT relative to `SCRIPT_NAME` so you need to set it carefully if you don't like the default. And there is `expressStaticOptions` which is passed directly to `express.static` as its second parameter in case you want to configure express.

Here's the code of the example that makes use of this:

```
const express = require('express')
const { prepareMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')

const mustacheDirs = process.env.mustacheDirs ? process.env.MUSTACHE_DIRS.split(':') : []
const publicFilesDirs = process.env.publicFilesDirs ? process.env.PUBLIC_FILES_DIRS.split(':') : []
const scriptName = process.env.SCRIPT_NAME || ''
const publicURLPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
const title = process.env.TITLE || 'Express Mustache Overlays'

const main = async () => {
  const app = express()
  const port = process.env.PORT || 80

  const overlays = await prepareMustacheOverlays(app, { mustacheDirs, publicFilesDirs, scriptName, expressStaticOptions: {}, publicURLPath, title })

  // Simulate user signin
  // (Use the withUser() middleware from express-mustache-jwt-signin to do this properly)
  app.use((req, res, next) => {
    req.user = { username: 'james' }
    res.locals = Object.assign({}, res.locals, { user: req.user })
    next()
  })

  // Set up any other overlays directories here
  mustacheDirs.forEach(dir => {
    overlays.overlayMustacheDir(dir)
  })
  publicFilesDirs.forEach(dir => {
    overlays.overlayPublicFilesDir(dir)
  })

  // Render the page, with the default title and request username as well as the content
  app.get('/', (req, res) => {
    res.render('content', { content: '<h1>Home</h1><p>Hello!</p>' })
  })

  // Put the overlays into place after you've set up any more overlays you need, but definitely before the error handlers
  overlays.setup()

  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app)
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
```

## Example

This example serves templates from `views` and partials from `views/partials`:

```
npm install
MUSTACHE_DIRS=overlay DEBUG=express-mustache-overlays PORT=8000 npm start
```

Visit http://localhost:8000

Example configuration:

* Same options as Library configuration described above plus...
* `PORT` - Defaults to 80, but set it to something like 8000 if you want to run without needing `sudo`

## Dev

```
npm run fix
```

## Changelog

### 0.3.0 2018-12-21

* Split `setupMustacheOverlays(...)` into `const overlays = prepareMustacheOverlays(...)` and `overlays.setup()`
* Refactored to use `app.locals` for `title`, `publicURLPath` and `scriptName`
* Shortened the watch throttle timeout on changed partials from 500ms to 200ms
* Prevented partials reload events happening on initial load
* Added error checking from shelljs command

### 0.2.2 2018-12-20

* Changed the way environment variables are handled internally. They are used in `bin` but not in `lib` now.

### 0.2.1 2018-12-20

* Removed 403 template. Makes more sense in `express-mustache-jwt-signin`
* Refactored `bottom.mustache` to use `footer.mustache`

### 0.2.0 2018-12-20

* Refactored to support public files too as well as to host 400, 403 and 500 pages

### 0.1.4 2018-12-15

* Tweaked example to set from `MUSTACHE_DIRS` correctly

### 0.1.3 2018-12-15

* Support the `MUSTACHE_DIRS` environment variable as a `:` separated list of paths to look at first before looking in the default `views` directory
* Listen to `all` events in partials such as add and delete as well as change
* Improved logging of which partials directory is being reloaded
* Throttle reloading with `lodash._throttle` and support sub directories

### 0.1.2 2018-12-15

* Throw an error if `mustacheDirs` is not an array
* Use Flex-based templates in the example

### 0.1.1

* Reload on change

### 0.1.0

* First version
