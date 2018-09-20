// @flow
import { type PluginsRunnerInWorker, PluginsRunner } from "../plugins/runner";
import type { Options } from "../types";
import typeson from "./typeson";

const childProcess = require( "child_process" );
const path = require( "path" );

const maxConcurrentWorkers = Math.max( require( "os" ).cpus().length, 1 );
const maxConcurrentCallsPerWorker = 5;

type Defer = {
  promise: Promise<any>,
  resolve: any => void,
  reject: Error => void
};

type CallInfo = {
  method: string,
  args: any[]
};

type PendingCall = {
  method: string,
  args: any[],
  defer: Defer,
  retry: number
};

type Call = {
  id: number,
  method: string,
  args: any[],
  child: Child, // eslint-disable-line no-use-before-define
  defer: Defer,
  retry: number
};

type Child = {
  child: any,
  calls: Set<Call>,
  ready: boolean,
  exitTimeout: ?any
};

function createDefer(): Defer {
  let resolve, reject;
  const promise = new Promise( ( a, b ) => {
    resolve = a;
    reject = b;
  } );
  // $FlowIgnore
  return {
    promise,
    resolve,
    reject
  };
}

export class Farm {

  +children: Set<Child>;
  +calls: Map<number, Call>;
  +initOptions: Options;
  +encapsulatedOptions: Object;
  +localPluginsRunner: PluginsRunner;
  callUUID: number;
  pending: PendingCall[];
  useWorkers: boolean;
  ended: boolean;

  constructor( initOptions: Options ) {
    this.children = new Set();
    this.calls = new Map();
    this.initOptions = initOptions;
    this.localPluginsRunner = new PluginsRunner();
    this.callUUID = 1;
    this.pending = [];
    this.useWorkers = false;
    this.ended = false;
    this.encapsulatedOptions = typeson.encapsulate( this.initOptions );
  }

  mkhandle( method: string ) {
    return ( ...args: any[] ) => {
      return this.addCall( {
        method,
        args
      } );
    };
  }

  async setup(): Promise<PluginsRunnerInWorker> {
    const iface = {};
    for ( const m of PluginsRunner.workerMethods ) {
      if ( m !== "init" ) {
        iface[ m ] = this.mkhandle( m );
      }
    }

    while ( this.children.size < maxConcurrentWorkers ) {
      this.startChild();
    }

    await this.localPluginsRunner.init( this.initOptions );

    // $FlowIgnore
    return iface;
  }

  startChild() {
    // https://github.com/nodejs/node/issues/14325
    const execArgv = process.execArgv.filter(
      v => !/^--(debug|inspect)/.test( v )
    );

    const options = {
      execArgv,
      env: process.env,
      cwd: process.cwd()
    };

    const child = childProcess.fork( path.join( __dirname, "fork.js" ), options );

    const c: Child = {
      child,
      calls: new Set(),
      ready: false,
      exitTimeout: null
    };

    child.on( "message", this.receive.bind( this ) );
    child.on( "error", error => {
      if ( error.code === "ERR_IPC_CHANNEL_CLOSED" ) {
        this.stopChild( c );
      }
    } );
    child.once( "exit", () => {
      if ( c.exitTimeout ) {
        clearTimeout( c.exitTimeout );
      }
      this.onExit( c );
    } );

    this.children.add( c );

    const defer = createDefer();

    this.send( c, {
      method: "init",
      args: [ this.encapsulatedOptions ],
      defer,
      retry: 0
    } );

    return defer.promise.then( () => {
      c.ready = true;
      this.useWorkers = true;
    }, error => {
      console.error( error ); // eslint-disable-line no-console
      this.stopChild( c );
      throw error;
    } );
  }

  findChild(): ?Child {
    let child;
    let max = maxConcurrentCallsPerWorker;

    // Choose worker with less pending calls
    for ( const worker of this.children ) {
      if ( worker.ready && worker.calls.size < max ) {
        child = worker;
        max = worker.calls.size;
      }
    }

    return child;
  }

  runLocal( { method, args }: CallInfo ): any {
    // $FlowIgnore
    return this.localPluginsRunner[ method ]( ...args );
  }

  addCall( callInfo: CallInfo ): Promise<any> {
    const defer = createDefer();
    if ( this.ended ) {
      return defer.promise;
    }

    if ( !this.useWorkers ) {
      return this.runLocal( callInfo );
    }

    const { method, args } = callInfo;

    this.pending.push( {
      method,
      args: args.map( x => typeson.encapsulate( x ) ),
      defer,
      retry: 0
    } );

    this.processPending();
    return defer.promise;
  }

  receive( data: { id: number, result: any, error: any } ) {
    const { id, result: _result, error: _error } = data;
    let result, error;

    if ( _error ) {
      const { message, stack } = _error;
      error = new Error( message );
      error.stack = stack;
    } else {
      result = typeson.revive( _result );
    }

    const call = this.calls.get( id );

    if ( call ) {
      const { child, defer } = call;

      this.calls.delete( id );
      child.calls.delete( call );

      if ( error ) {
        defer.reject( error );
      } else {
        defer.resolve( result );
      }
    }

    this.processPending();
  }

  send( child: Child, pendingCall: PendingCall ) {
    const id = this.callUUID++;
    const { method, args, defer, retry } = pendingCall;
    const call: Call = {
      id,
      method,
      args,
      child,
      defer,
      retry
    };

    this.calls.set( id, call );
    child.calls.add( call );

    child.child.send( {
      id,
      method,
      args
    } );
  }

  processPending() {
    if ( this.ended ) {
      return;
    }

    if ( this.children.size < maxConcurrentWorkers ) {
      this.startChild();
    }

    let child;
    while ( this.pending.length > 0 && ( child = this.findChild() ) ) {
      this.send( child, this.pending.shift() );
    }
  }

  onExit( child: Child ) {
    if ( this.ended ) {
      return;
    }

    this.children.delete( child );
    setTimeout( () => {
      for ( const call of child.calls ) {
        this.calls.delete( call.id );

        if ( call.method !== "init" ) {
          if ( call.retry > 2 ) {
            call.defer.reject( new Error( "Exceeded retries" ) );
          } else {
            this.pending.push( {
              method: call.method,
              args: call.args,
              defer: call.defer,
              retry: call.retry + 1
            } );
          }
        }
      }
      this.processPending();
    }, 10 );
  }

  stopChild( child: Child ) {
    if ( this.children.delete( child ) ) {
      child.child.send( "die" );
      child.exitTimeout = setTimeout( () => {
        child.child.kill( "SIGKILL" );
      }, 100 );
    }
  }

  stop() {
    if ( this.ended ) {
      return;
    }
    this.ended = true;

    for ( const child of this.children ) {
      this.stopChild( child );
    }
  }

}
