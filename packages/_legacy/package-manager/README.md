# Quase Package Manager

Heavily inspired in [pnpm](https://github.com/pnpm/pnpm).

The key difference is that the tree is not built inside `node_modules`. It is created with the same links but saved in a global store, and then only the direct dependencies are linked to `node_modules`. I created this tool because I wanted to avoid having programs like OneDrive, Google Drive, Dropbox, following a ton of links (I'm still not sure if they actually do though).

Each different tree is actually only built once. Thanks to the way we store them, it is fast to distinguish between each different one.

Essentially, it seems to implement this idea: [https://github.com/pnpm/pnpm/issues/1001](https://github.com/pnpm/pnpm/issues/1001).

## Features

- Fast
- Efficient. One version of a package is saved only ever once on a disk.
- Deterministic. Has a lockfile called `qpm-lockfile.json`.
- Strict. A package can access only dependencies that are specified in its `package.json`.
- Aliases. Install different versions of the same package or import it using a different name.

## UPDATE

This was a very cool experiment. But I now think Yarn PnP has a better solution, which avoids the need to create all these different trees.

There is also probably a problem with the current implementation because concurrent calls of the package manager might observe folders half-complete in the global store with installations on going. There are also other limitations (e.g. not checking engines, not dealing with peerDependencies, no ability to delete packages from the store, lacks checking integrity of the store with https://github.com/zkat/cadr).
