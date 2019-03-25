# QuaseJS

The purpose of QuaseJS is to include various packages, smaller ones or bigger ones, that are useful for different tasks and that make the lives of JavaScript developers easier.

As of now, this is just an experiment. A lot of what is here is intended to investigate new tools/patterns or adapt ones that already exist, making them work in JavaScript, and maybe in a future programming language, that would provide them out of the box.

## Work in progress

**[builder](packages/builder)**

It's a bundler with easy configuration, good performance and support for javascript + html + css.

**[cli](packages/cli)**

Allows you to create a command line interface very easily.

**[config](packages/config)**

Utilities to get configuration from files or `package.json`.

**[error](packages/error)**

Some tools to work with Error objects and their stack.

**[eslint-config-quase](packages/eslint-config-quase)**

The Eslint configuration that we use.

**[parser](packages/languages/parser)**

Parser generator.

**[package-manager](packages/package-manager)**

An experimental package manager that removes the need for having a huge `node_modules` folder.

**[path-url](packages/path-url)**

Utilities to handle paths and urls.

**[publisher](packages/publisher)**

A package publisher heavily inspired by [np](https://github.com/sindresorhus/np).

**[schema](packages/schema)**

Data validation, defaults application, merging.

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

## FAQ

**What name is that?**

`Quase` means `almost` in portuguese. The idea came because we wanted this to include "almost everything".
