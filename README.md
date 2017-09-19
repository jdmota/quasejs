# QuaseJS

<!--[Documentation](/docs) | [Install](#installation)-->

The purpose of QuaseJS is to include various packages, smaller ones or bigger ones, that are useful for different tasks and that make the lives of JavaScript developers easier.

## :construction: This is a work in progress. The modules listed here are not yet fully implemented and were not published. :construction:

## Features and available modules

**builder**

It's a bundler with easy configuration and good performance.

**cli**

Allows you to create a command line interface very easily.

**error**

Some tools to work with Error objects and their stack.

**eslint-config-quase**

The Eslint configuration that I use.

**events**

A copy of NodeJS's `events` module that also works on the browser.

**fs**

`fs-extra` + additional tools.

**package-manager**

An experimental package manager that uses a global store and a combination of hard/soft links.

**pathname**

Allows you to resolve, normalize and match pathnames.

**source-map**

Tools to work with source maps.

**unit**

A unit testing library.

**view**

- Create user interfaces with declarative templates.
- Makes use of the Custom Elements and Shadow Root specs.
- Implements one-way data flow.
- Has a compiler that removes the need for a diffing algorithm.

**More?**

TODO

## Installation

*Not published yet*

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
