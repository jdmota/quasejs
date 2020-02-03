require("symbol-observable");
require("any-observable/register")("rxjs", {
  Observable: require("rxjs").Observable,
});
