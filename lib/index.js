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

const mustacheFromEnv = (app) => {
  const dirs = process.env.MUSTACHE_DIRS ? process.env.MUSTACHE_DIRS.split(':') : []
  debug(dirs)
  return dirs
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

const prepareMustache = (app, userDirs, libDirs) => {
  app.locals.mustache = {
    userDirs: userDirs || [],
    libDirs: libDirs || [],
    overlay: (dirs) => {
      // Safer to use the whole path in case someone has replaced
      // the objects
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i]
        debug(dir, app.locals.mustache.libDirs)
        app.locals.mustache.libDirs.unshift(dir)
      }
    }
  }
}

const setupMustache = (app) => {
  let mustacheDirs = []
  mustacheDirs = mustacheDirs.concat(app.locals.mustache.userDirs)
  mustacheDirs = mustacheDirs.concat(app.locals.mustache.libDirs)
  app.locals.mustache.dirs = mustacheDirs
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
  app.locals.mustache.overlaysPromise = overlaysPromise
  app.locals.mustache.overlaysPromise
    .then((overlays) => {
      debug('Completed setup of mustache overlays')
    })
  const mustacheEngine = async (filePath, options, callback) => {
    try {
      const overlays = await app.locals.mustache.overlaysPromise
      const rendered = await overlays.renderFile(filePath, options)
      callback(null, rendered)
    } catch (e) {
      debug('Error setting up mustache overlays:', e)
      callback(e, null)
      throw new Error(e)
    }
  }
  return mustacheEngine
}

module.exports = { prepareMustache, setupMustache, mustacheFromEnv }
