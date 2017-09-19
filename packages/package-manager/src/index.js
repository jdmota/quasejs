// TODO

/*

Commands:

# install

Install what is in the package.json file and use what is in the lock file.
If there is none, create one

# install <name>

- If the dependency is already in the package.json
  - Warn
- Else
  - Add to the package.json file
  - The same as install

# update

- Install what is in the package.json file and update the lock file with latest resolutions

# update <name>

- If the dependency is already in the package.json
  - Resolve to the last version and update lock file
- Else
  - Warn

# remove <name>

- If the dependency is already in the package.json
  - Remove it and update lock file
- Else
  - Warn

# outdated


# run


# test

Same as `run test`

# self-update


# list (or ls)


# check [--integrity]

Verifies that versions of the package dependencies in the current project’s package.json matches that of yarn's lock file.

Verifies that versions and hashed value of the package contents in the project’s package.json matches that of yarn's lock file. This helps to verify that the package dependencies have not been altered.


*/
