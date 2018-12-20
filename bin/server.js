const express = require('express')
const { setupMustacheOverlays, setupErrorHandlers } = require('../lib/index.js')

const main = async () => {
  const app = express()
  const port = process.env.PORT || 80
  const options = {} // e.g. {{expressStaticOptions: {dotfiles: 'allow'}}

  const { scriptName, publicURLPath } = await setupMustacheOverlays(app, options)

  // Simulate user signin
  // (Use the withUser() middleware from express-mustache-jwt-signin to do this properly)
  app.use((req, res, next) => {
    req.user = { username: 'james' }
    next()
  })

  // Keep this just before the routes, so that everything else is already set up
  // including your user middleware
  // Set template defaults (including request-specific options)
  // Note: scriptName and publicURLPath are expected by the 404 and 500 handlers
  //       so you must set this middleware if using setupErrorHandlers()
  app.use((req, res, next) => {
    res.locals = Object.assign({}, res.locals, { publicURLPath, scriptName, title: 'Express Mustache Overlays', user: req.user })
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
