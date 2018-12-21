const express = require('express')
const { prepareMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')

const mustacheDirs = process.env.mustacheDirs ? process.env.MUSTACHE_DIRS.split(':') : []
const publicFilesDirs = process.env.publicFilesDirs ? process.env.PUBLIC_FILES_DIRS.split(':') : []
const scriptName = process.env.SCRIPT_NAME || ''
const publicURLPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
const title = process.env.TITLE || 'Express Mustache Overlays'

const main = async () => {
  const app = express()
  const port = process.env.PORT || 80

  const overlays = await prepareMustacheOverlays(app, { scriptName, expressStaticOptions: {}, publicURLPath, title })

  // Simulate user signin
  // (Use the withUser() middleware from express-mustache-jwt-signin to do this properly)
  app.use((req, res, next) => {
    req.user = { username: 'james' }
    res.locals = Object.assign({}, res.locals, { user: req.user })
    next()
  })

  // Set up any other overlays directories here
  mustacheDirs.forEach(dir => {
    overlays.overlayMustacheDir(dir)
  })
  publicFilesDirs.forEach(dir => {
    overlays.overlayPublicFilesDir(dir)
  })

  // Render the page, with the default title and request username as well as the content
  app.get('/', (req, res) => {
    res.render('content', { content: '<h1>Home</h1><p>Hello!</p>' })
  })

  // Put the overlays into place after you've set up any more overlays you need, but definitely before the error handlers
  overlays.setup()

  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app)
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
