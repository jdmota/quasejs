export var test = 2;
test = 5;
test++;

(function () {
  var test = 2;
  test = 3;
  test++;
})();

var a = 2;
export { a };
a = 3;

var b = 2;
export { b as c };
b = 3;

var d = 3;
export { d as e, d as f };
d = 4;

export { yy, zz };

var yy = 0;
var zz = yy++;

export const { foo: bar, baz } = {};

bar++;
baz++;

bar = 10;
baz = 10;
