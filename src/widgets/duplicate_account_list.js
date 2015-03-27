/**
 * @file Duplicate username list
 * @author Andrew Sayers
 * @summary Select a list of accounts you believe to be duplicates for the same user
 */

/**
 * @summary Select a list of accounts you believe to be duplicates for the same user
 * @constructor
 * @extends Widget
 * @param {Object} args duplicate account arguments
 * @example
 *
 * var dupe_list = new DuplicateAccountList({
 *
 *     required: [{ username: ..., user_id: ..., email: ..., notes: ... }, ...], // Accounts that must be included in the list
 *     default : [{ username: ..., user_id: ..., email: ..., notes: ... }, ...], // Accounts that will be suggested by default
 *
 *     // other data needed for the list to function:
 *     bb          : bb, // BulletinBoard object
 *     v           : v, // Variables object
 *     callback    : function(users) { ... }, // called with the current data
 *     container   : dupes_appended_to_this
 *
 * });
 */
function DuplicateAccountList( args ) {

    // we need to handle the callback specially:
    var callback = args.callback;
    delete args.callback;

    Widget.call( this, args, 'duplicate_account_list' );

    var dupes = this;

    this.bb        = args.bb;
    this.user_info = {};
    if ( args.required && args.required.length ) {
        this.email_highlighter = new EmailHighlighter({ v: args.v, source_address: args.required[0].email });
    } else {
        this.email_highlighter = new EmailHighlighter({ v: args.v, source_address: '@' });
    }

    // make sure there's a <datalist> for us:
    var list_id = this.element.find('.user').attr('list');
    if ( $('#'+list_id).length == 0 ) {
        $('<datalist id="' + list_id + '"><option></option></datalist>').appendTo(document.body);
    }

    this.val(args);

    var primary_user_id = args.required ? args.required[0].user_id : 0, old_list_length = -1;

    form_keys( args.bb, this.element, function(keys, list) {
        var callback_needed = false, callback_list = [];
        if ( !dupes.element.find('[name="primary-username"]:checked').length )
            dupes.element.find('[name="primary-username"]').first().prop( 'checked', true );
        var new_primary_user_id = dupes.element.find('[name="primary-username"]:checked').closest('tr').data('dupe-account-current');
        if ( primary_user_id != new_primary_user_id ) {
            primary_user_id = new_primary_user_id;
            callback_needed = true;
        }
        list.forEach(function(item) {
            var row = $(item.element).closest('tr');
            if ( item.value ) {
                row.removeClass('dupe-unknown');
                callback_needed |= dupes._set_row( row, $.trim(item.text), item.value );
                callback_list.push( row.data('dupe-account-val') );
                callback_list[callback_list.length-1].is_primary = callback_list[callback_list.length-1].user_id == primary_user_id;
            } else {
                row.   addClass('dupe-unknown');
            }
        });
        if ( old_list_length != list.length ) {
            old_list_length = list.length;
            callback_needed = true;
        }
        if ( callback_needed && callback ) {
            callback(
                $(dupes.element).find('.required').map(function() {
                    var ret = $(this).data('dupe-account-val');
                    ret.is_primary = ret.user_id == primary_user_id;
                    return ret;
                }).get().concat( callback_list )
            );
        }
        return false; // prevent form submission
    });

}

DuplicateAccountList.prototype = Object.create(Widget, {
    bb               : { writable: true, configurable: false },
    user_info        : { writable: true, configurable: false },
    email_highlighter: { writable: true, configurable: false },
});
DuplicateAccountList.prototype.constructor = DuplicateAccountList;

// Set the elements in a <tr>, return true if the element has changed value:
DuplicateAccountList.prototype._set_row = function( row, username, user_id, first_user ) {

    row.find('.member').attr( 'href', this.bb.url_for.user_show({ user_id: user_id }) );

    if ( row.data('dupe-account-current') == user_id ) return false;

    row.data( 'dupe-account-val', { username: username, user_id: user_id } );

    if ( this.user_info.hasOwnProperty(user_id) ) {

        var user = this.user_info[user_id];
        row
            .data('dupe-account-current', user_id)
            .removeClass( 'dupe-loading' );
        row.find('.email-user a,.at a,.email-domain a'  ).attr( 'href', 'mailto:' + user.email );
        row.find( '.notes' ).html( user.notes ).find('time').timeago();
        if ( first_user ) {
            var email = user.email.split('@');
            row.find('.email-user a'  )        .text( email[0] );
            row.find('.email-domain a').first().text( email[1] );
        } else {
            this.email_highlighter.highlight_to_element(
                user.email,
                row.find('.email-user a'  ),
                row.find('.email-domain a').first()
            );
        }

    } else {

        var dupes = this;
        row.addClass( 'dupe-loading' );
        $.when(
            this.bb.user_info(user_id),
            this.bb.user_moderation_info(user_id)
        ).then(function( user_info, user_moderation_info ) {
            dupes.user_info[user_id] = {
                email: user_moderation_info.email,
                notes: user_info.infraction_summary + ' ' + user_moderation_info.summary,
            };
            dupes._set_row( row, username, user_id );
        });

    }

    return true;

}

/**
 * @summary Get/set widget's values
 * @param {Object} value new value
 * @return {Object} (new) value
 * @example
 *
 * ns.val({
 *     required: [{ username: ..., user_id: ... }, ...], // Accounts that must be included in the list
 *     default : [{ username: ..., user_id: ... }, ...], // Accounts that will be suggested by default
 * });
 *
 */
DuplicateAccountList.prototype.val = function( value ) {

    var dupes = this;

    if ( value ) {

        var multi = this.element.find('.multi:last-child');

        var primary_defined = false;

        function update_row(user) {
            var row = multi.clone()
                .insertBefore(multi)
                .data( 'user', user );
            row.find('.user').data( 'value', user.user_id );
            dupes.user_info[user.user_id] = { email: user.email, notes: user.notes };
            dupes._set_row(row, user.username, user.user_id, value.required && value.required[0] == user);
            if ( user.is_banned && !primary_defined ) {
                row.find('[name="primary-username"]').prop( 'checked', true );
                primary_defined = true;
            }
            return row;
        }

        this.element.find('tbody > tr:not(:last-child)').remove();
        ( value.required || [] ).forEach(function(user) { update_row(user).addClass('required').find('.user').replaceWith($('<span>').text(user.username)) });
        ( value.default  || [] ).forEach(function(user) { update_row(user)                     .find('.user')                        .val (user.username)  });
        if ( !primary_defined ) this.element.find('[name="primary-username"]').first().prop( 'checked', true );

    }

    return this.element.find('tr').map(function() { return $(this).data('dupe-account-val') }).get();

}
