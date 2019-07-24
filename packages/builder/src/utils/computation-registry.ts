/* eslint-disable @typescript-eslint/no-non-null-assertion */

export type CValue<T> = Readonly<[ Readonly<T>, null ] | [ null, Error ]>;

function copySet<T>( a: Set<T>, b: Set<T> ) {
  for ( const e of a ) {
    b.add( e );
  }
  a.clear();
}

export abstract class Computation<T> {

  private deleted: boolean;
  private runId: {} | null;
  private running: Promise<CValue<T>> | null;
  private value: Readonly<T> | null;
  private oldValue: Readonly<T> | null;
  private error: any;
  protected registry: ComputationRegistry;
  protected subscribers: Set<Computation<any>>;
  protected oldSubscribers: Set<Computation<any>>;
  protected dependencies: Set<Computation<any>>;

  constructor( registry: ComputationRegistry ) {
    this.deleted = false;
    this.runId = null;
    this.running = null;
    this.value = null;
    this.oldValue = null;
    this.error = null;
    this.registry = registry;
    this.subscribers = new Set();
    this.oldSubscribers = new Set();
    this.dependencies = new Set();
    this.registry.markPending( this );
  }

  subscribe( sub: Computation<any> ) {
    this.subscribers.add( sub );
    this.oldSubscribers.delete( sub );
    sub.dependencies.add( this );
  }

  unsubscribe( sub: Computation<any> ) {
    this.subscribers.delete( sub );
    this.oldSubscribers.delete( sub );
    sub.dependencies.delete( this );
  }

  peekValue() {
    if ( this.value ) {
      return this.value;
    }
    throw new Error( "Assertion error: no value" );
  }

  peekError() {
    if ( this.error ) {
      return this.error;
    }
    throw new Error( "Assertion error: no error" );
  }

  protected equals( old: T, val: T ) {
    return old === val;
  }

  protected after( result: CValue<T>, runId: {} ) {
    const [ _value, err ] = result;
    if ( this.runId === runId ) {
      if ( err ) {
        this.error = err;
        this.registry.markErrored( this );
      } else {
        const value = _value!;

        if ( this.oldValue != null && this.equals( this.oldValue, value ) ) {
          copySet( this.oldSubscribers, this.subscribers );
        } else {
          this.invalidateSubs( this.oldSubscribers );
        }

        this.value = value;
        this.oldValue = null;
        this.error = null;
        this.registry.markDone( this );
      }
    }
    return result;
  }

  getDep<T>( dep: Computation<T> ) {
    dep.subscribe( this );
    return dep.get();
  }

  async get(): Promise<CValue<T>> {
    if ( this.deleted ) {
      return [ null, new Error( "That computation was deleted" ) ];
    }
    if ( !this.running ) {
      const runId = this.runId = {};
      this.running = this.run( this.oldValue, runId ).then(
        v => this.after( v, runId ),
        e => this.after( [ null, e ], runId )
      );
      this.registry.markRunning( this );
    }
    return this.running;
  }

  protected abstract run( _: T | null, runId: {} ): Promise<CValue<T>>;

  invalidate() {
    const { value } = this;
    this.runId = null;
    this.running = null;
    this.error = null;
    this.value = null;
    if ( value ) {
      this.oldValue = value;
    }
    copySet( this.subscribers, this.oldSubscribers );
    this.disconnectFromDeps();
    this.registry.markPending( this );
  }

  private invalidateSubs( subs: ReadonlySet<Computation<any>> ) {
    for ( const sub of subs ) {
      sub.invalidate();
    }
  }

  private disconnectFromDeps() {
    for ( const dep of this.dependencies ) {
      dep.unsubscribe( this );
    }
  }

  destroy() {
    this.deleted = true;
    this.runId = null;
    this.running = null;
    this.value = null;
    this.oldValue = null;
    this.error = null;
    this.disconnectFromDeps();
    this.invalidateSubs( this.oldSubscribers );
    this.invalidateSubs( this.subscribers );
    this.registry.markDestroyed( this );
  }

}

export class ComputationRegistry {

  private pending: Set<Computation<any>>;
  private errored: Set<Computation<any>>;
  private running: Set<Computation<any>>;
  private interrupted: boolean;

  constructor() {
    this.pending = new Set();
    this.errored = new Set();
    this.running = new Set();
    this.interrupted = false;
  }

  markPending( computation: Computation<any> ) {
    this.pending.add( computation );
    this.running.delete( computation );
    this.errored.delete( computation );
  }

  markRunning( computation: Computation<any> ) {
    this.pending.delete( computation );
    this.running.add( computation );
    this.errored.delete( computation );
  }

  markErrored( computation: Computation<any> ) {
    this.pending.delete( computation );
    this.running.delete( computation );
    this.errored.add( computation );
  }

  markDone( computation: Computation<any> ) {
    this.pending.delete( computation );
    this.running.delete( computation );
    this.errored.delete( computation );
  }

  markDestroyed( computation: Computation<any> ) {
    this.pending.delete( computation );
    this.running.delete( computation );
    this.errored.delete( computation );
  }

  interrupt() {
    this.interrupted = true;
  }

  wasInterrupted() {
    return this.interrupted;
  }

  isPending() {
    return !this.interrupted && (
      this.pending.size > 0 ||
      this.running.size > 0
    );
  }

  async run() {
    const errors: any[] = [];

    this.interrupted = false;

    for ( const c of this.errored ) {
      c.invalidate();
    }

    while ( this.isPending() ) {
      for ( const c of this.pending ) {
        c.get();
      }

      for ( const c of this.running ) {
        await c.get();
        break;
      }
    }

    for ( const c of this.errored ) {
      errors.push( c.peekError() );
    }

    return errors;
  }

}
