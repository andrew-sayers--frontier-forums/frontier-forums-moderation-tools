/**
 * @file handle a set of duplicate accounts
 * @author Andrew Sayers
 */

/**
 * @summary manage policy for new accounts
 * @constructor
 * @example
 * var policy = new DuplicateAccountPolicy({
 *     // objects:
 *     v : v, // Variables object
 *     bb: bb, // BulletinBoard object
 *     mc: mc, // MiscellaneousCache object
 *     vi: vi, // Violations object
 *
 *     // configuration:
 *     loading_html  : 'loading, please wait...',
 *     user          : { username: 'thread creator username', user_id: 12345, email: '..', summary: '...', suspected_duplicates: [...] },
 *     callback: function( action, summary, header ) { ... };
 *
 *     // widget placement:
 *     duplicate_account_list_args: { container: $('.duplicate_account_list_container') },
 *                 extra_post_args: { container: $(            '.extra_post_container') },
 *            severity_slider_args: { container: $(       '.severity_slider_container') },
 *
 *     build_dupe_args: function(users) {
 *         // build extra arguments for single duplicate account policies
 *     },
 * });
 */
function DuplicateAccountPolicy(args) {

    // Calculate default severity based on dupe accounts' previous behaviour:
    if ( args.user.suspected_duplicates.length ) {

        var dupe_reasons = {};
        args.vi.violations.forEach(function(violation) { if ( violation.dupe_related ) dupe_reasons[violation.name.toLowerCase()] = true });

        var dupes = args.user.suspected_duplicates;
        for ( var n=0; n!= dupes.length; ++n ) {
            // duplicate accounts that are already banned or have existing dupe-related infractions are extra suspicious:
            if ( dupes[n].info.is_banned || dupes[n].info.infraction_reasons.filter(function(reason) { return dupe_reasons.hasOwnProperty(reason.toLowerCase()) }).length ) {
                args.severity = 2;
                break;
            }
            // old accounts should know better:
            if ( Math.abs( dupes[n].moderation_info.join_date - args.user.join_date ) >= 1000*60*60*24 ) args.severity = 1;
        };

    }

    Policy.call( this, args );

    var users = [{
        username: args.user.username,
        user_id : args.user.user_id,
        email   : args.user.email,
        notes   : args.user.info.infraction_summary + ' ' + args.user.moderation_info.summary,
        is_primary: true,
            info:   args.user.info,
        mod_info:   args.user.moderation_info,
    }]
        .concat(args.user.suspected_duplicates.map(function(user) {
            return {
                     username  : user.username,
                     user_id   : user.user_id,
                     email     : user.moderation_info.email,
                     notes     : user.info.infraction_summary + ' ' + user.moderation_info.summary,
                     is_banned : user.info.is_banned,
                     is_primary: false,
                           info:   user.info,
                moderation_info:   user.moderation_info,
            };
        }));

    var callback = function() {};

    var policy = this;

    new SeveritySlider(this.severity_slider_args(null, args.severity_slider_args, {
        callback: function(level) {
            this.severity_level = args.severity_level = level;
            callback();
        }
    }));
    new DuplicateAccountList(this.duplicate_account_list_args(null, args.duplicate_account_list_args,
        {
            show_heatmap: true,
            required: users.slice(0,1),
            default : users.slice(1),
            callback: function(u) {
                users = u;
                callback();
            }
        }
    ));

    callback = function() {

        var primary_account, dupe_accounts = [];
        users.forEach(function(user) {
            if ( user.is_primary )
                primary_account  = policy.user_link(user);
            else
                dupe_accounts.push( policy.user_link(user) );
        });

        var dupe_args = args.build_dupe_args(users);
        var extra_post_actions = [], notification_selector_actions = [];
        dupe_args.forEach(function(dupe_args) {
            var dupe = new policy._Single($.extend(args, dupe_args), users, callback);
            if ( dupe.extra_post_widget ) extra_post_actions.push( dupe.extra_post_action(dupe.extra_post_widget) );
            notification_selector_actions.push( policy.notification_selector_action(dupe.notification_widget) );
        });

        var action;
        switch ( extra_post_actions.length ) {
        case 0 : break;
        case 1 : action = extra_post_actions[0]; break;
        default: action = new Action( policy.name + ' extra posts wrapper' ); break; // TODO: handle this sanely if we ever actually want to do it
        }

        if ( args.callback )
            args.callback(
                new Action(
                    policy.name + ' wrapper',
                    action
                        ? action.then(notification_selector_actions)
                        :             notification_selector_actions
                ),
                '[img]' + policy.severity_icon() + '[/img]' + users.map(function() { return ':rolleyes:' }).join('') +
                primary_account + ' has duplicate(s) ' + dupe_accounts.join(', ') + policy.severity_text(),
                '<img src="' + policy.severity_icon() + '">' + users.map(function() { return '<img src="/images/smilies/vbsmileys/rolleyes.png">' }).join('')
            );

    }

    callback();

}

DuplicateAccountPolicy.prototype = Object.create(Policy.prototype, {
    _namespace: { writable: false, configurable: false, value: 'newbie actions' },
    name      : { writable: false, configurable: false, value: ['duplicate account'] },
});
DuplicateAccountPolicy.prototype.constructor = DuplicateAccountPolicy;

/**
 * @summary single dupe account policy
 * @constructor
 */
DuplicateAccountPolicy.prototype._Single = function(args, users, callback) {

    Policy.call( this, args );

    var account_type;
    if ( args.user.is_primary ) {
        account_type =    'primary account'; if ( this.severity_level.type == 'warning' ) this.severity_level.type = 'PM';
    } else {
        account_type = 'additional account'; if ( this.severity_level.type == 'warning' ) this.severity_level.type = 'infraction';
    }

    users = users.map(function(user) { return $.extend( { is_target: user == args.user }, user ) });
    this.user = $.extend( {}, args.user, { is_target: true } );

    this.default_keys = [
        { type: 'usernames'  , name: 'username', value: users },
        { type: 'action data', name: 'action data', value: { deadline: '+7d', user: { username: this.user.username, user_id: this.user.user_id } } },
        { type: 'literal'    , name: 'name', value: this.user.username } // DEPRECATED: use "username" in new code
    ];

    this.variable_suffix = (
        ( args.severity == 1 )
            ? [account_type, this.severity_level.html, 'previous dupe-related activity']
            : [account_type, this.severity_level.html]
    );

    var _callback = function() {};

    this.notification_widget = new NotificationSelector(this.notification_selector_args(null, args.notification_selector_args ));
    if ( args.extra_post_args.visible ) {
        delete args.extra_post_args.visible;
        this.extra_post_widget = new ExtraPost(this.extra_post_args(
            null,
            { container: this.notification_widget.extra_block() },
            args.extra_post_args,
            { callback : _callback }
        ));
    }

    $(args.mode_switcher_args.container).append(this.notification_widget.mode_switcher());

    _callback = callback;

}

DuplicateAccountPolicy.prototype._Single.prototype = Object.create(Policy.prototype, {
    _namespace: { writable: false, configurable: false, value: 'newbie actions' },
    name      : { writable: false, configurable: false, value: ['duplicate account'] },
    notification_widget: { writable: true, configurable: false },
      extra_post_widget: { writable: true, configurable: false }
});
DuplicateAccountPolicy.prototype._Single.prototype.constructor = DuplicateAccountPolicy.prototype._Single;
