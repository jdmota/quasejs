import Runner from "../../src/core/runner";

describe("unit", () => {
  ["only", "failing", "todo", "skip"].forEach(type => {
    it(type + " not allowed in strict mode", () => {
      const runner = Runner.init({
        strict: true,
      });
      const test = runner.test;

      expect(() => {
        test[type](() => {});
      }).toThrow(/modifiers are not allowed in strict mode/);
    });
  });

  ["only", "failing", "todo", "skip"].forEach(type => {
    it(type + " not allowed in strict mode (using strict modifier)", () => {
      const runner = Runner.init();
      const test = runner.test;
      let fineHere = false;

      expect(() => {
        test.skip(() => {});
        fineHere = true;
        test.group.strict(() => {
          runner.test[type](() => {});
        });
      }).toThrow(/modifiers are not allowed in strict mode/);

      expect(fineHere).toBe(true);
    });
  });
});
