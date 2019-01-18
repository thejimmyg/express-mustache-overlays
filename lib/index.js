const debug = require('debug')('express-mustache-overlays')
const fs = require('fs')
const mustache = require('mustache')
const path = require('path')
const shelljs = require('shelljs')
const chokidar = require('chokidar')
const _ = require('lodash')
const express = require('express')
const { promisify } = require('util')

const readFileAsync = promisify(fs.readFile)
const accessAsync = promisify(fs.access)
const defaultDebug = debug

const overlaysDirsFromEnv = () => {
  const mustacheDirs = process.env.MUSTACHE_DIRS ? process.env.MUSTACHE_DIRS.split(':') : []
  const publicFilesDirs = process.env.PUBLIC_FILES_DIRS ? process.env.PUBLIC_FILES_DIRS.split(':') : []
  return { mustacheDirs, publicFilesDirs }
}

const overlaysOptionsFromEnv = () => {
  const scriptName = process.env.SCRIPT_NAME || ''
  if (scriptName.endsWith('/')) {
    throw new Error('SCRIPT_NAME should not end with /.')
  }
  const publicUrlPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
  const sharedPublicUrlPath = process.env.SHARED_PUBLIC_URL_PATH || publicUrlPath
  const withPjaxPwa = (process.env.WITH_PJAX_PWA || 'false').toLowerCase() === 'true'
  const networkErrorUrl = process.env.NETWORK_ERROR_URL || ''
  const manifestUrl = process.env.MANIFEST_URL || ''
  const serviceWorkerUrl = process.env.SERVICE_WORKER_URL || ''
  const icon192Url = process.env.ICON_192_URL || sharedPublicUrlPath + '/theme/icon.png'
  const themeColor = process.env.THEME_COLOR || ''
  return { scriptName, publicUrlPath, sharedPublicUrlPath, withPjaxPwa, networkErrorUrl, manifestUrl, serviceWorkerUrl, icon192Url, themeColor }
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

const prepareMustacheOverlays = async (app, options) => {
  const { expressStaticOptions = {}, manifestUrl, serviceWorkerUrl, icon192Url, networkErrorUrl, withPjaxPwa = false, title = 'Express Mustache Overlays', themeColor, scriptName = '', ...scriptNameDependent } = options || {}

  const { sharedPublicUrlPath=scriptName + '/public', publicUrlPath = scriptName + '/public', ...rest } = scriptNameDependent || {}
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
    mustacheDirs: [],
    publicFilesDirs: [],
    locals: { publicUrlPath, sharedPublicUrlPath, expressStaticOptions, manifestUrl, serviceWorkerUrl, icon192Url, networkErrorUrl, withPjaxPwa, title, themeColor, scriptName },
    overlayMustacheDir: function (mustacheDir) {
      this.mustacheDirs.splice(0, 0, path.normalize(mustacheDir))
    },
    overlayPublicFilesDir: function (publicFilesDir) {
      this.publicFilesDirs.splice(0, 0, path.normalize(publicFilesDir))
    },
    setup: async function () {
      debug(`Using these public files directories at ${this.locals.publicUrlPath} in order of preference: ${this.publicFilesDirs}`)
      for (const dir of this.publicFilesDirs) {
        debug(this.locals.publicUrlPath, '->', dir)
        app.use(this.locals.publicUrlPath, express.static(dir, this.locals.expressStaticOptions))
      }
      debug('Using these mustache views directories in order of preference:', this.mustacheDirs)
      let partials = await loadPartials(this.mustacheDirs)
      const partialsDirs = []
      const partialsDirsMustacheGlobs = []
      for (let mustacheDir of this.mustacheDirs) {
        partialsDirs.push(path.join(mustacheDir, 'partials'))
        partialsDirsMustacheGlobs.push(path.join(mustacheDir, 'partials', '**', '*.mustache'))
      }
      // Look for changes to partials directories, and reload if needed
      debug('Watching these globs:', partialsDirsMustacheGlobs.join(','))
      const onEvent = async (event, path) => {
        debug(`Reloading partials due to ${event} on ${path} ...`)
        partials = await loadPartials(this.mustacheDirs)
      }
      const throttledEvent = _.throttle(onEvent, 200, { 'trailing': true, 'leading': false })
      chokidar.watch(partialsDirsMustacheGlobs, { ignoreInitial: true, ignored: /(^|[/\\])\../ }).on('all', throttledEvent)
      const renderFile = async (filePath, options, callback) => {
        const content = await readFileAsync(filePath, { encoding: 'utf8' })
        const rendered = mustache.render(content, Object.assign({}, app.locals, options), partials)
        return rendered
      }
      app.engine('mustache', function (filePath, options, callback) {
        renderFile(filePath, options).then((rendered) => { callback(null, rendered) }).catch(e => callback)
      })
      // Undocumented behaviour, but if given a list of dirs, will check them in order, which is what we want
      app.set('views', this.mustacheDirs)
      app.set('view engine', 'mustache')
      const findView = async (template) => {
        let templatePath
        for (let i = 0; i < this.mustacheDirs.length; i++) {
          const filePath = path.join(this.mustacheDirs[i], template + '.mustache')
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
  return self
}

const setupErrorHandlers = async (app, options) => {
  const { debug = defaultDebug, ...rest } = options || {}
  if (Object.keys(rest).length) {
    throw new Error(`Unexpected options passed to setupErrorHandlers(): ${Object.keys(rest).join(', ')}.`)
  }

  // Must be after other routes - Handle 404
  app.get('/*', (req, res) => {
    res.status(404)
    res.render('404')
  })

  // Error handler has to be last
  app.use('/*', function (err, req, res, next) {
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

const overlaysApp = async (overlays, { debug, ...rest }) => {
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }
  const app = express()

  overlays.overlayMustacheDir(path.join(__dirname, '..', 'views-overlay'))

  app.get('/start', async (req, res, next) => {
    try {
      res.render('start', { })
    } catch (e) {
      next(e)
    }
  })

  app.get('/network-error', async (req, res, next) => {
    try {
      res.render('networkError', {})
    } catch (e) {
      next(e)
    }
  })

  return app
}

module.exports = { overlaysApp, prepareMustacheOverlays, setupErrorHandlers, overlaysOptionsFromEnv, overlaysDirsFromEnv }
