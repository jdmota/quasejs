export default typeof require === "undefined" ? /* istanbul ignore next */ function() { return {}; } : require;

export const reqFn = typeof require === "undefined" ? /* istanbul ignore next */ function() { return function() {}; } : require;
