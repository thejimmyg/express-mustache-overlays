const debug = require('debug')('express-mustache-overlays')
const mustache = require('mustache')
const fs = require('fs')
const path = require('path')
const shelljs = require('shelljs')
const chokidar = require('chokidar')
const _ = require('lodash')
const express = require('express')
const { promisify } = require('util')

const readFileAsync = promisify(fs.readFile)
const accessAsync = promisify(fs.access)
const defaultDebug = debug

const installSignalHandlers = () => {
  // Better handling of SIGINT and SIGTERM for docker
  process.on('SIGINT', function () {
    console.log('Received SIGINT. Exiting ...')
    process.exit()
  })

  process.on('SIGTERM', function () {
    console.log('Received SIGTERM. Exiting ...')
    process.exit()
  })
}

const overlaysOptionsFromEnv = () => {
  const port = process.env.PORT || 80
  const scriptName = process.env.SCRIPT_NAME || ''
  if (scriptName.endsWith('/')) {
    throw new Error('SCRIPT_NAME should not end with /.')
  }
  const title = process.env.DEFAULT_TITLE || '(no title)'
  const publicUrlPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
  const sharedPublicUrlPath = process.env.SHARED_PUBLIC_URL_PATH || publicUrlPath
  const withPjaxPwa = (process.env.WITH_PJAX_PWA || 'false').toLowerCase() === 'true'
  const networkErrorUrl = process.env.NETWORK_ERROR_URL
  const startUrl = process.env.START_URL
  const manifestUrl = process.env.MANIFEST_URL
  const serviceWorkerUrl = process.env.SERVICE_WORKER_URL
  const icon192Url = process.env.ICON_192_URL || sharedPublicUrlPath + '/theme/icon.png'
  const themeColor = process.env.THEME_COLOR
  const mustacheDirs = process.env.MUSTACHE_DIRS ? process.env.MUSTACHE_DIRS.split(':') : []
  const publicFilesDirs = process.env.PUBLIC_FILES_DIRS ? process.env.PUBLIC_FILES_DIRS.split(':') : []
  const expressStaticOptions = {}
  return { mustacheDirs, publicFilesDirs, scriptName, publicUrlPath, title, sharedPublicUrlPath, withPjaxPwa, networkErrorUrl, manifestUrl, serviceWorkerUrl, icon192Url, themeColor, expressStaticOptions, port, startUrl }
}

const loadPartials = async (mustacheDirs) => {
  const partials = {}
  if (!Array.isArray(mustacheDirs)) {
    throw Error('Expected an array of paths for mustachDirs')
  }
  mustacheDirs.reverse()
  for (let mustacheDir of mustacheDirs) {
    // Make it the same format that shelljs returns
    mustacheDir = path.normalize(mustacheDir)
    const files = shelljs.ls(path.join(mustacheDir, 'partials', '*.mustache'))
    if (shelljs.error()) {
      debug(`Error listing mustache files in '${mustacheDir}', perhaps none were found`)
    }
    if (!files.length) {
      debug('No partials found. Continuing anyway ...')
    }
    for (const filename of files) {
      const name = filename.slice((mustacheDir + '/partials/').length, filename.length - 9)
      partials[name] = await readFileAsync(filename, { encoding: 'utf8' })
    }
  }
  mustacheDirs.reverse()
  // Should match the file extension of the view.
  return partials
}

