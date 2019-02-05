const mustache = require('mustache')
const path = require('path')
const debug = require('debug')('express-mustache-overlays')
const fs = require('fs')
const shelljs = require('shelljs')
const chokidar = require('chokidar')
const _ = require('lodash')
const { promisify } = require('util')

const readFileAsync = promisify(fs.readFile)
const accessAsync = promisify(fs.access)

const optionsFromEnv = (options) => {
  const { extended = true } = options || {}
  const mustacheDirs = process.env.MUSTACHE_DIRS ? process.env.MUSTACHE_DIRS.split(':') : []
  const publicFilesDirs = process.env.PUBLIC_FILES_DIRS ? process.env.PUBLIC_FILES_DIRS.split(':') : []
  const scriptName = process.env.SCRIPT_NAME || ''
  const publicUrlPath = process.env.PUBLIC_URL_PATH
  let result = { scriptName, publicUrlPath, mustacheDirs, publicFilesDirs }
  if (extended) {
    // These ones are used by in the default base template, that works in
    // conjunction with gateway-lite, or are commonly used, but they aren't strictly needed.
    const port = process.env.PORT || 80
    const sharedPublicUrlPath = process.env.SHARED_PUBLIC_URL_PATH
    const startUrl = process.env.START_URL
    const title = process.env.DEFAULT_TITLE
    const withPjaxPwa = (process.env.WITH_PJAX_PWA || 'false').toLowerCase() === 'true'
    const networkErrorUrl = process.env.NETWORK_ERROR_URL
    const manifestUrl = process.env.MANIFEST_URL
    const serviceWorkerUrl = process.env.SERVICE_WORKER_URL
    let icon192Url = process.env.ICON_192_URL
    const themeColor = process.env.THEME_COLOR
    result = Object.assign({}, result, { port, sharedPublicUrlPath, title, startUrl, withPjaxPwa, networkErrorUrl, manifestUrl, serviceWorkerUrl, icon192Url, themeColor })
  }
  return result
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
    const partialsPath = path.join(mustacheDir, 'partials', '*.mustache')
    const files = shelljs.ls(partialsPath)
    if (shelljs.error()) {
      debug(`Error listing mustache partial files matching '${partialsPath}', perhaps none were found`)
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

const mustacheOverlays = (locals) => {
  const { mustacheDirs } = locals || {}
  const overlaysPromise = new Promise(async (resolve, reject) => {
    debug('Setting up templates...')
    debug('Using these mustache views directories in order of preference:', mustacheDirs)
    let partials = await loadPartials(mustacheDirs)
    const partialsDirs = []
    const partialsDirsMustacheGlobs = []
    for (let mustacheDir of mustacheDirs) {
      partialsDirs.push(path.join(mustacheDir, 'partials'))
      partialsDirsMustacheGlobs.push(path.join(mustacheDir, 'partials', '**', '*.mustache'))
    }
    // Look for changes to partials directories, and reload if needed
    debug('Watching these globs:', partialsDirsMustacheGlobs.join(','))
    const onEvent = async (event, path) => {
      debug(`Reloading partials due to ${event} on ${path} ...`)
      partials = await loadPartials(mustacheDirs)
    }
    const throttledEvent = _.throttle(onEvent, 200, { 'trailing': true, 'leading': false })
    chokidar.watch(partialsDirsMustacheGlobs, { ignoreInitial: true, ignored: /(^|[/\\])\../ }).on('all', throttledEvent)
    const renderFile = async (filePath, options) => {
      const content = await readFileAsync(filePath, { encoding: 'utf8' })
      const rendered = mustache.render(content, Object.assign({}, options), partials)
      return rendered
    }
    const findView = async (template) => {
      let templatePath
      for (let i = 0; i < mustacheDirs.length; i++) {
        const filePath = path.join(mustacheDirs[i], template + '.mustache')
        try {
          await accessAsync(filePath, fs.constants.R_OK)
          templatePath = filePath
          break
        } catch (e) {
          // Can't access the file
          // debug(e)
        }
      }
      if (!templatePath) {
        throw new Error(`Template '${template}' not found, searched ${mustacheDirs}`)
      }
      return templatePath
    }
    const renderView = async (template, options) => {
      return renderFile((await findView(template)), options)
    }
    const overlays = {
      renderFile,
      renderView,
      findView
    }
    resolve(overlays)
  })
  return overlaysPromise
}

const mustacheEngine = (overlaysPromise) => {
  return async (filePath, options, callback) => {
    try {
      const overlays = await overlaysPromise
      const rendered = await overlays.renderFile(filePath, options)
      callback(null, rendered)
    } catch (e) {
      debug('Error setting up mustache overlays:', e)
      callback(e, null)
      throw new Error(e)
    }
  }
}

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

const setupErrorHandlers = (app, options) => {
  const { debug = console.log, ...rest } = options || {}
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

module.exports = { optionsFromEnv, mustacheOverlays, mustacheEngine, installSignalHandlers, setupErrorHandlers }
