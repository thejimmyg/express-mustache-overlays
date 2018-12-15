const debug = require('debug')('express-mustache-overlays')
const fs = require('fs')
const mustache = require('mustache')
const path = require('path')
const shelljs = require('shelljs')
const util = require('util')
const chokidar = require('chokidar')

const readFile = util.promisify(fs.readFile)

const loadPartials = async (mustacheDirs) => {
  const partials = {}
  if (!Array.isArray(mustacheDirs)) {
    throw Error("Expected an array of paths for mustachDirs")
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
  return partials
}

module.exports = async (app, defaultOptions, mustacheDirs) => {
  let partials = await loadPartials(mustacheDirs)
  const partialsDirs = []
  for (let mustacheDir of mustacheDirs) {
    partialsDirs.push(path.join(mustacheDir, 'partials'))
  }
  // Look for changes to partials directories, and reload if needed
  debug('Watching these partials directories:', partialsDirs.join(','))
  chokidar.watch(partialsDirs).on('change', async (event, path) => {
    debug('Reloading partials ...')
    partials = await loadPartials(mustacheDirs)
    debug('done reloading partials.')
  })
  app.engine('mustache', async (filePath, options, callback) => {
    const content = await readFile(filePath, { encoding: 'utf8' })
    const rendered = mustache.render(content, Object.assign({}, defaultOptions, options), partials)
    return callback(null, rendered)
  })
  // Undocumented behaviour, but if given a list of dirs, will check them in order, which is what we want
  app.set('views', mustacheDirs)
  app.set('view engine', 'mustache')
}
