/* global window, document, HTMLElement, customElements */

window.QuaseView = ( function() {

  function baseToString( value ) {
    if ( typeof value === "string" ) {
      return value;
    }
    const result = String( value );
    return ( result === "0" && ( 1 / value ) === -Infinity ) ? "-0" : result;
  }

  function toString( value ) {
    return value == null ? "" : baseToString( value );
  }

  function showHideChildren( elem, hide ) {
    let n = elem.firstChild;
    while ( n ) {
      // Ignore non-changes
      if ( Boolean( hide ) !== Boolean( n.__hideTemplateChildren__ ) ) {
        if ( n.nodeType === 3 ) { // text node
          if ( hide ) {
            n.__textContent__ = n.textContent;
            n.textContent = "";
          } else {
            n.textContent = n.__textContent__;
          }
        } else if ( n.style ) {
          if ( hide ) {
            n.__display__ = n.style.display;
            n.style.display = "none";
          } else {
            n.style.display = n.__display__;
          }
        }
        n.__hideTemplateChildren__ = hide;
      }
      n = n.nextSibling;
    }
  }

  class QuaseView extends HTMLElement {
    constructor() {
      super();
      this._ready = false;
      this.attachShadow( { mode: "open" } );
      if ( this.constructor.__template ) {
        this.shadowRoot.appendChild( this.constructor.__template.content.cloneNode( true ) );
      }
    }
    static get observedAttributes() {
      // Note: `this` is the class itself
      if ( !this._observedAttributes ) {
        this._observedAttributes = Object.keys( this.props || {} );
      }
      return this._observedAttributes;
    }
    forceUpdate() {
      this._render( this.shadowRoot, toString );
    }
    _render() { // eslint-disable-line class-methods-use-this
      // Noop
    }
    connectedCallback() {
      /* const attrs = this.attributes;
      for ( let i = 0; i < attrs.length; i++ ) {
        const name = attrs[ i ].name;
        const value = attrs[ i ].value;
        this[ name ] = value;
      } */
      this._ready = true;
      this.forceUpdate();
    }
    attributeChangedCallback( name, oldValue, newValue ) {
      if ( this._ready && oldValue !== newValue ) {
        // this[ name ] = newValue;
        this.forceUpdate();
      }
    }
  }

  const modules = Object.create( null );

  QuaseView.__template = null;

  QuaseView.define = function( name, clazz ) {
    if ( modules[ name ] ) {
      throw new Error( "QuaseView: module " + name + " already defined" );
    }
    modules[ name ] = true;
    clazz.__template = document.currentScript.parentNode.querySelector( "template" );
    customElements.define( name, clazz );
  };

  QuaseView.showHideChildren = showHideChildren;

  customElements.define( "quase-if", class QuaseIf extends QuaseView {

    constructor() {
      super();
      this._if = !!this.if;
      this._renderTemplate = this.render;
      this.shadowRoot.appendChild( this.querySelector( "template" ).content.cloneNode( true ) );
      Object.defineProperty( this, "if", {
        get() {
          return this._if;
        },
        set( b ) {
          if ( this._if !== !!b ) {
            this._if = !this._if;
            if ( this._if ) {
              this.forceUpdate();
            }
            showHideChildren( this.shadowRoot, !this._if ); // Hide
          }
          return b;
        }
      } );
      Object.defineProperty( this, "render", {
        get() {
          return this._renderTemplate;
        },
        set( f ) {
          this._renderTemplate = f;
          if ( this._if ) {
            this.forceUpdate();
          }
          return f;
        }
      } );
    }

    connectedCallback() {
      super.connectedCallback();
      showHideChildren( this.shadowRoot, !this._if );
    }

    forceUpdate() {
      if ( this._ready && this._renderTemplate ) {
        this._renderTemplate( this.shadowRoot, toString );
      }
    }

  } );

  return QuaseView;

} )();
