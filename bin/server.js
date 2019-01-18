const express = require('express')
const compression = require('compression')
const { overlaysApp, overlaysOptionsFromEnv, overlaysDirsFromEnv, prepareMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')
const debug = require('debug')('express-mustache-overlays:server')
// const publicFilesDir = path.normalize(path.join(__dirname, '..', 'public'))
const demoRoutes = (process.env.DEMO_ROUTES || 'false').toLowerCase() === 'true'
const mustache = require('mustache')

const main = async () => {
  const app = express()
  app.use(compression())

  const title = process.env.TITLE || 'Express Mustache Overlays'
  const port = process.env.PORT || 80

  const overlaysOptions = overlaysOptionsFromEnv()
  // Extract the options you want to use elsewhere in your script too
  const { scriptName } = overlaysOptions
  const { mustacheDirs, publicFilesDirs } = overlaysDirsFromEnv()

  overlaysOptions.expressStaticOptions = {}
  overlaysOptions.title = title

  const overlays = await prepareMustacheOverlays(app, overlaysOptions)

  mustacheDirs.forEach(dir => {
    overlays.overlayMustacheDir(dir)
  })
  publicFilesDirs.forEach(dir => {
    overlays.overlayPublicFilesDir(dir)
  })

  app.use((req, res, next) => {
    res.locals = Object.assign({}, res.locals, { demoRoutes })
    next()
  })

  const oApp = await overlaysApp(overlays, { debug })

  if (demoRoutes) {
    oApp.get('/throw', async (req, res, next) => {
      try {
        throw new Error('Sample error')
      } catch (e) {
        next(e)
      }
    })

    // Render the page, with the default title and request username as well as the content
    oApp.get('/', async (req, res, next) => {
      try {
        const html = await overlays.renderView('content', { content: 'render()', metaDescription: 'Home page' })
        res.render('content', { content: '<h1>Home</h1><p>Hello!</p><pre>' + mustache.escape(html) + '</pre>', metaDescription: 'Home page' })
      } catch (e) {
        next(e)
      }
    })

    // Another page
    oApp.get('/ok', async (req, res, next) => {
      try {
        res.render('content', { content: '<h1>OK</h1><p>OK!</p>', metaDescription: 'OK page' })
      } catch (e) {
        next(e)
      }
    })
  }
  debug('Mounting overlays app at', scriptName)
  app.use(scriptName, oApp)

  // Put the overlays into place after you've set up any more overlays you need, but definitely before the error handlers
  await overlays.setup({ debug })
  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app, { debug })
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()

// Better handling of SIGINT and SIGTERM for docker
process.on('SIGINT', function () {
  console.log('Received SIGINT. Exiting ...')
  process.exit()
})

process.on('SIGTERM', function () {
  console.log('Received SIGTERM. Exiting ...')
  process.exit()
})
