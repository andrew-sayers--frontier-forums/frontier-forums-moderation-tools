/**
 * @file Optionally make a reminder to perform some action before a deadline
 * @author Andrew Sayers
 */

/**
 * @summary Optionally create a chase-up post
 * @constructor
 * @extends ActionWidget
 * @param {Object} args deadline arguments
 * @example
 *
 * var post = new Deadline({
 *
 *     // default values (can be changed with val()):
 *     namespace      : 'variables namespace', // namespace to retrieve variables from
 *      title_variable: 'Title variable', // variable to use for PM title or infraction reason
 *     bbcode_variable: 'BBCode variable', // variable to use for BBCode
 *     keys           : {...}, // keys to use when resolving variables
 *     // these two usually aren't used:
 *     // title : 'initial text for PM title',
 *     // bbcode: 'initial text for BBCode',
 *     visible    : true, // or false to hide
 *     deadline   : '+7d',
 *
 *     // other data needed for the widget to function:
 *     v        : variables, // Variables object
 *     bb       : bb, // BulletinBoard object
 *     callback : function(keys) { ... }, // called with the current data
 *     container: widget_appended_to_this,
 *     value_var: 'list of valid deadlines variable'
 *
 * });
 *
 * @description 'value_var' should be a variable in the specified namespace,
 * and be a list of values like '<duration>: <message text>', e.g.
 * '+5h: remind me to do something in 5 hours'.
 *
 */
function Deadline( args ) {

    var post_id;

    var widget = this;

    var thread_id = args.v.resolve('frequently used posts/threads', 'Moderation Chase-Up Thread' );

    ActionWidget.call(
        this, args, 'deadline', [ 'title', 'bbcode' ],
        function(keys) { // fire
            if ( parse_duration(this.element.val()) ) {
                return args.bb.thread_reply({
                    thread_id: thread_id,
                    title    : widget.resolve_value( 'title' , [], keys ),
                    bbcode   : widget.resolve_value( 'bbcode', [], keys ),
                }).then(function(post_id) {
                    return { keys: {
                        'chase-up post id': post_id,
                        'extra actions'   : '[post=' + post_id + ']replied to the chase-up thread[/post]'
                    }};
                });
            } else {
                return { keys: { 'extra actions': '(none)' }};
            }
        },
        function() { // description
            if ( parse_duration(this.element.val()) ) {
                return [{
                    type: 'post',
                    target: {
                        thread_desc: 'the chase-up thread',
                        thread_id  : thread_id,
                        post_id    : post_id
                    }
                }];
            }
        },
        function(keys) { // summary
            return 'post [post=' + keys['chase-up post id'] + ']a reminder[/post]';
        }
    );

    this.element
        .append(
            args.deadlines.map(function(deadline) {
                return $('<option>').attr( 'value', deadline.value ).text( deadline.text );
            })
        );

    $.extend(this.value, {
        visible        : null,
        checked        : null,
        text           : null,
        keys           : null,
        deadline       : null
    });

    this.val(args);

}

Deadline.prototype = Object.create(ActionWidget.prototype, {});
Deadline.prototype.constructor = Deadline;

/**
 * @summary Get/set widget's values
 * @param {Object} value new value
 * @return {Object} (new) value
 * @example
 *
 * ns.val({
 *     visible : true, // or false to hide
 *     deadline: '+7d'
 * });
 *
 */
Deadline.prototype.val = function( value ) {

    if ( value ) {

        if ( value.hasOwnProperty('visible') ) {
            if ( value.visible )
                this.element.show();
            else
                this.element.hide();
        }

        ActionWidget.prototype.val.call( this, value );

        if ( value.hasOwnProperty('deadline') && this.element.val() != value.deadline ) {
            this.element.val(value.deadline).change();
        }

    }

    return $.extend( ActionWidget.prototype.val.call(this), {
        deadline: this.element.val()
    });

}
