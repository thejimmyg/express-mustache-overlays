// DEMO_ROUTES=true MUSTACHE_DIRS=overlay DEBUG=express-mustache-overlays,express-mustache-overlays:server PORT=8000 DEFAULT_TITLE=Hello npm start

const { expressMustacheOverlays } = require('../index.js')
const express = require('express')
const mustache = require('mustache')
const debug = require('debug')('express-mustache-overlays:server')

const app = express()
app.locals.demoRoutes = (process.env.DEMO_ROUTES || 'false').toLowerCase() === 'true'
app.locals.debug = debug

expressMustacheOverlays(app, {}, () => {
  const { scriptName } = app.locals

  if (app.locals.demoRoutes) {
    app.get(scriptName + '/throw', async (req, res, next) => {
      try {
        throw new Error('Sample error')
      } catch (e) {
        next(e)
      }
    })

    // Render the page, with the default title and request username as well as the content
    app.get(scriptName + '/', async (req, res, next) => {
      try {
        const html = await (await app.locals.overlaysPromise).renderView('content', { content: 'render()', metaDescription: 'Home page' })
        res.render('content', { content: '<h1>Home</h1><p>Hello!</p><pre>' + mustache.escape(html) + '</pre>', metaDescription: 'Home page' })
      } catch (e) {
        next(e)
      }
    })

    // Another page
    app.get(scriptName + '/ok', async (req, res, next) => {
      try {
        res.render('content', { content: '<h1>OK</h1><p>OK!</p>', metaDescription: 'OK page' })
      } catch (e) {
        next(e)
      }
    })
  }

  app.listen(app.locals.port, () => console.log(`Example app listening on port ${app.locals.port}`))
})
