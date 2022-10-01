// import { from } from "ix/asynciterable";
// import { filter, map } from "ix/asynciterable/operators";
import { Defer, createDefer } from "../utils/deferred";

type JobPoolOptions<Req, Res> = {
  readonly exec: (req: Req) => Promise<Res>;
  readonly reqToStr: (req: Req) => string;
  readonly resToReqs: (res: Res) => Iterable<Req>;
};

export class JobPool<Req, Res> {
  private opts: JobPoolOptions<Req, Res>;
  private cache: Map<string, [Req, Promise<Res>]>;
  private pending: number;
  private notify: Defer<void>;
  private buffer: ([Req, Res] | null)[];

  constructor(opts: JobPoolOptions<Req, Res>) {
    this.opts = opts;
    this.cache = new Map();
    this.pending = 0;
    this.notify = createDefer();
    this.buffer = [];
  }

  private cacheGet(req: Req) {
    const key = this.opts.reqToStr(req);
    let value = this.cache.get(key);
    if (value == null) {
      this.pending++;

      const job = this.opts.exec(req);
      job.then(res => {
        this.buffer.push([req, res]);

        const moreReqs = this.opts.resToReqs(res);
        for (const req of moreReqs) {
          this.cacheGet(req);
        }

        this.pending--;
        if (this.pending === 0) {
          this.buffer.push(null);
        }

        this.notify.resolve();
      });

      this.cache.set(key, [req, job]);
    }
  }

  async *start(entryRequest: Req) {
    this.cacheGet(entryRequest);

    let loop = true;

    while (loop) {
      await (this.notify = createDefer()).promise;

      while (this.buffer.length > 0) {
        const result = this.buffer.shift();
        if (result == null) {
          loop = false;
        } else {
          yield result;
        }
      }
    }
  }
}

async function main() {
  const pool = new JobPool<{ number: number }, { next: number }>({
    exec: async req => {
      if (req.number > 50) {
        return {
          next: -1,
        };
      }
      return {
        next: req.number + 1,
      };
    },
    reqToStr: req => `${req.number}`,
    resToReqs: res => (res.next < 0 ? [] : [{ number: res.next }]),
  });

  const source = pool.start({ number: 0 });

  /*const results = from(source).pipe(
    filter(x => x[0].number % 2 === 0),
    map(x => x)
  );*/

  for await (const item of source) {
    console.log(item);
  }

  console.log("Done!");
}

// main();
