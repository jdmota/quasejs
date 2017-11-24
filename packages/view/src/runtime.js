( function( factory ) {
  if ( typeof module !== "undefined" && module.exports ) {
    module.exports = factory;
  } else {
    factory( window ); // eslint-disable-line no-undef
  }
} )( function( win ) {

  const doc = win.document;

  function handlePart( instance, node, part ) {
    switch ( part[ 0 ] ) {
      case "attr":
        return new AttributePart( instance, node, part[ 2 ], part[ 3 ] );
      case "prop":
        return new PropertyPart( instance, node, part[ 2 ], part[ 3 ] );
      case "event":
        return new EventPart( instance, node, part[ 2 ] );
      case "node":
        return new NodePart( instance, node );
      default:
    }
    throw new Error( `Unknown part type ${part[ 0 ]}` );
  }

  class Template {
    constructor( parts, html ) {
      this.element = doc.createElement( "template" );
      this.element.innerHTML = html;
      this.parts = parts;
    }
  }

  class TemplateResult {
    constructor( template, values ) {
      this.template = template;
      this.values = values;
    }
  }

  class TemplateInstance {

    constructor( template ) {
      this.template = template;
      this.parts = [];
    }

    update( values ) {
      let valueIndex = 0;
      for ( const part of this.parts ) {
        if ( part.size === undefined ) {
          part.setValue( values[ valueIndex ] );
          valueIndex++;
        } else {
          part.setValue( values, valueIndex );
          valueIndex += part.size;
        }
      }
    }

    createNode() {
      const fragment = doc.importNode( this.template.element.content, true );
      const parts = this.template.parts;

      if ( parts.length > 0 ) {
        // Edge needs all 4 parameters present
        const walker = doc.createTreeWalker(
          fragment,
          129, /* NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT */
          null,
          false
        );

        let index = -1;
        for ( let i = 0; i < parts.length; i++ ) {
          const part = parts[ i ];
          while ( index < part[ 1 ] ) {
            index++;
            walker.nextNode();
          }
          this.parts.push( handlePart( this, walker.currentNode, part ) );
        }
      }
      return fragment;
    }
  }

  class Part {
    constructor( instance, element ) {
      this.instance = instance;
      this.element = element;
    }
    getValue( value ) {
      if ( typeof value === "function" && value.__directive ) {
        value = value( this );
      }
      return value == null ? null : value;
    }
    getValueNoFalse( value ) {
      const v = this.getValue( value );
      return v === false ? null : v;
    }
  }

  class AttributePart extends Part {

    constructor( instance, element, name, strings ) {
      super( instance, element );
      this.name = name;
      this.strings = strings;
      this.size = strings.length - 1;
      this._previousValue = null;
    }

    _interpolate( values, startIdx ) {
      const s = this.strings;
      if ( this.size === 1 && s[ 0 ] === "" && s[ 1 ] === "" ) {
        return this.getValueNoFalse( values[ startIdx ] );
      }

      let text = "";
      for ( let i = 0; i < this.size; i++ ) {
        text += s[ i ] + this.getValueNoFalse( values[ startIdx + i ] );
      }
      return text + s[ this.size ];
    }

    setValue( values, startIdx ) {
      const value = this._interpolate( values, startIdx );
      if ( this._previousValue !== value ) {
        if ( value == null ) {
          this.element.removeAttribute( this.name );
        } else {
          this.element.setAttribute( this.name, value );
        }
        this._previousValue = value;
      }
    }
  }

  class PropertyPart extends AttributePart {
    setValue( values, startIdx ) {
      this.element[ this.name ] = this._interpolate( values, startIdx );
    }
  }

  class EventPart extends Part {

    constructor( instance, element, eventName ) {
      super( instance, element );
      this.eventName = eventName;
      this._listener = null;
    }

    setValue( value ) {
      const listener = this.getValueNoFalse( value );
      const previous = this._listener;
      if ( listener === previous ) {
        return;
      }

      this._listener = listener;
      if ( previous != null ) {
        this.element.removeEventListener( this.eventName, previous );
      }
      if ( listener != null ) {
        this.element.addEventListener( this.eventName, listener );
      }
    }
  }

  class NodePart extends Part {

    constructor( instance, element ) {
      super( instance, element );
      this._previousValue = undefined;
    }

    setValue( value ) {
      value = this.getValue( value );

      if ( value == null || !( typeof value === "object" || typeof value === "function" ) ) {
        if ( value === this._previousValue ) {
          return;
        }
        this._setText( value );
      } else if ( value instanceof TemplateResult ) {
        this._setTemplateResult( value );
      } else if ( Array.isArray( value ) || value[ Symbol.iterator ] ) {
        this._setIterable( value );
      } else if ( value instanceof win.Node ) {
        this._setNode( value );
      } else if ( value.then != null ) {
        this._setPromise( value );
      } else {
        this._setText( value );
      }
    }

    _replace( node ) {
      this.element.parentNode.replaceChild( node, this.element );
      this.element = node;
    }

    _setNode( value ) {
      if ( this._previousValue === value ) {
        return;
      }
      this._replace( value );
      this._previousValue = value;
    }

    _setText( value ) {
      if ( this.element.nodeType === 3 /* Node.TEXT_NODE */ ) {
        this.element.textContent = value;
      } else {
        this._setNode( doc.createTextNode( value == null ? "" : value ) );
      }
      this._previousValue = value;
    }

    _setTemplateResult( value ) {
      let instance;
      if ( this._previousValue && this._previousValue.template === value.template ) {
        instance = this._previousValue;
      } else {
        instance = new TemplateInstance( value.template );
        this._setNode( instance.createNode() );
        this._previousValue = instance;
      }
      instance.update( value.values );
    }

    _setPromise( value ) {
      this._previousValue = value;
      value.then( v => {
        if ( this._previousValue === value ) {
          this.setValue( v );
        }
      } );
    }

    _setIterable( value ) {
      if ( !Array.isArray( this._previousValue ) ) {
        this._replace( doc.createComment( "" ) );
        this._previousValue = [];
      }

      const itemParts = this._previousValue;
      let partIndex = 0;

      for ( const item of value ) {
        let itemPart = itemParts[ partIndex ];

        if ( partIndex >= itemParts.length ) {
          itemPart = new NodePart( this.instance, doc.createComment( "" ) );
          itemParts.push( itemPart );
          this.element.parentNode.insertBefore( itemPart.element, this.element );
        }

        itemPart.setValue( item );
        partIndex++;
      }

      for ( let i = partIndex; i < itemParts.length; i++ ) {
        const element = itemParts[ i ].element;
        element.parentNode.removeChild( element );
      }
      itemParts.length = partIndex;
    }

  }

  function render( result, container ) {
    let instance = container.__templateInstance;

    if ( instance != null && instance.template === result.template ) {
      instance.update( result.values );
      return;
    }

    instance = new TemplateInstance( result.template );
    container.__templateInstance = instance;

    const fragment = instance.createNode();
    instance.update( result.values );

    container.appendChild( fragment );
  }

  class QuaseView extends win.HTMLElement {
    constructor() {
      super();
      this._ready = false;
      this.attachShadow( { mode: "open" } );
    }
    static get observedAttributes() {
      // Note: `this` is the class itself
      return Object.keys( this.props || {} );
    }
    forceUpdate() {
      QuaseView.render( this.render(), this.shadowRoot );
    }
    connectedCallback() {
      this._ready = true;
      this.forceUpdate();
    }
    attributeChangedCallback( name, oldValue, newValue ) {
      if ( this._ready && oldValue !== newValue ) {
        this.forceUpdate();
      }
    }
  }

  QuaseView.Template = Template;
  QuaseView.TemplateResult = TemplateResult;
  QuaseView.render = render;

  const modules = Object.create( null );

  QuaseView.define = function( name, clazz ) {
    if ( modules[ name ] ) {
      throw new Error( "QuaseView: module " + name + " already defined" );
    }
    modules[ name ] = true;
    win.customElements.define( name, clazz );
  };

  win.QuaseView = QuaseView;
  return QuaseView;
} );
