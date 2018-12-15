# Express Mustache Overlays

Provides the `mustache` view to Express but serves templates with partials
pre-configured from a `partials` directory within each template directory, and
will look in a series of directories one after another if the template or
partials don't match.

Also allows a default template context to be provided to each template.

## Example

This example serves templates from `views` and partials from `views/partials`:

```
npm install
MUSTACHE_DIRS=overlay DEBUG=express-mustache-overlays PORT=9005 npm start
```

Visit http://localhost:9005

## Dev

```
npm run fix
```

## Changelog

### 0.1.4 2018-12-15

* Tweaked example to set from `MUSTACHE_DIRS` correctly

### 0.1.3 2018-12-15

* Support the `MUSTACHE_DIRS` environment variable as a `:` separated list of paths to look at first before looking in the default `views` directory
* Listen to `all` events in partials such as add and delete as well as change
* Improved logging of which partials directory is being reloaded
* Throttle reloading with `lodash._throttle` and support sub directories

### 0.1.2 2018-12-15

* Throw an error if `mustacheDirs` is not an array
* Use Flex-based templates in the example

### 0.1.1

* Reload on change

### 0.1.0

* First version
