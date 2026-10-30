# Contributing

Plugins enter the catalog, and change version in it, only through pull requests. A version is released to openbee users when its pull request is merged.

## Register a plugin

1. Publish the plugin to npm. The package must have its manifest (`openbee.plugin.json` for channels and engines) at the package root and a `license` in `package.json`.
2. Add `plugins/<category>/<id>.json`. For channels and engines, `<id>` is the `id` in `openbee.plugin.json`.

   ```json
   {
     "$schema": "../../schema/entry.schema.json",
     "package": "openbee-channel-example",
     "version": "1.0.0",
     "repository": "https://github.com/you/openbee-channel-example",
     "maintainers": ["your-github-username"],
     "tags": ["im"]
   }
   ```

   Use only tags listed in `tags.json`. To propose a new tag, add it to `tags.json` in the same pull request.
3. Run the checks:

   ```sh
   npm ci
   npm run validate
   ```

4. Open a pull request.

## Release a new version

Publish the new version to npm, then open a pull request that changes `version` in the plugin's entry. Usually that is the only change.

## Deprecate a plugin

Add `deprecated` with a short notice, for example `{"en": "Use the telegram plugin instead", "zh": "请改用 telegram 插件"}`. The plugin stays in the catalog and openbee shows the notice.

## Remove a plugin

Delete its entry. The next catalog release no longer lists it.

## Add a category

1. Add the category to `categories.json`.
2. Add `scripts/categories/<category>.mjs` exporting `manifestFile`, `validateId(id)` and `inspectManifest(manifest, id)`, following `scripts/categories/channel.mjs`.
3. Add entries under `plugins/<category>/`.
