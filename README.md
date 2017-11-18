# QuaseJS

<!--[Documentation](/docs) | [Install](#installation)-->

The purpose of QuaseJS is to include various packages, smaller ones or bigger ones, that are useful for different tasks and that make the lives of JavaScript developers easier.

## :construction: This is a work in progress :construction:

*Some modules are intended to work on the browser too, but browser support is not ready.*

## Features and available modules

**[builder](packages/builder)** - *WIP*

It's a bundler with easy configuration, good performance and support for javascript + html + css.

**[cli](packages/cli)** - **0.2.0**

Allows you to create a command line interface very easily.

**[error](packages/error)** - *WIP*

Some tools to work with Error objects and their stack.

**[eslint-config-quase](packages/eslint-config-quase)** - **0.1.0**

The Eslint configuration that I use.

**[events](packages/events)** - *WIP*

A copy of NodeJS's `events` module that also works on the browser.

**[fs/find-files](packages/fs/find-files)** - *WIP*

Find all files that match some patterns. Outputs results with an observable.

**[fs/get-file](packages/fs/get-file)** - **0.1.1**

Get the contents of a file. Uses `fs.readFile()` in nodejs and `fetch()` or `XMLHttpRequest` in the browser.

**[fs/is-file](packages/fs/is-file)** - **0.1.0**

Check if path is a file.

**[fs/memory-fs](packages/fs/memory-fs)** - **0.2.1**

Very simple in memory file system.

**[package-manager](packages/package-manager)** - *WIP*

An experimental package manager that uses a global store and a combination of hard/soft links.

**[path-url](packages/path-url)** - **0.1.0**

Utilities to handle paths and urls.

**[pathname](packages/pathname)** - *WIP*

Allows you to resolve, normalize and match pathnames.

**[source-map](packages/source-map)** - **0.1.0**

Tools to work with source maps.

**[unit](packages/unit)** - *WIP*

A unit testing library.

**[view](packages/view)** - *WIP*

- Create user interfaces with declarative templates.
- Makes use of the Custom Elements and Shadow Root specs.
- Implements one-way data flow.
- Has a compiler that removes the need for a diffing algorithm.

**More?**

TODO

## Installation

````
npm install @quase/PACKAGE
````

## FAQ

**What name is that?**

`Quase` means `almost` in portuguese. The idea came because I wanted this to include "almost everything" :smile:

**One more framework?!**

I would not call this a framework.

This is just a project with many modules that end up being reused in various places, so I thought it would be easier to have them in just one repository.

**Why implement things that already exist?**

I'm building this to learn and also to use it personally. I also imagined that this could be in some way useful for other people.

Sometimes I want something a little different, so I ended up doing my own implementation.

I will try to keep this project modular and reuse other modules that already exist as much as possible.
