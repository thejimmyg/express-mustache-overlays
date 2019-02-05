const express = require('express')
const path = require('path')
const { optionsFromEnv, mustacheOverlays, mustacheEngine, installSignalHandlers, setupErrorHandlers } = require('../lib/lib.js')

const app = express()
app.locals.debug = console.info
app.locals.mustacheDirs = [path.join(__dirname, '..', 'mustache')]
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

app.get('', (req, res) => {
  res.render('Hello')
})

app.engine('mustache', mustacheEngine(app.locals.overlaysPromise))
app.set('views', app.locals.mustacheDirs)
app.set('view engine', 'mustache')
if (app.locals.publicFiles) {
  app.locals.publicFilesDirs.forEach((publicFilesDir) => {
    debug(app.locals.publicUrlPath, '->', publicFilesDir)
    app.use(app.locals.publicUrlPath, express.static(publicFilesDir))
  })
}

//setupErrorHandlers(app, { debug })
installSignalHandlers()

const port = process.env.PORT || 80
app.listen(port, () => console.log(`Example app listening on port ${port}`))
