const express = require('express')
const path = require('path')
const { prepareMustache, setupMustache, mustacheFromEnv } = require('express-mustache-overlays')

const app = express()
prepareMustache(app, mustacheFromEnv(app))

// Any other express setup can change app.locals.mustache.libDirs here to add
// additional library-defined public files directories to be served.  Any user
// defined directories will be prepended before any corresponding URL path in
// the library directories list. The safest way to add overlays is with the
// overlay() function demonstrated here.
app.locals.mustache.overlay([path.join(__dirname, 'mustache')])

// Add any routes here:
app.get('', (req, res) => {
  res.render('hello', {})
})

// Set up the engine
const mustacheEngine = setupMustache(app)
app.engine('mustache', mustacheEngine)
app.set('views', app.locals.mustache.dirs)
app.set('view engine', 'mustache')

app.listen(8000, () => console.log(`Example app listening on port 8000`))
