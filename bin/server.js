const express = require('express')
const compression = require('compression')
const path = require('path')
const shell = require('shelljs')
const { prepareMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')
const debug = require('debug')('express-mustache-overlays:server')
const fs = require('fs')
const { promisify } = require('util')
const lstatAsync = promisify(fs.lstat)
const mustacheDirs = process.env.mustacheDirs ? process.env.MUSTACHE_DIRS.split(':') : []
const publicFilesDirs = process.env.publicFilesDirs ? process.env.PUBLIC_FILES_DIRS.split(':') : []
const scriptName = process.env.SCRIPT_NAME || ''
const publicURLPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
const serviceWorkerPath = process.env.SERVICE_WORKER_PATH || ''
const title = process.env.TITLE || 'Express Mustache Overlays'
const mustache = require('mustache')
const publicFilesDir = path.normalize(path.join(__dirname, '..', 'public'))
const port = process.env.PORT || 80

const main = async () => {
  const app = express()
  app.use(compression())

  const overlays = await prepareMustacheOverlays(app, { scriptName, expressStaticOptions: {}, publicURLPath, title })
  let renderView

  // Simulate user signin
  // (Use the withUser() middleware from express-mustache-jwt-signin to do this properly)
  app.use((req, res, next) => {
    req.user = { username: 'james' }
    res.locals = Object.assign({}, res.locals, { user: req.user })
    next()
  })

  overlays.overlayMustacheDir(path.join(__dirname, '..', 'views-overlay'))

  // Set up any other overlays directories here
  mustacheDirs.forEach(dir => {
    overlays.overlayMustacheDir(dir)
  })
  publicFilesDirs.forEach(dir => {
    overlays.overlayPublicFilesDir(dir)
  })

  app.get(scriptName + '/start', async (req, res, next) => {
    try {
      res.render('content', { content: '<h1>Start</h1><p>This is the page that opens first.</p>' })
    } catch (e) {
      next(e)
    }
  })

  app.get(scriptName + '/offline', async (req, res, next) => {
    try {
      const content = 'No network connection. <a href="javascript:history.back()">&lt; Go back</a> or <a href="javascript:$.pjax.reload(\'#pjax-container\', {\'timeout\': 2000, \'fragment\': \'#pjax-container\'})">try again</a>.'
      res.render('content', { content: '<h1>Error: No connection to server</h1>' + content })
    } catch (e) {
      next(e)
    }
  })

  // Change this to refresh the service worker and fetch /offline again
  app.get(serviceWorkerPath + '/sw.js', async (req, res, next) => {
    try {
      res.type('application/javascript')
      const themeDir = path.join(publicFilesDir, 'theme')
      const ls = shell.ls('-R', themeDir)
      if (shell.error()) {
        throw new Error('Could not list ' + themeDir)
      }
      const files = [scriptName + '/offline', scriptName + '/start']
      for (let filename of ls) {
        const stat = await lstatAsync(path.join(themeDir, filename))
        if (stat.isFile()) {
          files.push(publicURLPath + '/theme/' + encodeURIComponent(filename))
        }
      }
      res.send(`
// 2019-01-10
var filesToCache = ${JSON.stringify(files)};

self.addEventListener('install', function(event) {
  // event.waitUntil(self.skipWaiting())
  var promises = [];
  filesToCache.forEach(function(fileToCache) {
    var offlineRequest = new Request(fileToCache);
    console.log('Preparing fetch for', fileToCache);
    promises.push(
      fetch(offlineRequest).then(function(response) {
        return caches.open('offline').then(function(cache) {
          console.log('[oninstall] Cached offline page', response.url);
          var r = cache.put(offlineRequest, response);
          r.then(function(t) {
            console.log('Fetched', t)
          })
          return r
        });
      })
    )
  })
  event.waitUntil(Promise.all(promises).then(function(success) { self.skipWaiting() ; console.log('Finished populating the cache. Ready.'); return success }));
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request)
    .catch(function (error) {
      return caches.open('offline')
      .then(function(cache) {
        var url = new URL(event.request.url)
        var path = url.pathname
        if (filesToCache.includes(path)) {
          console.log('Returning path "' + path + '" from cache ...')
          return cache.match(path)
        } else {
          console.log('Returning "${scriptName}/offline" for path "' + path + '" since it is not in the cache ...')
          return cache.match('${scriptName}/offline')
        }
      })
    })
  );
});
`)
    } catch (e) {
      next(e)
    }
  })

  app.get('/throw', async (req, res, next) => {
    try {
      throw new Error('Sample error')
    } catch (e) {
      next(e)
    }
  })

  // Render the page, with the default title and request username as well as the content
  app.get('/', async (req, res, next) => {
    try {
      const html = await renderView('content', { content: 'render()' })
      res.render('content', { content: '<h1>Home</h1><p>Hello!</p><pre>' + mustache.escape(html) + '</pre>', metaDescription: 'Home page' })
    } catch (e) {
      next(e)
    }
  })

  // Another page
  app.get('/ok', async (req, res, next) => {
    try {
      res.render('content', { content: '<h1>OK</h1><p>OK!</p>', metaDescription: 'OK page' })
    } catch (e) {
      next(e)
    }
  })

  // Put the overlays into place after you've set up any more overlays you need, but definitely before the error handlers
  const renderers = await overlays.setup()
  renderView = renderers.renderView

  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app, { debug })
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
