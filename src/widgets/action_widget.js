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
 */
function ActionWidget( args, name, fire, description, blockers ) {

    Widget.call( this, args, name );

    this.value = {};
    this._name = 'action_widget ' + name;

    var widget = this;

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
        return args.v.get( args.namespace, names, keys ? keys : args.keys, parser );
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
});
ActionWidget.prototype.constructor = ActionWidget;

/**
 * @summary Action built by this selector
 * @return {Action}
 */
ActionWidget.prototype.action = function() { return new Action( this._name, this._action ) }

// child classes call this, and we define it here in case we need to override it some day:
ActionWidget.prototype.val = Widget.prototype.val;