const withOverlays = async (app, options, callSetup) => {
  const { startUrl, expressStaticOptions = {}, manifestUrl, serviceWorkerUrl, icon192Url, networkErrorUrl, withPjaxPwa = false, title = 'Express Mustache Overlays', themeColor, scriptName = '', mustacheDirs = [], publicFilesDirs = [], ...scriptNameDependent } = options || {}

  const { sharedPublicUrlPath = scriptName + '/public', publicUrlPath = scriptName + '/public', ...rest } = scriptNameDependent || {};
  // Ignore known values we don't need
  ['port'].forEach((key) => { delete rest[key] })
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }
  if (publicUrlPath.endsWith('/')) {
    throw new Error('The publicUrlPath option must not end with "/"')
  }
  if (sharedPublicUrlPath.endsWith('/')) {
    throw new Error('The sharedPublicUrlPath option must not end with "/"')
  }
  if (scriptName.endsWith('/')) {
    throw new Error('SCRIPT_NAME should not end with /.')
  }
  const self = {
    finalMustacheDirs: [],
    finalPublicFilesDirs: [],
    locals: { publicUrlPath, sharedPublicUrlPath, expressStaticOptions, manifestUrl, serviceWorkerUrl, icon192Url, networkErrorUrl, withPjaxPwa, title, themeColor, scriptName },
    overlayMustacheDir: function (mustacheDir) {
      this.finalMustacheDirs.splice(0, 0, path.normalize(mustacheDir))
    },
    overlayPublicFilesDir: function (publicFilesDir) {
      this.finalPublicFilesDirs.splice(0, 0, path.normalize(publicFilesDir))
    },
    setup: async function ({ debug }) {
      mustacheDirs.forEach(dir => {
        self.overlayMustacheDir(dir)
      })
      publicFilesDirs.forEach(dir => {
        self.overlayPublicFilesDir(dir)
      })
      debug(`Using these public files directories at ${this.locals.publicUrlPath} in order of preference: ${this.finalPublicFilesDirs}`)
      for (const dir of this.finalPublicFilesDirs) {
        debug(this.locals.publicUrlPath, '->', dir)
        app.use(this.locals.publicUrlPath, express.static(dir, this.locals.expressStaticOptions))
      }
      debug('Using these mustache views directories in order of preference:', this.finalMustacheDirs)
      let partials = await loadPartials(this.finalMustacheDirs)
      const partialsDirs = []
      const partialsDirsMustacheGlobs = []
      for (let mustacheDir of this.finalMustacheDirs) {
        partialsDirs.push(path.join(mustacheDir, 'partials'))
        partialsDirsMustacheGlobs.push(path.join(mustacheDir, 'partials', '**', '*.mustache'))
      }
      // Look for changes to partials directories, and reload if needed
      debug('Watching these globs:', partialsDirsMustacheGlobs.join(','))
      const onEvent = async (event, path) => {
        debug(`Reloading partials due to ${event} on ${path} ...`)
        partials = await loadPartials(this.finalMustacheDirs)
      }
      const throttledEvent = _.throttle(onEvent, 200, { 'trailing': true, 'leading': false })
      chokidar.watch(partialsDirsMustacheGlobs, { ignoreInitial: true, ignored: /(^|[/\\])\../ }).on('all', throttledEvent)
      const renderFile = async (filePath, options, callback) => {
        const content = await readFileAsync(filePath, { encoding: 'utf8' })
        const rendered = mustache.render(content, Object.assign({}, app.locals, options), partials)
        return rendered
      }
      app.engine('mustache', function (filePath, options, callback) {
        renderFile(filePath, options)
          .then((rendered) => {
            callback(null, rendered)
          })
          .catch((e) => {
            debug('Error rendering the template:', e)
            callback(e, null)
          })
      })
      // Undocumented behaviour, but if given a list of dirs, will check them in order, which is what we want
      app.set('views', this.finalMustacheDirs)
      app.set('view engine', 'mustache')
      const findView = async (template) => {
        let templatePath
        for (let i = 0; i < this.finalMustacheDirs.length; i++) {
          const filePath = path.join(this.finalMustacheDirs[i], template + '.mustache')
          try {
            await accessAsync(filePath, fs.constants.R_OK)
            templatePath = filePath
            break
          } catch (e) {
            // Can't access the file
          }
        }
        if (!templatePath) {
          throw new Error(`Template '${template}' not found`)
        }
        return templatePath
      }
      const renderView = async (template, options) => {
        return renderFile((await findView(template)), options)
      }
      this.renderFile = renderFile
      this.renderView = renderView
      this.findView = findView
      // Deprecated, just use overlays.renderView etc
      return { renderFile, renderView, findView }
    }
  }
  app.locals = Object.assign({}, app.locals, self.locals)
  self.overlayMustacheDir(path.join(__dirname, '..', 'views'))
  self.overlayPublicFilesDir(path.join(__dirname, '..', 'public'))
  callSetup(self)
  await self.setup({ debug })
}

const setupErrorHandlers = async (app, options) => {
  const { debug = defaultDebug, scriptName = '', ...rest } = options || {}
  if (Object.keys(rest).length) {
    throw new Error(`Unexpected options passed to setupErrorHandlers(): ${Object.keys(rest).join(', ')}.`)
  }

  // Must be after other routes - Handle 404
  app.get(scriptName + '/*', (req, res) => {
    res.status(404)
    res.render('404')
  })

  // Error handler has to be last
  app.use(scriptName + '/*', function (err, req, res, next) {
    debug(err)
    res.status(500)
    try {
      res.render('500')
    } catch (e) {
      debug('Error during rendering 500 page:', e)
      res.send('Internal server error.')
    }
  })
}

const overlaysApp = async (app, overlays, { demoRoutes = false, scriptName = '', ...other }, {debug=defaultDebug}) => {
  const { startUrl = scriptName + '/start', networkErrorUrl = scriptName + '/network-error', ...rest } = other
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }

  app.locals = Object.assign(app.locals, { demoRoutes })

  overlays.overlayMustacheDir(path.join(__dirname, '..', 'views-overlay'))

  debug('Mounting overlays app at', scriptName)

  app.get(startUrl, async (req, res, next) => {
    try {
      res.render('start', { })
    } catch (e) {
      next(e)
    }
  })

  app.get(networkErrorUrl, async (req, res, next) => {
    try {
      res.render('networkError', {})
    } catch (e) {
      next(e)
    }
  })

  if (demoRoutes) {
    app.get(scriptName + '/throw', async (req, res, next) => {
      try {
        throw new Error('Sample error')
      } catch (e) {
        next(e)
      }
    })

    // Render the page, with the default title and request username as well as the content
    app.get(scriptName + '/', async (req, res, next) => {
      try {
        const html = await overlays.renderView('content', { content: 'render()', metaDescription: 'Home page' })
        res.render('content', { content: '<h1>Home</h1><p>Hello!</p><pre>' + mustache.escape(html) + '</pre>', metaDescription: 'Home page' })
      } catch (e) {
        next(e)
      }
    })

    // Another page
    app.get(scriptName + '/ok', async (req, res, next) => {
      try {
        res.render('content', { content: '<h1>OK</h1><p>OK!</p>', metaDescription: 'OK page' })
      } catch (e) {
        next(e)
      }
    })
  }
}

module.exports = { installSignalHandlers, overlaysApp, withOverlays, setupErrorHandlers, overlaysOptionsFromEnv }
