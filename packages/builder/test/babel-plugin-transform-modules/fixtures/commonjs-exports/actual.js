module.exports.thing();

exports.thing();

module.exports.foo = {};

exports.bar = {};

const abc = module.exports.abc = function() {
  const module = { exports: {} };
  module.exports.foo = {};
};
