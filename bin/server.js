const express = require('express')
const compression = require('compression')
const { overlaysApp, overlaysOptionsFromEnv, overlaysDirsFromEnv, prepareMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')
const debug = require('debug')('express-mustache-overlays:server')
// const publicFilesDir = path.normalize(path.join(__dirname, '..', 'public'))

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

  // Simulate user signin
  // (Use the withUser() middleware from express-mustache-jwt-signin to do this properly)
  app.use((req, res, next) => {
    req.user = { username: 'james' }
    res.locals = Object.assign({}, res.locals, { user: req.user })
    next()
  })

  app.use(scriptName, await overlaysApp(overlays, { debug }))

  // Put the overlays into place after you've set up any more overlays you need, but definitely before the error handlers
  await overlays.setup({ debug })
  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app, { debug })
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
