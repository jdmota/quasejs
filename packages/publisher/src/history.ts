/* eslint-disable no-console */

const arrowUp = "↑";
const arrowDown = "↓";
const arrowRight = "→";

type CmdEntry = string[];

type HistoryEntry =
  | {
      start: true;
      end: false;
      op: CmdEntry;
    }
  | {
      start: false;
      end: true;
      op: CmdEntry;
    };

export default class History {
  history: HistoryEntry[];

  constructor() {
    this.history = [];
  }

  start(op: CmdEntry) {
    this.history.push({
      start: true,
      end: false,
      op,
    });
  }

  end(op: CmdEntry) {
    this.history.push({
      start: false,
      end: true,
      op,
    });
  }

  show() {
    if (this.history.length === 0) {
      return;
    }

    console.error("You might need to undo some operations:");

    for (let i = 0; i < this.history.length; i++) {
      const { start, op } = this.history[i];
      const next = this.history[i + 1];

      if (start && next && next.end && next.op === op) {
        console.error(`${arrowRight} Started and finished: ${op.join(" ")}`);
      } else if (start) {
        console.error(`${arrowUp} Started: ${op.join(" ")}`);
      } else {
        console.error(`${arrowDown} Finished: ${op.join(" ")}`);
      }
    }
  }
}
