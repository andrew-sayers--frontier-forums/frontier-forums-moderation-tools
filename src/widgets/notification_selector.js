/**
 * @file Notification Selector
 * @author Andrew Sayers
 * @summary Select details for various levels of notification
 */

/**
 * @summary Select details for various levels of notification
 * @constructor
 * @extends ActionWidget
 * @param {Object} args notification arguments
 * @example
 *
 * var notification = new NotificationSelector({
 *
 *     // default values (can be changed with val()):
 *     level               : 'none', // or 'post' or 'PM' or 'warning' or 'infraction'
 *     namespace           : 'variables namespace', // namespace to retrieve variables from
 *     violation           : 'default violation', // string, numeric ID or object
 *     keys                : {...}, // keys to use when resolving variables
 *           title_variable: 'Title variable', // variable to use for post/PM title or infraction reason
 *             ban_variable: 'Ban reason variable', // variable to use for reason to ban an account
 *          bbcode_variable: 'BBCode variable', // variable to use for BBCode
 *      note_title_variable: 'User note title variable', // variable to use for user note title
 *     note_bbcode_variable: 'User note BBCode variable', // variable to use for user note BBCode
 *     // these two usually aren't used:
 *     // title : 'initial text for post/PM title',
 *     // bbcode: 'initial text for BBCode',
 *     show_violations     : false, // show the "violation" dropdown (default: true)
 *
 *     // other data needed for the selector to function:
 *     user            : { username: ..., user_id: ... }, // user to apply action to
 *     v               : variables, // Variables object
 *     bb              : bb, // BulletinBoard object
 *     violation_groups: [{ name: '...', violations: [v1,v2,...]},...], // list of violations to display
 *     thread_id       : 12345, // post goes here, variables and previews will be calculated as if rendered in this thread
 *     thread_desc     : 'name of thread (passed to Action)',
 *     loading_html    : 'Loading, please wait...', // shown while the preview is updated
 *     callback        : function(keys) { ... }, // called with the current data
 *     container       : notification_appended_to_this,
 *     key_prefix      : 'string appended to all keys returned from the action', // default: 'notification '
 *     known_keys      : [ 'key name', ... ], // keys that should not trigger the 'curly brackets detected' warning
 *
 * });
 *
 * @description User notes should always be updated with the contents of a
 * notification action, but sometimes we want to do that in a separate action.
 *
 * When 'note_title_variable' and 'note_bbcode_variable' are not passed,
 * the action will always succeed.  You are expected to write a later action
 * that checks 'notification result' and returns appropriately.
 */
