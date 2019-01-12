const express = require('express')
const compression = require('compression')
const path = require('path')
const mustache = require('mustache')
const { overlaysOptionsFromEnv, overlaysDirsFromEnv, prepareMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')
const debug = require('debug')('express-mustache-overlays:server')
const title = process.env.TITLE || 'Express Mustache Overlays'
// const publicFilesDir = path.normalize(path.join(__dirname, '..', 'public'))
const port = process.env.PORT || 80

const overlaysOptions = overlaysOptionsFromEnv()
// Extract the options you want to use elsewhere in your script too
const { scriptName } = overlaysOptions
const { mustacheDirs, publicFilesDirs } = overlaysDirsFromEnv()

const main = async () => {
  const app = express()
  app.use(compression())

  overlaysOptions.expressStaticOptions = {}
  overlaysOptions.title = title
  const overlays = await prepareMustacheOverlays(app, overlaysOptions)

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
      const html = await renderView('content', { content: 'render()', metaDescription: 'Home page' })
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
  const renderers = await overlays.setup({ debug })
  renderView = renderers.renderView

  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app, { debug })
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
