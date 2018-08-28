# Quase Package Manager

Heavily inspired in [pnpm](https://github.com/pnpm/pnpm).

The key difference is that the tree is not built inside `node_modules`. It is created with the same links but saved in a global store, and then only the direct dependencies are linked to `node_modules`. I created this tool because I wanted to avoid having programs like OneDrive, Google Drive, Dropbox, following a ton of links (I'm still not sure if they actually do though).

Each different tree is actually only built once. Thanks to the way we store them, it is fast to distinguish between each different one.

## Features

- Fast
- Efficient. One version of a package is saved only ever once on a disk.
- Deterministic. Has a lockfile called `qpm-lockfile.json`.
- Strict. A package can access only dependencies that are specified in its `package.json`.
- Aliases. Install different versions of the same package or import it using a different name.
