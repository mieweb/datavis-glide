# NPM Package

There are multiple ways to use DataVis as an NPM dependency.

## Git Repository

This requires access to the source repository, but it works just fine for internal purposes.

``` json
"dependencies": {
  "wcdatavis": "git+ssh://git@github.mieweb.com:datavis/wcdatavis.git"
}
```

See [the NPM documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#git-urls-as-dependencies) for information on how the URL can be formatted to reference specific branches, tags, or versions.

## Published Package

There is also now a (private) NPM package hosted on GitHub. You must still have access to the repository to use the NPM package, but you will also need to configure an access token.

1. For manual package publishing, [generate a Personal Access Token (Classic)](https://github.com/settings/tokens).

2. Use the “SSO” dropdown to give it access to the mieweb organization.

3. Log in on the command line: `npm login --registry='https://npm.pkg.github.com'`

   Use the token you generated earlier as the password.

Put the following into your `.npmrc` file to map the `@mieweb` organization to its package repo:

```
@mieweb:registry=https://npm.pkg.github.com
```

Here is what you’ll need in your `package.json` file.

```json
"dependencies": {
  "@mieweb/wcdatavis": "=3.2.3"
}
```