function NotificationSelector( args ) {

    var notification = this;

    var user = { username: args.user.username, user_id: args.user.user_id };

    var key_prefix = args.hasOwnProperty('key_prefix') ? args.key_prefix : 'notification ';

    var post_id;

    ActionWidget.call(
        this, args, 'notification_selector', [ 'title', 'bbcode', 'ban', 'note_title', 'note_bbcode' ],
        function(keys) { // fire

            var value = $.extend( {}, this.val() );

            if ( args.known_keys ) {
                var keys = {};
                args.known_keys.forEach(function(key) {
                    if ( notification.known_keys.hasOwnProperty(key) ) {
                        keys[key] = notification.known_keys[key]
                    } else {
                        console.log( 'Error: known key "' + key + '" was not defined' );
                    }
                });
                value.title  = args.v.parse( value.title , keys );
                value.bbcode = args.v.parse( value.bbcode, keys );
            };

            var return_keys = $.extend( {}, value.keys );
            keys.violation = return_keys.violation = value.violation.name;
            function success() {
                return_keys[key_prefix + 'result'] = 'success';
                var title  = notification.resolve_value( 'note_title' , [], $.extend( keys, return_keys ) );
                var bbcode = notification.resolve_value( 'note_bbcode', [], $.extend( keys, return_keys ) );
                if ( bbcode === null ) {
                    return { keys: return_keys };
                } else {
                    return args.bb.usernote_add( user.user_id, title, bbcode ).then(function() {
                        return { keys: return_keys };
                    });
                }
            };

            function fail(error) {
                return_keys[key_prefix + 'result'] = 'fail';
                return_keys[key_prefix + 'error' ] = error;
                var title  = notification.resolve_value( 'note_title' , [], $.extend( keys, return_keys ) );
                var bbcode = notification.resolve_value( 'note_bbcode', [], $.extend( keys, return_keys ) );
                if ( bbcode === null ) {
                    return { keys: return_keys };
                } else {
                    return args.bb.usernote_add( user.user_id, title, bbcode ).then(function() {
                        var dfd = jQuery.Deferred();
                        dfd.reject(error);
                        return dfd.promise();
                    });
                }
            };

            switch ( value.level ) {

            case 'PM':
                return_keys[key_prefix + 'title' ] = value.title;
                return_keys[key_prefix + 'bbcode'] = value.bbcode;
                return args.bb.pm_send( user.username, value.title, value.bbcode ).then(success,fail);

            case 'post':
                return_keys[key_prefix + 'title' ] = value.title;
                return_keys[key_prefix + 'bbcode'] = value.bbcode;
                return args.bb.thread_reply({
                    thread_id           : notification.thread_id,
                    title               : value.title,
                    bbcode              : value.bbcode
                }).then(function(_post_id) {
                    return_keys[key_prefix + 'post id'] = post_id = _post_id;
                    return success();
                }, fail );

            case 'warning'   : var is_warning = true; // then FALL THROUGH
            case 'infraction':
                return_keys[key_prefix + 'title' ] = notification.resolve_value( 'ban', [], keys )
                return_keys[key_prefix + 'bbcode'] = value.bbcode;
                return args.bb.infraction_give({
                    administrative_note: notification.resolve_value( 'title', [], keys ),
                    ban_reason         : return_keys[key_prefix + 'title'],
                    bbcode             : return_keys[key_prefix + 'bbcode'],
                    user_id            : user.user_id,
                    is_warning         : is_warning,
                    infraction_id      : value.violation.id
                }).then(success,fail);

            case 'none':
                return null;

            }

        },
        function() { // description
            if ( notification.value.level == 'none' ) return;
            var actions = [];
            if ( notification.value.level == 'post' )
                actions.push({ type: notification.value.level, target: { thread_id: args.thread_id, thread_desc: args.thread_desc, post_id: post_id } });
            else
                actions.push({ type: notification.value.level, target: user });
            if ( notification.resolve_value( 'note_bbcode', [], {} ) !== null )
                actions.push({ type: 'usernote', target: user });
            return actions;
        },
        function() { // blockers
            if ( notification.value.level != 'none' && !select.val() )
                return [ 'Please select a violation for ' + user.username ];
        }
    );

    this.bb           = args.bb;
    this.loading_html = args.loading_html;
    this.thread_id    = args.thread_id;
    this.key_prefix   = key_prefix;
    this.known_keys   = {};
    $.extend( this.value, {
        level    : null,
        namespace: null,
        violation: null,
        keys     : null,
    });

    this.button = $('<input class="notification-text-button" type="button">')
        .val( notification.element.hasClass('preview') ? 'switch to edit mode' : 'switch to preview mode' )
        .on( 'click', function() {
            this.value = 'switch to ' + ( notification.element.hasClass('preview') ? 'preview' : 'edit' ) + ' mode';
            notification.mode           ( notification.element.hasClass('preview') ? 'edit' : 'preview' );
        })
        .appendTo(this.element.find('.mode-switch-container').first());

    var select = this.element.find('select');

    if ( args.violation_groups.length == 1 ) {
        select.append(
            args.violation_groups[0].violations.map(function(violation) {
                return $('<option>')
                    .data( 'violation', violation )
                    .val ( violation.id )
                    .text( violation.name );
            })
        );
    } else {
        select.append(
            args.violation_groups.map(function(group) {
                return $('<optgroup>').attr( 'label', group.name )
                    .append(
                        group.violations.map(function(violation) {
                            return $('<option>')
                                .data( 'violation', violation )
                                .val ( violation.id )
                                .text( violation.name );
                        })
                    );
            })
        );
    }

    select.change(function() {

        if ( $(this).val() == '' ) {

            notification.element.addClass('missing-violation');

        } else {

            var value = notification.value;
            var violation = $(':selected',this).data('violation');

            var keys = $.extend( { violation: violation.name, points: violation.points }, value.keys );

            notification.element.removeClass('missing-violation');

            if ( value.level == 'PM' || value.level == 'post' ) {
                var title_element = notification.element.find('.'+value.level + ' .title');
                title_element.val( notification.set_value( title_element.val(), 'title', [keys.violation], keys ) ).change();
            } else if ( value.level != 'none' ) {
                [ 'top', 'bottom' ].forEach(function(location) {
                    notification.element.find('.'+value.level + ' .message-' + location).html(
                        args.v.resolve( 'report process', [value.level + ' message ' + location], keys ) );
                });
            }

            var bbcode_element = notification.element.find('.'+value.level + ' textarea');
            bbcode_element.val( notification.set_value( bbcode_element.val(), 'bbcode', [keys.violation], keys ) ).change();

            if ( notification.element.hasClass('preview') ) {
                var level_element = notification.element.children('.'+value.level);
                level_element.find('.postrow').html( args.loading_html );
                args.bb.bbcode_html( args.thread_id, level_element.find('textarea').val() )
                    .done(function(html) { level_element.find('.postrow').html(html) })
                ;
            }

        }

    });

    var had_literal_curly_brackets = false, had_known_variables = false, known_variable_re;
    if ( args.known_keys ) {
        known_variable_re = new RegExp(
            '{{(?:' + args.known_keys.map(function(key) { return key.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&") }).join('|') + ')}}',
            'g'
        );
    } else {
        known_variable_re = /(?!)/;
    }
    this.element.find('.title,textarea').on( 'input change', function() {
        var has_known_variables = false;
        var text = this.value.replace( known_variable_re, function() {
            has_known_variables = true;
            return '';
        });
        if ( ( text.search('{{') != -1 ) != had_literal_curly_brackets ) {
            notification.element.toggleClass('has-curly-brackets');
            had_literal_curly_brackets ^= true
            if ( had_literal_curly_brackets ) has_known_variables = false;
        }
        if ( has_known_variables != had_known_variables ) {
            notification.element.toggleClass('has-known-variables');
            had_known_variables ^= true;
        }
    });

    this.element.find('.reset').click(function() {
        $(this).siblings('textarea').val( notification.reset_value( $(this).siblings('textarea').val(), 'bbcode' ) );
    });

    this.val(args);

}

NotificationSelector.prototype = Object.create(ActionWidget.prototype, {
    bb          : { writable: true, configurable: false },
    loading_html: { writable: true, configurable: false },
    thread_id   : { writable: true, configurable: false },
    thread_desc : { writable: true, configurable: false },
    user        : { writable: true, configurable: false },
    key_prefix  : { writable: true, configurable: false },
    button      : { writable: true, configurable: false },
    value       : { writable: true, configurable: false },
    known_keys  : { writable: true, configurable: false }
});
NotificationSelector.prototype.constructor = NotificationSelector;


/**
 * @summary Get/set widget's values
 * @param {Object} value new value
 * @return {Object} (new) value
 * @example
 *
 * ns.val({
 *     level          : 'none', // or 'post' || 'PM' or 'warning' or 'infraction'
 *     namespace      : 'variables namespace', // namespace to retrieve variables from
 *     bbcode_variable: 'BBCode variable', // variable to use for BBCode
 *     ban_variable   : 'Ban reason variable', // variable to use for reason to ban an account
 *     title_variable : 'Title variable', // variable to use for post/PM title
 *     keys           : {...}, // keys to use when resolving variables
 *     violation      : 'default violation', // string, numeric ID or object
 *     // these two usually aren't used:
 *     // title  : 'initial text for post/PM title',
 *     // bbcode : 'initial text for BBCode',
 *     data           : ..., arbitrary data used by the calling code
 * });
 *
 * @description
 * Note: In the return object, 'violation' will be set to the current violation
 * object (not the default string), and 'title' and 'bbcode' will be set to the
 * current strings.
 *
 * Values remain unchanged if they aren't passed (no need to pass 'namespace' each time)
 *
 */
NotificationSelector.prototype.val = function( value ) {

    if ( value ) {

        var need_update = ['level', 'namespace', 'bbcode_variable', 'title_variable', 'keys', 'bbcode', 'title' ]
            .reduce(function(prev, property) { return prev || value.hasOwnProperty(property) }, false);

        if ( value.hasOwnProperty('level') && value.level != this.value.level ) {
            this.update_previous_values();
            this.element.removeClass('none post PM warning infraction').addClass(value.level)
                .find('input,select,textarea').prop( 'required', false );
            this.element                          .find('select'  ).prop( 'required', true );
            this.element.children('.'+value.level).find('textarea').prop( 'required', true );
        }

        if ( this.button.closest('.notification-selector').is(this.element) )
            this.element.find('div.' + value.level + ' .mode-switch-container').append(this.button);

        if      ( value.show_violations === false ) this.element.find('.violation-details').hide();
        else if ( value.show_violations === true  ) this.element.find('.violation-details').show();

        if ( value.hasOwnProperty('violation') ) {
            this.update_previous_values();
            var old_violation = this.element.find('select').val();
            switch ( typeof(value.violation) ) {
            case 'string': this.element.find('option').filter(function() { return $(this).text() == value.violation || this.value == value.violation }).prop( 'selected', true ); break;
            case 'number': this.element.find('select').val( value.violation ); break;
            case 'Object': this.element.find('select').val( value.violation.id ); break;
            }
            need_update |= old_violation != this.element.find('select').val();
        }

        ActionWidget.prototype.val.call( this, value );

        if ( need_update )
            this.element.find('select').change();

    }

    return $.extend( ActionWidget.prototype.val.call(this), {
        violation    : this.element.find('option:selected' ).data('violation'),
        title        : this.element.find('.' + this.value.level + ' .title'  ).val(),
        bbcode       : this.element.find('.' + this.value.level + ' textarea').val(),
    });

}

/**
 * @summary Get/set the box's current notification mode
 * @param {string=} mode 'edit' or 'preview'
 * @return {string} (new) mode
 */
NotificationSelector.prototype.mode = function( mode ) {
    if ( mode && !this.element.hasClass(mode) ) {
        this.element.removeClass('edit preview').addClass(mode);
        if ( mode == 'preview' ) {
            var level_element = this.element.children('.'+this.value.level);
            level_element.find('.postrow').html( this.loading_html );
            this.bb.bbcode_html( this.thread_id, level_element.find('textarea').val() )
                .done(function(html) {
                    level_element.find('.postrow').html(html);
                })
            ;
        }
    }
    return this.element.attr('class').replace( /.*\b(edit|preview)\b.*/, "$1" );
}

/**
 * @summary Mode-switching button
 * @return {jQuery}
 * @description this bit of sugar provides a "mode switch" button for the widget
 */
NotificationSelector.prototype.mode_switcher = function() { return this.button }

/**
 * @summary <div> element where you can put "extra" actions
 * @return {jQuery}
 * @description Sometimes it's useful to place another widget inside this one
 * (e.g. an extra action to fire at the same time).  This element is
 * a place to put such widgets
 */
NotificationSelector.prototype.extra_block = function() { return this.element.find('.extra') }

/**
 * @summary add known keys that will be inserted immediately before the notification is sent
 * @param {Object} keys keys to insert
 */
NotificationSelector.prototype.add_known_keys = function(keys) {
    $.extend( this.known_keys, keys );
}
