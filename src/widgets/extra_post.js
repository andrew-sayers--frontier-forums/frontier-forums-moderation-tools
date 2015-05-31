/**
 * @file Optionally post a in a thread
 * @author Andrew Sayers
 */

/**
 * @summary Optionally post a in a thread
 * @constructor
 * @extends ActionWidget
 * @param {Object} args post arguments
 * @example
 *
 * var post = new ExtraPost({
 *
 *     // default values (can be changed with val()):
 *     namespace      : 'variables namespace', // namespace to retrieve variables from
 *     title_variable : 'Title variable', // variable to use for PM title or infraction reason
 *     bbcode_variable: 'BBCode variable', // variable to use for BBCode
 *     keys           : {...}, // keys to use when resolving variables
 *     // these two usually aren't used:
 *     // title : 'initial text for PM title',
 *     // bbcode: 'initial text for BBCode',
 *     thread_desc: 'name of thread to show the user',
 *     thread_id  : 12345, // post will be placed in this thread
 *     visible    : true, // or false to hide
 *     checked    : true, // or false to uncheck
 *     text       : 'message to display'
 *
 *     // other data needed for the widget to function:
 *     v           : variables, // Variables object
 *     bb          : bb, // BulletinBoard object
 *     callback    : function(keys) { ... }, // called with the current data
 *     container   : widget_appended_to_this
 *
 * });
 */
function ExtraPost( args ) {

    var post_id;

    ActionWidget.call(
        this, args, 'extra_post', [ 'title', 'bbcode' ],
        function(keys) { // fire
            var value = this.val();
            if ( value.checked ) {
                return args.bb.thread_reply({
                    thread_id: value.thread_id,
                    title    : this.resolve_value( 'title' , [], keys ),
                    bbcode   : this.resolve_value( 'bbcode', [], keys )
                }).then(function(_post_id) {
                    post_id = _post_id;
                    return { keys: $.extend( {}, value.keys, {
                        'extra actions': '[post=' + post_id + ']replied to ' + value.thread_desc + '[/post]'
                    })};
                });
            } else {
                return $.Deferred().resolve({ keys: { 'extra actions': '(none)' }}).promise();
            }
        },
        function() { // description
            if ( this.element.find('input').prop( 'checked' ) ) {
                    return [{
                        type: 'post',
                        target: {
                            thread_desc: this.value.thread_desc,
                            thread_id  : this.value.thread_id,
                            post_id    : post_id
                        }
                    }]
            }
        }
    );

    this.value = {
        visible        : null,
        checked        : null,
        text           : null,
        thread_id      : null,
        thread_desc    : null,
        keys           : null
    };

    this.val(args);

}

ExtraPost.prototype = Object.create(ActionWidget.prototype, {});
ExtraPost.prototype.constructor = ExtraPost;

/**
 * @summary Get/set widget's values
 * @param {Object} value new value
 * @return {Object} (new) value
 * @example
 *
 * ns.val({
 *     visible : true, // or false to hide
 *     checked : true, // or false to uncheck
 *     text    : 'message to display'
 * });
 *
 */
ExtraPost.prototype.val = function( value ) {

    if ( value ) {

        if ( value.hasOwnProperty('visible') ) {
            if ( value.visible )
                this.element.show();
            else
                this.element.hide();
        }

        if ( value.hasOwnProperty('text') ) {
            this.element.find('.extra-text').text( value.text );
        }

        ActionWidget.prototype.val.call( this, value );

        if ( value.hasOwnProperty('checked') && this.element.find('input').prop('checked') != value.checked ) {
            this.element.find('input')
                .prop( 'checked', value.checked )
                .change();
        }

    }

    return $.extend( ActionWidget.prototype.val.call(this), {
        checked: this.element.find('input').prop( 'checked' )
    });

}
