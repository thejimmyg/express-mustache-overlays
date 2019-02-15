# Express Mustache Overlays Example

You can test the example with:

```
cd ../
npm install
cd example
npm install
PORT=8000 npm start
```

If you get a warning about not being able to install a package, remove your `package-lock.json` file and try again.

To add logging too you can use:

```
DEBUG="*" PORT=8000 npm start
```

You can choose just a few selected loggers by comma-separating their names like this:

```
DEBUG="express-mustache-overlays,express-mustache-overlays:server" PORT=8000 npm start
```

Visit http://localhost:8000/ and you'll see `Hello world!` served from `mustache/hello.mustache` and `mustache/partials/world.mustache`.

If you specify `MUSTACHE_DIRS` too, each of the directories specified will be checked in turn before checking the normal directory checks.

In the next example, templates will first be searched for in `mustache-overlay` and then be searched for in `mustache`. You can try moving or deleting the files in those directories to see the behaviour in action:

```
DEBUG="express-mustache-overlays" MUSTACHE_DIRS="mustache-overlay" PORT=8000 npm start
```

Visit http://localhost:8000/ this time and you'll see `Goodbye world!` with the `hello.mustache` template served from `mustache-overlay/hello.mustache` but the `world.mustache` partial coming from `mustache/partials`.

If you delete, move or change files, the overlays will automatically reflect your changes so feel free to experiment.


## Dev

```
npm run fix
```

## Docker

Docker can't copy files from a parent directory so the `docker:build` command puts the current dev version of express-mustache-overlays in this directory and created a modified `package.json.docker`:

```
npm run docker:build && npm run docker:run
```
