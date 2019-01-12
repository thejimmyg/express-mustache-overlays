# Express Mustache Overlays

Some key features of this particular [Express](https://expressjs.com) and [Mustache](https://mustache.github.io) integration:

* Loads partials from a `partials` subdirectory of a view directory and made available to the template based on their name (e.g. `partials/top.mustache` can be used as `{{>top}}`)
* Reloads views or partials when you make a change
* Searches in a series of view directories in turn for each template or partial, effectively allowing you to *overlay* one view directory on another
* Demonstrates how to use template defaults that can also take information from the Express request
* Can also be used to overlay public static files required by the views and partials
* Provides a basic Bootstrap Flex layout, `400`, `500` and `content` templates and `top` and `bottom` partials
* Sets `publicURLPath`, `scriptName`, and `title` on `app.locals` (and `res.locals` for access by views during requests)

## Customize

In `public/theme` you'll find a `manifest.json` file and `icon.png` that you'll want to override in your own public overlay.

## Configuration

Configuration environment variables for the example.

* `MUSTACHE_DIRS` - A `:` separated list of directories to overlay on top of the default views provided by `express-mustache-overlays`
* `PUBLIC_FILE_DIRS` - A `:` separated list of directories to overlay on top of the default publis static files provided by `express-mustache-overlays`
* `DEBUG` - Include `express-mustache-overlays` to get debug output from the `express-mustache-overlays` library itself and `express-mustache-overlays:server` for messages from the example server.
* `PORT` - Defaults to 80, but set it to something like 8000 if you want to run without needing `sudo`
* `SCRIPT_NAME` - Where the app that uses this is located. The public files will be served from `${SCRIPT_NAME}/public` by default
* `PUBLIC_URL_PATH` - the full URL path to the public files directory
* `WITH_PJAX_PWA` - can be `"true"` if you want to enable progressive web app features for use with `gateway-lite` or `"false"` otherwise. Defaults to `"false"`. This affects the content of `views/partials/bodyEnd.mustache`
* `OFFLINE_URL` - if using `WITH_PJAX_PWA`, this is the URL that will be fetched to use when there is no internet connection. The links to the scripts it needs to render correctly should be cached by the service worker that is installed.
* `MANIFEST_URL` - if using `WITH_PJAX_PWA`, this is the URL to your `manifest.json` file
* `SERVICE_WORKER_URL` - if using `WITH_PJAX_PWA`, this is the URL to your `sw.js` file
* `ICON_192_URL` - the URL to a 192x192 PNG file to use as the icon

Some of these can all be overriden when you set up mustache. For example:

`mustacheDirs: []`, `publicFilesDirs: []`, `scriptName='/some/path'`

There is also `publicURLPath` option that allows you to specify the full path that the public files directories should be hosted at. `publicURLPath` is NOT relative to `SCRIPT_NAME` so you need to set it carefully if you don't like the default. And there is `expressStaticOptions` which is passed directly to `express.static` as its second parameter in case you want to configure express.

Here's the code of the example that makes use of this:

```
const debug = require('debug')('express-mustache-overlays:server')
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
  await overlays.setup()

  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app, { debug })
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
```

## Error handling

Make sure you pass an optional `debug` function to `setupErrorHandlers(app, {debug})` in a third party app, since otherwise the traceback will be logged under `express-mustache-overlays` rather than whatever name is the default in your other project. If this is what you want, just make sure you set `DEBUG=express-mustache-overlays` when running your app so that messages from your app appear in the log output.

There is a `/throw` endpoint in the sample server so you can test this behaviour.

## Example

This example serves templates from `views` and partials from `views/partials`:

```
npm install
MUSTACHE_DIRS=overlay DEBUG=express-mustache-overlays,express-mustache-overlays:server PORT=8000 npm start
```

Visit http://localhost:8000

To use this as part of a PJAX progressive web app setup:

```
MUSTACHE_DIRS=overlay DEBUG=express-mustache-overlays,express-mustache-overlays:server WITH_PJAX_PWA=true OFFLINE_URL="/offline" MANIFEST_URL="/public/theme/manifest.json" SERVICE_WORKER_URL="/sw.js" ICON_192_URL="/public/theme/icon192.png" PORT=8000 npm start
```


To run this behind an HTTPS proxy, you could install Gateway Lite (`npm install -g gateway-lite`), configure a self-signed HTTPS certificate and then add it to your OS keychain, then run:

```
DEBUG=gateway-lite gateway-lite --https-port 443 --port 80 --cert domain/www.example.localhost/sni/cert.pem --key domain/www.example.localhost/sni/key.pem --domain domain --user='{"www.example.localhost": {"hello": "eyJoYXNoIjoiU2xkK2RwOGx3cFM1WDJzTHlnTUxmOXhNTlZ5NHV5UjZwK3pQTGhNLzJqMVRlRTF5Q1AxbURzQkpvSTFKRlBSd3V1akIrcng0aDhxNlJBNXRuRVlWUVNpWiIsInNhbHQiOiIwU3NIZnJDMEY1OUZZQmhHSnRKb2QvN3NMTzh3Um82Wm5mTnl6VThIeHYyV2FrdWd6dDhZc09nSDJwUHBiMnAxQlczU1BTWDN5L29GczlaN1NqTktpc2h3Iiwia2V5TGVuZ3RoIjo2NiwiaGFzaE1ldGhvZCI6InBia2RmMiIsIml0ZXJhdGlvbnMiOjcyNjIzfQ=="}}' --proxy='{"www.example.localhost": [["/", "localhost:8000/", {"auth": false}]]}' --redirect='{"www.example.localhost": {"/some-path": "/"}}'
```


## Dev

```
npm run fix
```

## Changelog

### 0.3.7 2019-01-12

* Some more partials JS fixes **Caution: Note that `serviceWorkerUrl` and `offlineUrl` are not escaped in the template, so make sure `SERVICE_WORKER_URL` and `OFFLINE_URL` are trusted.**

### 0.3.6 2019-01-12

* Ensured `renderView()` gets all the variables from `app.locals`
* Added `OFFLINE_URL`, `MANIFEST_URL`, `SERVICE_WORKER_URL` and `ICON_192_URL` config options
* Refactored `top.mustache` as well as the scripts partials to use the new variables

### 0.3.5 2019-01-12

* Made the default template behave as a single page app using PJAX and a service worker, and added URLs that are needed to serve this as a progressive web app via `gateway-lite`
  * Added a wrapper `pjax-container` to the entire body of the template
  * Changed from jQuery slim to normal jQuery
  * Introduced jQuery PJAX so that full page reloads aren't required as you navigate, instead the `<div id="pjax-container">` content is replaced into the existing div. **Caution: This means extra infomtation in the `<head>` or reloaded outside `<div id="pjax-container">` will not be loaded
  * Added PJAX initialisation that installs a `pjax:error` handler which inserts a simple you are offline message
  * Added a `/offline` route to `bin/server.js` to generate a simple offline message page
  * Changed `<meta name="apple-mobile-web-app-capable" content="yes">` to `no` since apple still doesn't handle PWAs very well (cookies are lost as users switch to a different app and back).
  * Removed `manifest.json` and the icons as they can now be served by gateway-lite instead
  * WONT Support PJAX container-only HTML responses - makes the cacheing of the responses by service worker more complex.
  * Changed partial structure so that there are more overrides possible
  * Added gzip compresssion to the example
  * Setting the `metaDescription` local to a string results in a meta description tag being added for SEO
  * Make the PJAX offline message the same as the one in the service worker cache by fetching that page with an AJAX call.
  * Add online/offline handlers as a partial
  * Create a `/start` URL that is used when the app starts.
  * By default the service worker install, uninstall, pjax and install prompt are all disabled in `views/partials/bodyEnd.mustache` with the use of the `!` (a mustache comment) in the partial includes.


### 0.3.4 2019-01-04

* Added a `options` to `setupErrorHandlers()` to allow `debug` to optionally be passed to the error handlers. This means errors from an app will be logged with the apps they come from, rather than from `express-mustache-overlays`.

### 0.3.3 2018-12-29

* Return `{renderFile, findView, renderView}` from `setup()`, not just the `renderFile` function. The new `renderView` function will resolve the correct template file based on its name (just like calls to `res.render()` so that you don't need to do the looking up yourself.
* Added missing `debug` import in `bin/server.js`

### 0.3.2 2018-12-29

* Wrapped the content in the `views/content.mustache` template in an `<article>` tag.

### 0.3.1 2018-12-29

* `overlays.setup()` now returns a `render(path, options)` method that can also be used outside the Express context

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
