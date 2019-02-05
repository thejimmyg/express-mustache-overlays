const express = require('express')
const compression = require('compression')
const debug = require('debug')('express-mustache-overlays:server')
const { installSignalHandlers, overlaysApp, overlaysOptionsFromEnv, withOverlays, setupErrorHandlers } = require('../lib/index.js')

const overlaysOptions = overlaysOptionsFromEnv()
const { scriptName, port } = overlaysOptions
const demoRoutes = (process.env.DEMO_ROUTES || 'false').toLowerCase() === 'true'

const main = async () => {
  const app = express()
  app.use(compression())
  await withOverlays(app, overlaysOptions, async (overlays) => {
    await overlaysApp(app, overlays, overlaysOptions, {debug})
// { scriptName, debug, demoRoutes, networkErrorUrl: overlaysOptions.networkErrorUrl, startUrl: overlaysOptions.startUrl })
    await setupErrorHandlers(app, { debug })
  })
  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

installSignalHandlers()
main()
