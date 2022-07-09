function never(n: never) {}

type AllocCommand = {
  command: "alloc";
  to: MemLoc;
};

type ConstCommand = {
  command: "const";
  value: unknown;
  to: MemLoc;
};

type WriteCommand = {
  command: "write";
  from: MemLoc;
  to: MemLoc;
};

type ArithmeticCommand = {
  command: "arithmetic";
  operator: "+" | ">";
  op1: MemLoc;
  op2: MemLoc;
  result: MemLoc;
};

type CondCommand = {
  command: "condition";
  condition: MemLoc;
  then: CodeLoc;
  else: CodeLoc;
};

type ExitCommand = {
  command: "exit";
  result: MemLoc;
};

type MemLoc = {
  address: number;
};

type CodeLoc = {
  location: number;
};

type Command =
  | AllocCommand
  | ConstCommand
  | WriteCommand
  | ArithmeticCommand
  | CondCommand
  | ExitCommand;

type CommandsMap = {
  [key in Command["command"]]: key;
};

type CommandWithTime = {
  command: Command;
  time: number;
};

const commands = {
  alloc(address: number): AllocCommand {
    return {
      command: "alloc",
      to: { address },
    };
  },
  const(value: unknown, to: number): ConstCommand {
    return {
      command: "const",
      value,
      to: { address: to },
    };
  },
  write(from: number, to: number): WriteCommand {
    return {
      command: "write",
      from: { address: from },
      to: { address: to },
    };
  },
  plus(op1: number, op2: number, result: number): ArithmeticCommand {
    return {
      command: "arithmetic",
      operator: "+",
      op1: { address: op1 },
      op2: { address: op2 },
      result: { address: result },
    };
  },
  gt(op1: number, op2: number, result: number): ArithmeticCommand {
    return {
      command: "arithmetic",
      operator: ">",
      op1: { address: op1 },
      op2: { address: op2 },
      result: { address: result },
    };
  },
  cond(condition: number, then: number, _else: number): CondCommand {
    return {
      command: "condition",
      condition: { address: condition },
      then: { location: then },
      else: { location: _else },
    };
  },
  exit(result: number): ExitCommand {
    return {
      command: "exit",
      result: { address: result },
    };
  },
};

type Cell = { value: unknown; command: CommandWithTime };

class Memory {
  map = new Map<number, Cell>();
  nextAddress = 0;

  get(loc: MemLoc) {
    if (loc.address >= this.nextAddress)
      throw new Error(
        `Expected allocated memory address but saw ${loc.address}`
      );
    return this.map.get(loc.address)?.value;
  }

  set(loc: MemLoc, value: unknown, command: CommandWithTime) {
    if (loc.address >= this.nextAddress)
      throw new Error(
        `Expected allocated memory address but saw ${loc.address}`
      );
    this.map.set(loc.address, { value, command });
  }

  alloc(amount: number, command: CommandWithTime): MemLoc {
    if (amount <= 0)
      throw new Error(
        `Expected positive amount of memory to allocate but saw ${amount}`
      );

    const address = this.nextAddress;
    while (amount--) {
      this.map.set(this.nextAddress, { value: null, command });
      this.nextAddress++;
    }
    return { address };
  }

  static new(amount: number) {
    const mem = new Memory();
    mem.alloc(amount, { command: commands.exit(0), time: -1 });
    return mem;
  }

  print() {
    for (const [key, value] of this.map) {
      console.log(`${key} = ${value.value}`);
    }
  }
}

function printState(command: Command, memory: Memory) {
  console.log("Command:");
  console.log(command);
  console.log("Memory:");
  memory.print();
}

function run(memory: Memory, program: readonly Command[]) {
  let time = 0;
  let commandIdx = 0;
  while (commandIdx < program.length) {
    const c = program[commandIdx];
    const cWithTime = { command: c, time };
    printState(c, memory);

    switch (c.command) {
      case "alloc": {
        const newLoc = memory.alloc(1, cWithTime);
        memory.set(c.to, newLoc, cWithTime);
        commandIdx++;
        break;
      }
      case "arithmetic": {
        const op1 = memory.get(c.op1) as number;
        const op2 = memory.get(c.op2) as number;
        switch (c.operator) {
          case "+":
            memory.set(c.result, op1 + op2, cWithTime);
            break;
          case ">":
            memory.set(c.result, op1 > op2, cWithTime);
            break;
          default:
            never(c.operator);
        }
        commandIdx++;
        break;
      }
      case "condition": {
        const condition = memory.get(c.condition);
        if (condition) {
          commandIdx = c.then.location;
        } else {
          commandIdx = c.else.location;
        }
        break;
      }
      case "const": {
        memory.set(c.to, c.value, cWithTime);
        commandIdx++;
        break;
      }
      case "write": {
        const value = memory.get(c.from);
        memory.set(c.to, value, cWithTime);
        commandIdx++;
        break;
      }
      case "exit": {
        return;
      }
      default:
        never(c);
    }
    time++;
  }
}

run(Memory.new(3), [
  commands.const(10, 0), // (0) = 10
  commands.const(5, 1), // (1) = 5
  commands.gt(0, 1, 2), // (2) = (0) > (1)
  commands.cond(2, 4, 7), // if (2) then 4 else 7
  commands.plus(0, 1, 0), // (0) = (0) + (1)
  commands.plus(0, 1, 1), // (1) = (0) + (1)
  commands.exit(0), // exit
  commands.plus(0, 1, 1), // (1) = (0) + (1)
  commands.plus(0, 1, 0), // (0) = (0) + (1)
  commands.exit(0), // exit
]);

// vertices: commands
// locations

// edges from commands to commands
// edges from commands to locations read
