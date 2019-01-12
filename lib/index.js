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
  const publicURLPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
  const withPjaxPwa = (process.env.WITH_PJAX_PWA || 'false').toLowerCase() === 'true'
  const offlineUrl = process.env.OFFLINE_URL || ''
  const manifestUrl = process.env.MANIFEST_URL || ''
  const serviceWorkerUrl = process.env.SERVICE_WORKER_URL || ''
  const icon192Url = process.env.ICON_192_URL || publicURLPath + '/theme/icon.png'
  return { scriptName, publicURLPath, withPjaxPwa, offlineUrl, manifestUrl, serviceWorkerUrl, icon192Url }
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
  const mustacheDirs = []
  const publicFilesDirs = []
  const { expressStaticOptions, manifestUrl, serviceWorkerUrl, icon192Url, offlineUrl, withPjaxPwa = false, title = 'Express Mustache Overlays', scriptName = '', ...scriptNameDependent } = options || {}
  const { publicURLPath = scriptName + '/public', ...rest } = scriptNameDependent || {}
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }
  if (publicURLPath.endsWith('/')) {
    throw new Error('The publicURLPath option must not end with "/"')
  }
  if (scriptName.endsWith('/')) {
    throw new Error('SCRIPT_NAME should not end with /.')
  }
  app.locals = Object.assign({}, app.locals, { serviceWorkerUrl, publicURLPath, offlineUrl, withPjaxPwa, scriptName, title, manifestUrl, icon192Url })

  async function setup () {
    debug(`Using these public files directories at ${publicURLPath} in order of preference: ${publicFilesDirs}`)
    for (const dir of publicFilesDirs) {
      app.use(publicURLPath, express.static(dir, expressStaticOptions))
    }
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
    const renderFile = async (filePath, options, callback) => {
      const content = await readFileAsync(filePath, { encoding: 'utf8' })
      const rendered = mustache.render(content, Object.assign({}, app.locals, options), partials)
      return rendered
    }
    app.engine('mustache', function (filePath, options, callback) {
      renderFile(filePath, options).then((rendered) => { callback(null, rendered) }).catch(e => callback)
    })
    // Undocumented behaviour, but if given a list of dirs, will check them in order, which is what we want
    app.set('views', mustacheDirs)
    app.set('view engine', 'mustache')
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
    return { renderFile, renderView, findView }
  }
  function overlayMustacheDir (mustacheDir) {
    mustacheDirs.splice(0, 0, path.normalize(mustacheDir))
  }
  function overlayPublicFilesDir (publicFilesDir) {
    publicFilesDirs.splice(0, 0, path.normalize(publicFilesDir))
  }
  overlayMustacheDir(path.join(__dirname, '..', 'views'))
  overlayPublicFilesDir(path.join(__dirname, '..', 'public'))
  return { mustacheDirs, publicFilesDirs, overlayMustacheDir, overlayPublicFilesDir, setup }
}

const setupErrorHandlers = async (app, options) => {
  const { debug = defaultDebug, ...rest } = options || {}
  if (Object.keys(rest).length) {
    throw new Error(`Unexpected options passed to setupErrorHandlers(): ${Object.keys(rest).join(', ')}.`)
  }

  // Must be after other routes - Handle 404
  app.get('*', (req, res) => {
    res.status(404)
    res.render('404')
  })

  // Error handler has to be last
  app.use(function (err, req, res, next) {
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

module.exports = { prepareMustacheOverlays, setupErrorHandlers, overlaysOptionsFromEnv, overlaysDirsFromEnv }
