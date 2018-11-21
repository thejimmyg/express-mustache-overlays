const express = require('express')
const setupMustache = require('../lib/index.js')
const path = require('path')

const main = async () => {
  const app = express()
  const port = process.env.PORT || 9005
  const templateDefaults = { title: 'Title' }
  const mustacheDirs = [path.join(__dirname, '..', 'views')]
  await setupMustache(app, templateDefaults, mustacheDirs)
  
  app.get('/', (req,res)=>{
    res.render('main', { user: {username: 'james'}, content: '<h1>Home</h1><p>Hello!</p>' })
  })

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()
