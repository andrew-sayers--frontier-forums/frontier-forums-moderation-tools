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
 *     level               : 'none', // or 'PM' or 'warning' or 'infraction'
 *     namespace           : 'variables namespace', // namespace to retrieve variables from
 *     violation           : 'default violation', // string, numeric ID or object
 *     keys                : {...}, // keys to use when resolving variables
 *           title_variable: 'Title variable', // variable to use for PM title or infraction reason
 *             ban_variable: 'Ban reason variable', // variable to use for reason to ban an account
 *          bbcode_variable: 'BBCode variable', // variable to use for BBCode
 *      note_title_variable: 'User note title variable', // variable to use for user note title
 *     note_bbcode_variable: 'User note BBCode variable', // variable to use for user note BBCode
 *     // these two usually aren't used:
 *     // title : 'initial text for PM title',
 *     // bbcode: 'initial text for BBCode',
 *
 *     // other data needed for the selector to function:
 *     user            : { username: ..., user_id: ... }, // user to apply action to
 *     v               : variables, // Variables object
 *     bb              : bb, // BulletinBoard object
 *     violation_groups: [{ name: '...', violations: [v1,v2,...]},...], // list of violations to display
 *     thread_id       : 12345, // variables will be parsed and previews will display as if rendered in this thread
 *     loading_html    : 'Loading, please wait...', // shown while the preview is updated
 *     callback        : function(keys) { ... }, // called with the current data
 *     container       : notification_appended_to_this
 *
 * });
 */
function NotificationSelector( args ) {

    var notification = this;

    var user = { username: args.user.username, user_id: args.user.user_id };

    ActionWidget.call(
        this, args, 'notification_selector',
        function(keys) {

            var value = this.val();

            var return_keys = $.extend( {}, value.keys );
            keys.violation = return_keys.violation = value.violation.name;
            function success() {
                return_keys['notification result'] = 'success';
                return args.bb.usernote_add(
                    user.user_id,
                    notification._resolve( value.note_title_variable , $.extend( keys, return_keys ) ),
                    notification._resolve( value.note_bbcode_variable, $.extend( keys, return_keys ) )
                ).then(function() {
                    return { keys: return_keys };
                });
            };

            function fail(error) {
                return_keys['notification result'] = 'fail';
                return_keys['notification error' ] = error;
                return args.bb.usernote_add(
                    user.user_id,
                    notification._resolve( value.note_title_variable , $.extend( keys, return_keys ) ),
                    notification._resolve( value.note_bbcode_variable, $.extend( keys, return_keys ) )
                ).then(function() {
                    var dfd = jQuery.Deferred();
                    dfd.reject(error);
                    return dfd.promise();
                });
            };

            switch ( value.level ) {

            case 'PM':
                return_keys['notification title' ] = value.title;
                return_keys['notification bbcode'] = value.bbcode;
                return args.bb.pm_send( user.username, value.title, value.bbcode ).then(success,fail);

            case 'warning'   : var is_warning = true; // then FALL THROUGH
            case 'infraction':
                return_keys['notification title' ] = notification._resolve( value.ban_variable, keys );
                return_keys['notification bbcode'] = value.bbcode;
                return args.bb.infraction_give({
                    administrative_note: notification._resolve( value.title_variable, keys ),
                    ban_reason         : return_keys['notification title'],
                    bbcode             : return_keys['notification bbcode'],
                    user_id            : user.user_id,
                    is_warning         : is_warning,
                    infraction_id      : value.violation.id
                }).then(success,fail);

            case 'none':
                return null;

            }

        },
        function() {
            if ( notification.value.level != 'none' )
                return [{ type: notification.value.level, target: user }, { type: 'usernote', target: user }]
        },
        function() {
            if ( notification.value.level != 'none' && !select.val() )
                return [ 'Please select a violation for ' + user.username ];
        }
    );

    this.bb           = args.bb;
    this.loading_html = args.loading_html;
    this.thread_id    = args.thread_id;
    this.title_map    = {};
    this.bbcode_map   = {};
    this.value        = {
        level               : null,
        namespace           : null,
        violation           : null,
        keys                : null,
              title_variable: null,
                ban_variable: null,
             bbcode_variable: null,
         note_title_variable: null,
        note_bbcode_variable: null,
        bbcode: null,
        title : null
    };
    this.old_title  = '';
    this.old_bbcode = '';

    var select = this.element.find('select');

    if ( args.violation_groups.length == 1 ) {
        this.element.find('select').append(
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

            var bbcode = $.isArray(value.bbcode_variable) ? value.bbcode_variable.slice(0) : [ value.bbcode_variable ];
            var title  = $.isArray(value. title_variable) ? value. title_variable.slice(0) : [ value. title_variable ];

            bbcode.push(keys.violation);
            title .push(keys.violation);

            notification.element.removeClass('missing-violation');

            notification.update_maps(value.level);

            if ( value.level == 'PM' ) {
                if ( value.title === null ) {
                    var new_title = notification._resolve( title, keys );
                    if ( new_title != notification.old_title ) {
                        notification.element.find('.'+value.level + ' .title').val(
                            notification.title_map.hasOwnProperty(new_title)
                            ? notification.title_map[new_title]
                            :                        new_title
                        );
                        notification.old_title = new_title;
                    }
                } else {
                    notification.element.find('.'+value.level + ' .title').val( value.title );
                    notification.old_title = value.title;
                };
            } else {
                value.title = null;
                [ 'top', 'bottom' ].forEach(function(location) {
                    notification.element.find('.'+value.level + ' .message-' + location).html(
                        args.v.resolve( 'report process', value.level + ' message ' + location, keys ) );
                });
            }

            if ( value.bbcode === null ) {
                var new_bbcode = notification._resolve( bbcode, keys );
                if ( new_bbcode != notification.old_bbcode ) {
                    notification.element.find('.'+value.level + ' textarea').val(
                        notification.bbcode_map.hasOwnProperty(new_bbcode)
                        ? notification.bbcode_map[new_bbcode]
                        :                         new_bbcode
                    );
                    notification.old_bbcode = new_bbcode;
                }
            } else {
                notification.element.find('.'+value.level + ' textarea').val( value.bbcode );
                notification.old_bbcode = value.bbcode;
            };

            if ( notification.element.hasClass('preview') ) {
                var level_element = notification.element.children('.'+value.level);
                level_element.find('.preview').html( args.loading_html );
                args.bb.bbcode_html( args.thread_id, level_element.find('textarea').val() )
                    .done(function(html) { level_element.find('.preview').html(html) })
                ;
            }

            value.bbcode = null;

        }
    });

    this.element.find('.reset').click(function() {
        var input_bbcode = $(this).siblings('textarea').val();
        if (
            notification.bbcode_map.hasOwnProperty(notification.old_bbcode) &&
            input_bbcode == notification.old_bbcode
        ) {
            $(this).siblings('textarea').val( notification.bbcode_map[notification.old_bbcode] );
            delete notification.bbcode_map[notification.old_bbcode];
        } else {
            notification.bbcode_map[notification.old_bbcode] = input_bbcode;
            $(this).siblings('textarea').val( notification.old_bbcode );
        }
    });


    this.val(args);

}

