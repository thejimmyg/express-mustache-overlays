const express = require('express')
const path = require('path')
const { optionsFromEnv, mustacheOverlays, mustacheEngine, installSignalHandlers, setupErrorHandlers } = require('./lib.js')


const adjustLocals = (locals, envOptions) => {
  const { mustacheDirs, publicFilesDirs, publicUrlPath = '/public', sharedPublicUrlPath = '/public' } = locals || {}
  if (typeof locals.debug === 'undefined') {
    locals.debug = console.log
  }
  if (typeof publicUrlPath === 'undefined') {
    throw new Error('Please set publicUrlPath')
  }
  if (publicUrlPath.endsWith('/')) {
    throw new Error('The publicUrlPath option must not end with "/"')
  }
  // Example of setting up the main
  const newMustacheDirs = []
  if (mustacheDirs) {
    mustacheDirs.forEach((dir) => {
      newMustacheDirs.push(dir)
    })
  }
  newMustacheDirs.push(path.join(__dirname, '..', 'views'))
  if (envOptions.mustacheDirs) {
    envOptions.mustacheDirs.forEach((dir) => {
      newMustacheDirs.unshift(dir)
    })
  }
  const newPublicFilesDirs = []
  if (publicFilesDirs) {
    publicFilesDirs.forEach((dir) => {
      newPublicFilesDirs.push(dir)
    })
  }
  newPublicFilesDirs.push(path.join(__dirname, '..', 'public'))
  if (envOptions.publicFilesDirs) {
    envOptions.publicFilesDirs.forEach((dir) => {
      newPublicFilesDirs.unshift(dir)
    })
  }
  const newPublicUrlPath = locals.publicUrlPath || envOptions.publicUrlPath || publicUrlPath
  const newSharedPublicUrlPath = locals.sharedPublicUrlPath || envOptions.sharedPublicUrlPath || sharedPublicUrlPath
  const newScriptName = locals.scriptName || envOptions.scriptName
  // Merge new options with the existing ones
  const options = Object.assign({}, locals, envOptions, { publicUrlPath: newPublicUrlPath, mustacheDirs: newMustacheDirs, publicFilesDirs: newPublicFilesDirs, sharedPublicUrlPath: newSharedPublicUrlPath, scriptName: newScriptName })
  if (options.mustacheDirs.length < 1) {
    throw new Error('Expected at least one entry in the mustacheDirs array')
  }
  if (options.scriptName.endsWith('/')) {
    throw new Error('SCRIPT_NAME should not end with /.')
  }
  return options
}

const expressMustacheOverlays = (app, options, callback) => {
  app.locals = adjustLocals(app.locals, optionsFromEnv())
  app.locals.overlaysPromise = mustacheOverlays(app.locals)
  const { debug, startUrl = '/start', networkErrorUrl = '/network-error' } = app.locals

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

  callback()

  app.engine('mustache', mustacheEngine(app.locals.overlaysPromise))
  app.set('views', app.locals.mustacheDirs)
  app.set('view engine', 'mustache')
  app.locals.publicFilesDirs.forEach((publicFilesDir) => {
    debug(app.locals.publicUrlPath, '->', publicFilesDir)
    app.use(app.locals.publicUrlPath, express.static(publicFilesDir))
  })

  setupErrorHandlers(app, { debug })
  // Shutdown
  installSignalHandlers()
}

module.exports = { expressMustacheOverlays, adjustLocals }
