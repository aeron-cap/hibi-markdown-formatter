# Hibi addon starter

This repository is a starting point for [Hibi](https://hibi.garden) addons. It contains two ready-to-install packages:

- `addons/hello` is an extension. It adds a **Say hello** command and remembers how many times you ran it.
- `addons/hello-theme` is a theme. It adds a light color scheme and a matching dark one.

Hibi installs the files exactly as they are in this repository. It does not run build scripts or install dependencies, so every file a package needs must be committed.

## Start a new addon

Choose **Use this template** on GitHub to create your own repository, then clone it. You need Node.js 22.18 or later to run the checks. The starter has no dependencies, so you do not need to run `npm install`.

Run these commands from the repository folder:

```sh
npm run check
npm test
```

`npm run check` finds every package the way Hibi does and reports common mistakes, such as a missing readme, an invalid theme color, or a file type that Hibi will not install. `npm test` runs the example tests in `test/`. Hibi's installer has the final say, so also install your package in Hibi before you share it.

## Try it in Hibi

Packages from this starter are unsigned. Before you install one, turn on **Allow unsigned addons** under **Settings → Addon Manager → Security**.

1. Run **Install addon…** from Hibi's command palette.
2. Select this repository's folder to see both packages, or select one package folder, such as `addons/hello`, to install only that package.
3. Review the packages and install them. Hibi installs addons turned off.
4. Enable them in **Settings → Addons**.
5. Run **Say hello** from the command palette, or choose **Hello light** or **Hello dark** in **Settings → Appearance** under **Colors**.

After you change a package, install it again. Hibi replaces the installed copy after you confirm.

## Make it yours

Rename the package folder, then update `hibi-addon.json` in it:

- `id` must be unique. Use up to 48 lowercase letters, numbers, and hyphens, starting with a letter. Hibi refuses IDs that belong to its built-in addons.
- Change `name`, `description`, and `authors` to describe your addon.
- Increase `version` whenever you share a new release.

Then edit the package's `README.md`. Hibi shows it as the addon's documentation, so write it for the people who will use the addon.

Delete the package you do not need. Keep each package in its own folder. Do not put a `hibi-addon.json` at the repository root next to packages in subfolders, because Hibi will refuse packages whose folders overlap. If your repository holds one package, you can move its files to the root instead.

### Extensions

`index.js` exports a function that returns `start` and `stop`. Hibi calls `start` with a context when the addon turns on, and `stop` when it turns off. Undo everything `start` registered in `stop`, as the example does with its command.

The manifest controls when the extension loads and which parts of Hibi it can use. The example sets `"activation": "command"`, so Hibi loads it the first time you run its command, and it lists `"capabilities": []` because it needs no editor or interface libraries. Keep command IDs in `hibi-addon.json` and `index.js` the same.

The entry file must be JavaScript (`.js` or `.mjs`). If you prefer TypeScript or a bundler, compile to JavaScript and commit the output. See [adding functionality](https://docs.hibi.garden/#page=development%2Faddons%2Fadding-functionality.md), [storage](https://docs.hibi.garden/#page=development%2Faddons%2Fstorage.md), and the [addon API reference](https://docs.hibi.garden/#page=development%2Faddon-api-reference%2FAddonContext.md) for what extensions can do.

### Themes

A theme package contains color data only. Each file listed in `themes` describes one color scheme. It needs an `id`, a `name`, an `appearance` of `light` or `dark`, an `author`, a `license`, and six-digit hex colors for `background`, `surface`, `ink`, `muted`, `accent`, and `border`. You can set more colors as well; [creating a theme](https://docs.hibi.garden/#page=development%2Faddons%2Fcreating-a-theme.md) lists them.

### Files Hibi installs

Hibi installs only these file types: `.js`, `.mjs`, `.json`, `.css`, `.md`, `.txt`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.woff`, `.woff2`, `.ttf`, `.mp3`, `.ogg`, and `.wav`. Each package needs `README.md` and `hibi-addon.json`. Hibi skips hidden files and `node_modules`. A file without an extension, such as `LICENSE`, stops the installation, so each package keeps its license in `LICENSE.txt`.

## Share it

Push your repository to a public HTTPS Git host such as GitHub. Anyone can then choose **Install from URL** in Hibi's Addon Manager and enter the repository URL, for example `https://github.com/you/your-addon`. Hibi lists every package it finds and lets them choose which to install.

You can also attach a ZIP file of your packages to a release and share its download link. ZIP files install the same way as repositories.

To list your addon in Hibi's addon directory, open a pull request in [hibigarden/addons-repository](https://github.com/hibigarden/addons-repository). The directory can link to your repository or release, so you do not need to copy your files there.

Hibi signs only packages its maintainers have reviewed. Listing an addon in the directory does not sign it, so people still need to allow unsigned addons to install it. See [sideloading and sharing](https://docs.hibi.garden/#page=development%2Faddons%2Fsideloading.md) for signatures, package limits, and updates.

## License

The starter is available under the [MIT License](LICENSE). Each package carries its own copy in `LICENSE.txt`, because Hibi installs only the package folder. You can change the license of your own addon; update both files and the theme `license` fields if you do.