NotificationSelector.prototype = Object.create(ActionWidget.prototype, {
    bb          : { writable: true, configurable: false },
    loading_html: { writable: true, configurable: false },
    thread_id   : { writable: true, configurable: false },
    button      : { writable: true, configurable: false },
    title_map   : { writable: true, configurable: false },
    bbcode_map  : { writable: true, configurable: false },
    value       : { writable: true, configurable: false }

});
NotificationSelector.prototype.constructor = NotificationSelector;

NotificationSelector.prototype.update_maps = function(level) {
    var input_title  = this.element.find('.'+level + ' .title'  ).val();
    var input_bbcode = this.element.find('.'+level + ' textarea').val();
    if ( this.old_title  != '' && this.old_title  != input_title  ) this. title_map[this.old_title ] = input_title;
    if ( this.old_bbcode != '' && this.old_bbcode != input_bbcode ) this.bbcode_map[this.old_bbcode] = input_bbcode;
    this.old_title = this.old_bbcode = ''; // disable updates until the values are reset
}


/**
 * @summary Get/set widget's values
 * @param {Object} value new value
 * @return {Object} (new) value
 * @example
 *
 * ns.val({
 *     level          : 'none', // or 'PM' or 'warning' or 'infraction'
 *     namespace      : 'variables namespace', // namespace to retrieve variables from
 *     bbcode_variable: 'BBCode variable', // variable to use for BBCode
 *     ban_variable   : 'Ban reason variable', // variable to use for reason to ban an account
 *     title_variable : 'Title variable', // variable to use for PM title
 *     keys           : {...}, // keys to use when resolving variables
 *     violation      : 'default violation', // string, numeric ID or object
 *     // these two usually aren't used:
 *     // title  : 'initial text for PM title',
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
            this.update_maps(this.value.level);
            this.element.removeClass('none PM warning infraction').addClass(value.level)
                .find('input,select,textarea').prop( 'required', false );
            this.element                          .find('select'  ).prop( 'required', true );
            this.element.children('.'+value.level).find('textarea').prop( 'required', true );
        }

        if ( value.hasOwnProperty('violation') ) {
            this.update_maps(this.value.level);
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
            level_element.find('.preview').html( this.loading_html );
            this.bb.bbcode_html( this.thread_id, level_element.find('textarea').val() )
                .done(function(html) { level_element.find('.preview').html(html) })
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
NotificationSelector.prototype.mode_switcher = function() {
    var notification = this;
    if ( !this.button )
        this.button = $('<input class="notification-text-button" type="button">')
        .val( notification.element.hasClass('preview') ? 'switch to edit mode' : 'switch to preview mode' )
        .on( 'click', function() {
            var new_mode = notification.element.hasClass('preview') ? 'edit' : 'preview';
            this.value = 'switch to ' + new_mode + ' mode';
            notification.mode(new_mode);
        });
    return this.button;
}

/**
 * @summary <div> element where you can put "extra" actions
 * @return {jQuery}
 * @description Sometimes it's useful to place another widget inside this one
 * (e.g. an extra action to fire at the same time).  This element is
 * a place to put such widgets
 */
NotificationSelector.prototype.extra_block = function() { return this.element.find('.extra') }
