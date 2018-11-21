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
DEBUG=express-mustache-overlays PORT=9005 node bin/server.js
```

Visit http://localhost:9005

## Dev

```
npm run fix
```
