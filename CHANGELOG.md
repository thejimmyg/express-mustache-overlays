# Changelog

**Note: More recent changes can be found in `README.md`.**

## 0.4.3 2019-01-19

* Added a `pjaxHandlers.mustache` partial

## 0.4.2 2019-01-19

* Added `DEFAULT_TITLE` environment variable which sets the `title` option
* Set a debug error message if the template rendering fails

## 0.4.1 2019-01-18

* Added `SIGTERM` and `SIGNINT` handlers

## 0.4.0 2019-01-18

* Add Dockerfile
* Refactored to make the `overlays` object more useful, have more re-usable code in `lib/index.js` rather than in `bin/server.js`
* Renamed `publicURLPath` to `publicUrlPath`
* Added `sharedPublicURLPath` and used it to replace `publicUrlPath` in default templates
* Renamed `offlineUrl` to `networkErrorUrl`, `OFFLINE_URL` to `NETWORK_ERROR_URL` and `/offline` to `/network-error`
* Return of `renderFile`, `renderView` and `findView` from `overlays.setup()` is deprecated. Just use them as methods on `overlays` object.
* Make `networkError.mustache` and `start.mustache`
* Make `/`, `/ok` and `/throw`  optional, defaulting to not present, but enabled by setting the environment variable `DEMO_ROUTES=true`

## 0.3.9 2019-01-12

* Added `THEME_COLOR` environment variable
* Added an `Install App` link which appears instead of Chrome Android automatically asking the user

## 0.3.8 2019-01-12

* Added `overlaysOptionsFromEnv()` function to parse all the overlays options that can be specified as environment variables.
* Added `overlaysDirsFromEnv()` function to parse the `MUSTACHE_OVERLAYS_DIRS` and `PUBLIC_FILES_DIRS` environment variables.

## 0.3.7 2019-01-12

* Some more partials JS fixes **Caution: Note that `serviceWorkerUrl` and `offlineUrl` are not escaped in the template, so make sure `SERVICE_WORKER_URL` and `OFFLINE_URL` are trusted.**

## 0.3.6 2019-01-12

* Ensured `renderView()` gets all the variables from `app.locals`
* Added `OFFLINE_URL`, `MANIFEST_URL`, `SERVICE_WORKER_URL` and `ICON_192_URL` config options
* Refactored `top.mustache` as well as the scripts partials to use the new variables

## 0.3.5 2019-01-12

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

## 0.3.4 2019-01-04

* Added a `options` to `setupErrorHandlers()` to allow `debug` to optionally be passed to the error handlers. This means errors from an app will be logged with the apps they come from, rather than from `express-mustache-overlays`.

## 0.3.3 2018-12-29

* Return `{renderFile, findView, renderView}` from `setup()`, not just the `renderFile` function. The new `renderView` function will resolve the correct template file based on its name (just like calls to `res.render()` so that you don't need to do the looking up yourself.
* Added missing `debug` import in `bin/server.js`

## 0.3.2 2018-12-29

* Wrapped the content in the `views/content.mustache` template in an `<article>` tag.

## 0.3.1 2018-12-29

* `overlays.setup()` now returns a `render(path, options)` method that can also be used outside the Express context

## 0.3.0 2018-12-21

* Split `setupMustacheOverlays(...)` into `const overlays = prepareMustacheOverlays(...)` and `overlays.setup()`
* Refactored to use `app.locals` for `title`, `publicURLPath` and `scriptName`
* Shortened the watch throttle timeout on changed partials from 500ms to 200ms
* Prevented partials reload events happening on initial load
* Added error checking from shelljs command

## 0.2.2 2018-12-20

* Changed the way environment variables are handled internally. They are used in `bin` but not in `lib` now.

## 0.2.1 2018-12-20

* Removed 403 template. Makes more sense in `express-mustache-jwt-signin`
* Refactored `bottom.mustache` to use `footer.mustache`

## 0.2.0 2018-12-20

* Refactored to support public files too as well as to host 400, 403 and 500 pages

## 0.1.4 2018-12-15

* Tweaked example to set from `MUSTACHE_DIRS` correctly

## 0.1.3 2018-12-15

* Support the `MUSTACHE_DIRS` environment variable as a `:` separated list of paths to look at first before looking in the default `views` directory
* Listen to `all` events in partials such as add and delete as well as change
* Improved logging of which partials directory is being reloaded
* Throttle reloading with `lodash._throttle` and support sub directories

## 0.1.2 2018-12-15

* Throw an error if `mustacheDirs` is not an array
* Use Flex-based templates in the example

## 0.1.1

* Reload on change

## 0.1.0

* First version
