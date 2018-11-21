const debug = require('debug')('express-mustache-overlays')
const fs = require('fs')
const mustache = require('mustache')
const path = require('path')
const shelljs = require('shelljs')
const util = require('util')

const readFile = util.promisify(fs.readFile)

module.exports = async (app, defaultOptions, mustacheDirs) => {
  const partials = {}
  if (!Array.isArray(mustacheDirs)) {
    mustacheDirs = [mustacheDirs]
  }
  mustacheDirs.reverse()
  for (let mustacheDir of mustacheDirs) {
    // Make it the same format that shelljs returns
    mustacheDir = path.normalize(mustacheDir)
    const files = shelljs.ls(path.join(mustacheDir, 'partials', '*.mustache'))
    if (!files.length) {
      debug('No partials found. Continuing anyway ...')
    }
    for (const filename of files) {
      const name = filename.slice((mustacheDir + '/partials/').length, filename.length - 9)
      partials[name] = await readFile(filename, { encoding: 'utf8' })
    }
  }
  mustacheDirs.reverse()
  // Should match the file extension of the view.
  app.engine('mustache', async (filePath, options, callback) => {
    const content = await readFile(filePath, { encoding: 'utf8' })
    const rendered = mustache.render(content, Object.assign({}, defaultOptions, options), partials)
    return callback(null, rendered)
  })
  // Undocumented behaviour, but if given a list of dirs, will check them in order, which is what we want
  app.set('views', mustacheDirs)
  app.set('view engine', 'mustache')
}
