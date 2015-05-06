/**
 * @file Base class for widgets that create Action objects
 * @author Andrew Sayers
 */

/**
 * @summary Base class for widgets that create Action objects
 * @constructor
 * @extends Widget
 * @param {Object}   args        widget arguments
 * @param {string}   name        name of child object (passed in from child constructor)
 * @param {function} fire        fire the associated action (passed in from child constructor)
 * @param {Array}    values      list of values to manage specially
 * @param {function} description describe the associated action (passed in from child constructor)
 * @param {function} blockers    list of things that are blocking the action from firing
 * @example
 *
 * var widget = new ChildOfActionWidget({
 *
 *     // default values (can be changed with val()):
 *     namespace      : 'variables namespace', // namespace to retrieve variables from
 *     keys           : {...}, // keys to use when resolving variables
 *
 *     // other data needed for the widget to function:
 *     v           : variables, // Variables object
 *     thread_id   : 12345, // variables will be parsed as if rendered in this thread
 *     callback    : function(keys) { ... }, // called with the current data
 *     container   : widget_appended_to_this
 *
 * });
 *
 * @description Children are encouraged to extend the 'value' object.
 * The 'values' element is just sugar for managing values that can be passed as
 * a raw string or a variable name that may or may not exist.
 */
function ActionWidget( args, name, values, fire, description, summary, blockers ) {

    Widget.call( this, args, name );

    var widget = this;

    this._values = values;
    this._stored_values = {};
    this._maps = {};

    this.value = {};
    values.forEach(function(v) {
        widget.value[v] = null;
        widget.value[v + '_variable'] = null;
        widget._stored_values[v] = '';
        widget._maps[v] = {};
    });
    this._name = 'action_widget ' + name;

    this._action = {
        fire       : function(keys) { return fire.call( widget, $.extend( keys, widget.value.keys ) ) },
        description: function(    ) {
            var descriptions = description.call( widget );
            if ( descriptions )
                descriptions.forEach(function(d) { d.template = 'action_widget ' + name; d.value = widget.val() });
            return descriptions;
        },
        blockers: function() { return blockers ? blockers.call( widget ) : [] }
    };

    // Resolve variable names using the passed-in values:
    this._resolve = function(names, keys, parser) {
        return args.v.resolve( args.namespace, names, keys ? keys : args.keys, parser, undefined, args.thread_id );
    }
    this._get = function(names) {
        return args.v.get( args.namespace, names, undefined, args.thread_id );
    }
    this._parse = function(text, keys, parser) {
        return args.v.parse( text, keys ? keys : args.keys, parser );
    }

}

ActionWidget.prototype = Object.create(Widget, {
    bb     : { writable: true, configurable: false },
    _name  : { writable: true, configurable: false },
    _action: { writable: true, configurable: false },

    // variable resolution - call these in child objects
    _resolve: { writable: true, configurable: false },
    _get    : { writable: true, configurable: false },
    _parse  : { writable: true, configurable: false },

    // mapping stored <-> edited values
    _values       : { writable: true, configurable: false },
    _stored_values: { writable: true, configurable: false },
    _maps         : { writable: true, configurable: false },
});
ActionWidget.prototype.constructor = ActionWidget;

/**
 * @summary Action built by this selector
 * @return {Action}
 */
ActionWidget.prototype.action = function() { return new Action( this._name, this._action ) }

/**
 * @summary Specify new values for reset_value()
 * @description records values from this.val(), will return them on reset
 */
ActionWidget.prototype.update_previous_values = function() {
        var values = this.val();
        var widget = this;
        this._values.forEach(function(value) {
            var stored_value = widget._stored_values[value];
            widget._stored_values[value] = '';
            if ( stored_value != '' ) widget._maps[value][stored_value] = values[value];
        });
}

/**
 * @summary Resolve one of the values defined in the constructor
 * @param {string}  name        variable name
 * @param {string}  name_suffix array appended to variable name during resolution
 * @param {Object=} keys        keys to use when resolving
 * @param {string=} parser      how to parse the variable
 * @param {string|null} value (if defined) or null (otherwise)
 */
ActionWidget.prototype.resolve_value = function( name, name_suffix, keys, parser ) {
    switch ( this.value[name] ) {
    case false: return this._stored_values[name];
    case null:
        if ( this.value[name + '_variable'] === null ) return null;
        var ret = this._get(
            ( $.isArray(this.value[name + '_variable']) ? this.value[name + '_variable'].slice(0) : [ this.value[name] ] ).concat(name_suffix || [])
        );
        if ( ret.text === null ) return null;
        ret = this._parse( ret.text, keys, parser );
        return (
            this._maps[name].hasOwnProperty(ret)
            ? this._maps[name][ret]
            :                  ret
        );
    default:
        return this.value[name];
    }
}

/**
 * @summary Update the "reset" data and get a new value (if changed)
 * @param {string}  current_value current value as entered by the user (which we can reset to)
 * @param {string}  name          variable name
 * @param {string}  name_suffix   array appended to variable name during resolution
 * @param {Object=} keys          keys to use when resolving
 * @param {string=} parser        how to parse the variable
 * @param {string=} new value (if defined and in need of an update)
 */
ActionWidget.prototype.set_value = function( current_value, name, name_suffix, keys, parser ) {

    if ( typeof(this.value[name]) == 'string' ) {

        var ret = this._stored_values[name] = this.value[name];
        this.value[name] = false;
        return ret;

    } else {

        if ( !this.value.hasOwnProperty(name + '_variable') ) return;

        var var_name = this.value[name + '_variable'];

        if ( var_name === null ) return;

        var ret = this._get(
            ( $.isArray(var_name) ? var_name.slice(0) : [var_name] ).concat(name_suffix || [])
        );

        if ( ret.text === null ) return;

        ret = this._parse( ret.text, keys, parser );

        var stored_value = this._stored_values[name];
        if ( ret == stored_value ) return;

        if ( stored_value != '' ) this._maps[name][stored_value] = current_value;
        this._stored_values[name] = ret;

        return (
            this._maps[name].hasOwnProperty(ret)
            ? this._maps[name][ret]
            :                  ret
        );

    }
}

/**
 * @summary Update the "reset" data and get a stored value
 * @param {string}  current_value current value as entered by the user (which we can reset to)
 * @param {string}  name          variable name
 * @return {string} new value
 *
 * @description this should be called by a "reset" button, to reset the
 * contents of an input to a recent value
 */
ActionWidget.prototype.reset_value = function(current_value, name) {
    if (
        current_value == this._stored_values[name] &&
        this._maps[name].hasOwnProperty(current_value)
    ) {
        var ret = this._maps[name][current_value];
        delete this._maps[name][current_value];
        return ret;
    } else {
        this._maps[name][this._stored_values[name]] = current_value;
        return this._stored_values[name];
    }
}

// child classes call this, and we define it here in case we need to override it some day:
ActionWidget.prototype.val = Widget.prototype.val;
