# openbee plugin catalog

The list of plugins openbee can show and install. Plugin code lives in each plugin's own repository and is published to npm. This repository only records which package, and which reviewed version of it, belongs in the catalog.

The catalog is published to npm as [`@theopenbee/plugins`](https://www.npmjs.com/package/@theopenbee/plugins). Every merge to `main` that changes the catalog publishes a new version of it.

To add a plugin or release a new version of one, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

```
plugins/<category>/<id>.json   one entry per plugin
categories.json                plugin categories
tags.json                      tags entries may use
schema/entry.schema.json       entry format
scripts/                       checks and catalog build
```

## Entries

The category and id come from the file path. For channels the id is the channel id from the plugin's `openbee.plugin.json`.

```json
{
  "$schema": "../../schema/entry.schema.json",
  "package": "@theopenbee/channel-discord",
  "version": "0.1.0",
  "repository": "https://github.com/theopenbee/channel-discord",
  "maintainers": ["Qsnh"],
  "tags": ["im", "global"]
}
```

| Field | Required | Meaning |
|---|---|---|
| `package` | yes | npm package name. A package can be registered once. |
| `version` | yes | Exact version approved for the catalog, such as `0.1.0`. No ranges, no prereleases. |
| `repository` | yes | https URL of the source repository. |
| `maintainers` | yes | GitHub usernames of the people who maintain the entry. |
| `tags` | no | Tag ids from `tags.json`. |
| `min_openbee_version` | no | Lowest openbee version the plugin works with. |
| `deprecated` | no | Deprecation notice, a string or `{"en": "...", "zh": "..."}`. Its presence marks the plugin as deprecated. |

Name and description are not part of the entry. They are read from the plugin's own manifest.

## Official plugins

A plugin is official when its package is in the `@theopenbee` npm scope. Only members of the theopenbee npm organization can publish to that scope, and entries cannot declare themselves official. Official entries must point to a repository under `https://github.com/theopenbee/`.

## Checks

Every pull request runs `npm run validate`, which checks every entry:

- the path, category, id and fields are valid, tags exist, and no package is registered twice;
- `package@version` is published on registry.npmjs.org and its tarball matches the npm integrity;
- the tarball's `package.json` has the same name and version and declares a license;
- the plugin manifest passes the category's rules (for channels, the same rules openbee applies to `openbee.plugin.json`).

Tarballs are read in memory. Nothing is extracted to disk and no package code runs.

## catalog.json

The published package contains one file, `catalog.json`:

```json
{
  "schema_version": 1,
  "categories": [{ "id": "channel", "name": { "en": "Channels", "zh": "渠道" } }],
  "tags": [{ "id": "im", "name": { "en": "Instant messaging", "zh": "即时通讯" } }],
  "plugins": [
    {
      "category": "channel",
      "id": "discord",
      "package": "@theopenbee/channel-discord",
      "version": "0.1.0",
      "official": true,
      "name": { "en": "Discord", "zh": "Discord" },
      "description": { "en": "Discord bot channel", "zh": "Discord 机器人渠道" },
      "protocol_version": 1,
      "license": "MIT",
      "repository": "https://github.com/theopenbee/channel-discord",
      "maintainers": ["Qsnh"],
      "tags": ["im", "global"],
      "published_at": "2026-10-25T06:35:06.867Z",
      "integrity": "sha512-...",
      "tarball": "https://registry.npmjs.org/@theopenbee/channel-discord/-/channel-discord-0.1.0.tgz"
    }
  ]
}
```

`name`, `description`, `deprecated` and the vocabulary names are objects keyed by language; fall back to `en`. `description`, `min_openbee_version` and `deprecated` are left out when not set. Plugins are sorted by category, then id.

### Reading the catalog

1. Fetch `https://registry.npmjs.org/@theopenbee/plugins` and pick the highest version whose major equals the `schema_version` you support.
2. Download that version's tarball, check it against its `integrity`, and read `package/catalog.json`.
3. If npmjs is unreachable, use the same paths on `https://registry.npmmirror.com`, which may lag behind. Keep the last catalog you read.
4. Show only categories you support and ignore fields you do not know. Plugins whose `protocol_version` you do not support, or whose `min_openbee_version` is newer than you, can be shown but not installed. Show the `deprecated` notice when present.
5. Install with `openbee plugin install <package>@<version>`, using the exact version.

### Dependencies

The catalog pins the plugin package itself. A plugin's own dependencies are resolved from the ranges in its `package.json` when it is installed, as with any `npm install`.

## Versioning

The major version of `@theopenbee/plugins` equals `schema_version`. It changes only when `catalog.json` changes in a way older readers cannot handle; new categories and new optional fields keep the major version. Each publish bumps the patch version of the latest release, and nothing is published when the catalog is unchanged. The `version` in this repository's `package.json` is not updated; CI sets it at publish time.

## Development

```sh
npm ci
npm test
npm run validate
npm run build
```

`npm run validate` and `npm run build` read from registry.npmjs.org. `npm run build` writes `catalog.json`, which is not committed.

## License

MIT
