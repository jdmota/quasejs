module.exports.thing();

exports.thing();

module.exports.foo = {};

exports.bar = {};

require( "package" );

const abc = module.exports.abc = function() {
  const module = { exports: {} };
  module.exports.foo = {};
};

module.exports = function() {

};

const req = require;
