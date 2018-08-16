# QuaseJS

<!--[Documentation](/docs) | [Install](#installation)-->

The purpose of QuaseJS is to include various packages, smaller ones or bigger ones, that are useful for different tasks and that make the lives of JavaScript developers easier.

## :construction: This is a work in progress :construction:

## Features and available modules

**[builder](packages/builder)**

It's a bundler with easy configuration, good performance and support for javascript + html + css.

**[cli](packages/cli)**

Allows you to create a command line interface very easily.

**[config](packages/config)**

Utilities to get configuration, apply defaults and validate options.

**[error](packages/error)**

Some tools to work with Error objects and their stack.

**[eslint-config-quase](packages/eslint-config-quase)**

The Eslint configuration that I use.

**[fs/cacheable-fs](packages/fs/cacheable-fs)**

A file system interface that caches `stat()`, `readFile()`, `readdir()` calls.

**[package-manager](packages/package-manager)**

An experimental package manager that uses a global store and a combination of hard/soft links.

**[path-url](packages/path-url)**

Utilities to handle paths and urls.

**[publisher](packages/publisher)**

A package publisher heavily inspired by [np](https://github.com/sindresorhus/np).

**[source-map](packages/source-map)**

Tools to work with source maps.

**[unit](packages/unit)**

A unit testing library.

**[util/get-plugins](packages/util/get-plugins)**

Utility to help you get all the requested plugins.

**[view](packages/view)**

- Create declarative user interfaces with JSX.
- Makes use of the Custom Elements and Shadow Root specs.
- Implements one-way data flow.
- Has a compiler that removes the need for a diffing algorithm.

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
