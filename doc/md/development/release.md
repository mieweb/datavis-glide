# Versions & Releases

## Version Format

DataVis uses the familiar version string of `<major>.<minor>.<patch>` where upwards compatibility is maintained within the same major version.

## Making Changes

* Breaking changes (i.e. an existing API no longer works as it was originally specified) require a new major release. 
* New features should become a new minor release.
* Bugfixes result in a new patch release. This must be done in every minor release that contains the problem you’re fixing.

## Creating a Release

Making a DataVis release isn't particularly hard, but it does require a few steps.

1. Make sure all changes that will be in the release are committed on the appropriate branch(es).
2. Update the `package.json` file to update the version field.
3. Run `npm i` so the package lockfile gets updated.
4. Commit just the `package.json` and `package-lock.json` changes with the commit note "Release: DataVis v{VERSION}".
5. Create a tag called "v{VERSION}" with the note "DataVis v{VERSION}".
6. Push the commits and the tag.
