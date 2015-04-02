/**
 * @file Base class for all widgets
 * @author Andrew Sayers
 */

/**
 * @summary Base class for all widgets
 * @constructor
 * @param {Object}   args widget arguments
 * @example
 *
 * var widget = new ChildOfWidget({
 *     callback : function(keys) { ... }, // called with the current data
 *     container: widget_appended_to_this
 * });
 */
function Widget( args, name ) {

    this.element = $(BabelExt.resources.get('res/widgets/' + name + '.html')).appendTo( $(args.container) );

    if ( args.callback ) {
        var widget = this;
        this.element.on( 'input change', function() { args.callback( widget.val() ) });
    }

}

Widget.prototype = Object.create(null, {
    element : { writable: true, configurable: false },
    value   : { writable: true, configurable: false }
});
Widget.prototype.constructor = Widget;

/**
 * @summary Get/set widget's values
 * @param {Object} value new value
 * @return {Object} (new) value
 */
Widget.prototype.val = function( value ) {

    if ( value ) {
        var tv = this.value;
        Object.keys(tv).forEach(function(key) {
            if ( value.hasOwnProperty(key) && typeof(value[key]) != 'undefined' ) tv[key] = value[key];
        });
    }

    return $.extend( {}, this.value );

}
