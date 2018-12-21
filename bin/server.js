const express = require('express')
const { setupMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')

const mustacheDirs = process.env.mustacheDirs ? process.env.MUSTACHE_DIRS.split(':') : []
const publicFilesDirs = process.env.publicFilesDirs ? process.env.PUBLIC_FILES_DIRS.split(':') : []
const scriptName = process.env.SCRIPT_NAME || ''
const publicURLPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
const title = process.env.TITLE || 'Express Mustache Overlays'

const main = async () => {
  const app = express()
  const port = process.env.PORT || 80

  await setupMustacheOverlays(app, { mustacheDirs: mustacheDirs, publicFilesDirs: publicFilesDirs, scriptName: scriptName, expressStaticOptions: {}, publicURLPath })

  // Simulate user signin
  // (Use the withUser() middleware from express-mustache-jwt-signin to do this properly)
  app.use((req, res, next) => {
    req.user = { username: 'james' }
    res.locals = Object.assign({}, res.locals, {user: req.user})
    next()
  })

  // Render the page, with the default title and request username as well as the content
  app.get('/', (req, res) => {
    res.render('content', { content: '<h1>Home</h1><p>Hello!</p>' })
  })

  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app)

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
