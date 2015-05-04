/**
 * @file manage policy for new accounts
 * @author Andrew Sayers
 * This file defines newbie policy in the abstract, but sadly needs to be
 * tightly coupled to the interface.
 */

/**
 * @summary manage policy for new accounts
 * @constructor
 * @example
 * var policy = new NewbiePolicy({
 *     v : v, // Variables object
 *     bb: bb, // BulletinBoard object
 *     vi: vi, // Violations object
 *     ss: ss // SharedStore object
 * });
 */
function NewbiePolicy(args) {
    this.v  = args.v ;
    this.bb = args.bb;
    this.ss = args.ss;

    this._extra_post_values.chase    .thread_id = this.v.resolve('frequently used posts/threads', this._extra_post_values.chase    .thread_id );
    this._extra_post_values['ip ban'].thread_id = this.v.resolve('frequently used posts/threads', this._extra_post_values['ip ban'].thread_id );

    var dupe_reasons = this._dupe_reasons = {};
    args.vi.violations.forEach(function(violation) { if ( violation.dupe_related ) dupe_reasons[violation.name.toLowerCase()] = true });

    this._widget_values = {
        namespace: this._namespace,
        thread_id: this.v.resolve('frequently used posts/threads', 'mod log'),
    };

}
NewbiePolicy.prototype = Object.create(null, {

    v : { writable: true, configurable: false },
    bb: { writable: true, configurable: false },
    ss: { writable: true, configurable: false },
    root_action: { writable: true, configurable: false },
    has_actions: { writable: true, configurable: false },

    _namespace: { writable: false, configurable: false, value: 'newbie actions' },
    _widget_values: { writable: true, configurable: false },
    _dupe_reasons : { writable: true, configurable: false },

    _extra_post_values: {
        writable: false,
        configurable: false,
        value: {
            'chase': {
                visible    : true,
                checked    : true,
                text       : 'Make a note to chase this up',
                thread_id  : 'Moderation Chase-Up Thread', // converted to a number later on
                thread_desc: 'the chase-up thread',
                var_prefix : 'chase-up'

            },
            'ip ban': {
                visible    : true,
                checked    : true,
                text       : 'Request that associated IP address(es) be blocked from accessing the site',
                thread_id  : 'IP Ban Request Thread', // converted to a number later on
                thread_desc: 'the IP Ban request thread',
                var_prefix : 'IP ban'
            }
        }
    },

    _severity_levels: {
        writable: false,
        configurable: false,
        value: {
            inappropriate: [
                { html: 'honest mistake', type: 'PM'        , icon: '/images/buttons/add-infraction_sm.png' },
                { html: 'deliberate'    , type: 'infraction', icon: '/images/buttons/red-card_sm.png' },
                { html: 'provocative'   , type: 'infraction', icon: '/images/buttons/red-card_sm.png' },
                { html: 'malicious'     , type: 'infraction', icon: '/images/buttons/red-card_sm.png' }
            ],
            dupe: [
                { html: 'honest mistake', type: 'PM'        , icon: '/images/buttons/add-infraction_sm.png' },
                { html: 'deliberate'    , type: 'warning'   , icon: '/images/buttons/yellow-card_sm.png' }, // PM the primary and infract the additional account
                { html: 'provocative'   , type: 'infraction', icon: '/images/buttons/red-card_sm.png' },
                { html: 'malicious'     , type: 'infraction', icon: '/images/buttons/red-card_sm.png' }
            ]
        }
    },

    _default_severity_levels: {
        writable: false,
        configurable: false,
        value: {
            inappropriate: 1,
            dupe         : 1
        }
    }

});
NewbiePolicy.prototype.constructor = NewbiePolicy;

/**
 * @summary Set the actions that will be fired
 * @param {Array.<Action>} actions actions to fire
 * @return {string} user-friendly description of actions
 */
NewbiePolicy.prototype.set_actions = function(actions) {
    this.root_action = new Action( 'root action', actions );
    var ss = this.ss;
    this.root_action.then(new Action( 'update shared store', {
        fire: function(data) {
            var max_user_id = data['max user id'];
            return ss.transaction(function(data) { data.newbie_policy_base_user_id = max_user_id+1 });
        }
    }));
    var title = this.root_action.title();
    this.has_actions = title.length;
    if ( !title.length ) return null;
    title[0] = title[0][0].toUpperCase() + title[0].slice(1);
    return title.length && title.join(', ') + ' and mark users validated';
}

/**
 * @summary Fire the actions
 * @param {Number} min_user_id lowest user ID
 * @param {Number} max_user_id highest user ID
 * @param {string} summary     summary of actions
 * @param {string} extra_notes text entered by the user
 * @return {jQuery.Promise} Promise representing the whole graph of actions
 */
NewbiePolicy.prototype.fire = function(min_user_id, max_user_id, summary, extra_notes) {
    if ( this.has_actions ) {
        return this.root_action.fire_with_journal(
            this.bb,
            {
                'min user id': min_user_id,
                'max user id': max_user_id,
                'summary'    : summary,
                'extra notes': extra_notes
            },
            this.v,
            this.v.resolve('frequently used posts/threads', 'newbie management log' ),
            this._namespace,
            'log'
        );
    } else {
        return this.ss.transaction(function(data) { data.newbie_policy_base_user_id = max_user_id; return true });
    }
}


/**
 * @summary asses the relative suspiciousness of a user
 * @param {Object} user account to measure
 * @return {Number} suspiciousness
 */
NewbiePolicy.prototype.suspiciousness_duplicate = function( user ) {
    if ( !user.suspected_duplicates.length ) return 0;
    var suspiciousness = -1;
    var dupes = user.suspected_duplicates;
    var dupe_reasons = this._dupe_reasons;
    for ( var n=0; n!= dupes.length; ++n ) {
        // duplicate accounts that are already banned or have existing dupe-related infractions are extra suspicious:
        if ( dupes[n].info.is_banned || dupes[n].info.infraction_reasons.filter(function(reason) { return dupe_reasons.hasOwnProperty(reason.toLowerCase()) }).length ) return 1;
        // old accounts should know better:
        if ( Math.abs( dupes[n].moderation_info.join_date - user.join_date ) >= 1000*60*60*24 ) suspiciousness = 0;
    };
    return suspiciousness;
}


/*
 * INPUT VALUES
 * hash of values to initialise/update widgets
 */

/**
 * @summary Build values to initialise or update a widget
 * @param {string}         level severity level for the violation
 * @param {Object}         user user to notify
 * @param {Array.<Object>} all_users all affected users (e.g. other duplicate accounts)
 * @param {Object}         values values for child widget
 * @private
 * @return {Object} extra_post arguments
 */
NewbiePolicy.prototype._widget = function( level, user, all_users, values ) {

    var bb = this.bb;
    function user_username(user) { return user.username }
    function user_link    (user) { return '[URL="' + location.origin + bb.url_for.user_show({ user_id: user.user_id }) + '"]' + user.username + '[/URL]' }

    return $.extend(
        {
            keys: {
                me: bb.user_current().username,
                'severity level' : level.html,
                'infraction type': level.type,
                name: user.username, // DEPRECATED: use "username" in new code
                'username'                       : user_username(user),
                'username with link'             : user_link    (user),
                'usernames'                      : all_users                                            .map(user_username),
                'usernames with links'           : all_users                                            .map(user_link    ),
                'other usernames'                : all_users.filter(function(u) { return u !== user   }).map(user_username),
                'other usernames with links'     : all_users.filter(function(u) { return u !== user   }).map(user_link    ),
                'primary username'               : all_users.filter(function(u) { return u.is_primary }).map(user_username)[0],
                'primary username with link'     : all_users.filter(function(u) { return u.is_primary }).map(user_link    )[0],
                'additional usernames'           : all_users.filter(function(u) { return u !== user   }).map(user_username),
                'additional usernames with links': all_users.filter(function(u) { return u !== user   }).map(user_link    )
            }
        },
        this._widget_values,
        values
    );

}


/**
 * @summary Build values to initialise or update an extra_post widget
 * @param {string}         level severity level for the violation
 * @param {Object}         user user to notify
 * @param {Array.<Object>} all_users all affected users (e.g. other duplicate accounts)
 * @param {string}         violation name of rule that was violated
 * @private
 * @return {Object} extra_post arguments
 */
NewbiePolicy.prototype._extra_post = function( level, user, all_users, violation ) {
    var extra_data = this.v.get( this._namespace, [ violation, 'extra action', level.html ] ).text;

    var ret;
    if ( extra_data === null )
        ret = { visible: false, checked: false, text: '' }
    else
        ret = this._extra_post_values[extra_data.toLowerCase()] || { visible: false, checked: false, text: '' };

    ret. title_variable = [ violation, ret.var_prefix + ' post title'  ];
    ret.bbcode_variable = [ violation, ret.var_prefix + ' post bbcode' ];

    return this._widget( level, user, all_users, ret );
}

/**
 * @summary Build values to initialise or update a notification_selector widget
 * @param {string}         level severity level for the violation
 * @param {Object}         user user to notify
 * @param {Array.<Object>} all_users all affected users (e.g. other duplicate accounts)
 * @param {string}         violation name of rule that was violated
 * @param {Array.<string>} variabxle_suffix values appended to variable names
 * @private
 * @return {Object} notification_selector arguments
 */
NewbiePolicy.prototype._notification_selector = function( level, user, all_users, violation, variable_suffix ) {
    return this._widget( level, user, all_users, {
        level: level.type,
              title_variable: [ violation, level.type + ( level.type == 'PM' ? ' title' : ' administrative note' ) ].concat(variable_suffix),
                ban_variable: [ violation,                                      'ban reason'                       ].concat(variable_suffix),
             bbcode_variable: [ violation, level.type +                        ' bbcode'                           ].concat(variable_suffix),
         note_title_variable: [ violation, 'note' +                            ' title'                            ].concat(variable_suffix),
        note_bbcode_variable: [ violation, 'note' +                            ' bbcode'                           ].concat(variable_suffix),
        violation: this.v.get( this._namespace, [ violation, 'default violation' ].concat(variable_suffix) ).text,
        user: user
    });
}

/* INPUT VALUES FOR INAPPROPRIATE USERNAMES */

/**
 * @summary values to initialise/update the extra_post widget for an inappropriate username
 * @param {string} level 'honest mistake', 'deliberate', 'provocative' or 'malicious'
 * @return {Object} extra_post arguments
 */
NewbiePolicy.prototype.extra_post_inappropriate = function(level, user) {
    return this._extra_post(
        level || this._severity_levels.inappropriate[ this._default_severity_levels.inappropriate ],
        user,
        [user],
        'inappropriate username'
    );
}

/**
 * @summary values to initialise/update the severity_slider widget for an inappropriate username
 * @return {Object} severity_slider arguments
 */
NewbiePolicy.prototype.severity_slider_inappropriate = function() {
    return $.extend(
        {
            levels: this._severity_levels.inappropriate,
            value : this._severity_levels.inappropriate[ this._default_severity_levels.inappropriate ].html
        },
        this._widget_values
    );
}

/**
 * @summary values to initialise/update the notification_selector widget for an inappropriate username
 * @param {string} level severity level for the violation
 * @param {Object} user user to notify
 * @return {Object} notification_selector arguments
 */
NewbiePolicy.prototype.notification_selector_inappropriate = function(level, user) {
    if ( !level ) level = this._severity_levels.inappropriate[ this._default_severity_levels.inappropriate ];
    return this._notification_selector( level, user, [user], 'inappropriate username', [level.html] );
}


/* INPUT VALUES FOR DUPLICATE ACCOUNTS */

/**
 * @summary values to initialise/update the extra_post widget for a set of duplicate accounts
 * @param {Number}         suspiciousness measure of suspiciousness
 * @param {string}         level severity level for the violation
 * @param {Object}         user user to notify
 * @param {Array.<Object>} all_users all affected users (e.g. other duplicate accounts)
 * @return {Object} extra_post arguments
 */
NewbiePolicy.prototype.extra_post_duplicate = function(suspiciousness, level, user, all_users) {
    return this._extra_post(
        level || this._severity_levels.dupe[ this._default_severity_levels.dupe + suspiciousness ],
        user,
        all_users,
        'duplicate account'
    );
}

/**
 * @summary values to initialise/update the severity_slider widget for a set of duplicate accounts
 * @param {Number} suspiciousness measure of suspiciousness
 * @return {Object} severity_slider arguments
 */
NewbiePolicy.prototype.severity_slider_duplicate = function(suspiciousness) {
    return $.extend(
        {
            levels: this._severity_levels.dupe,
            value : this._severity_levels.dupe[ this._default_severity_levels.dupe + suspiciousness ].html
        },
        this._widget_values
    );
}

/**
 * @summary values to initialise/update the notification_selector widget for a set of duplicate accounts
 * @param {string} level severity level for the violation
 * @param {Object} user user to notify
 * @param {Array.<Object>} all_users all affected users (e.g. other duplicate accounts)
 * @param {Number} suspiciousness measure of suspiciousness
 * @return {Object} notification_selector arguments
 */
NewbiePolicy.prototype.notification_selector_duplicate = function(level, user, all_users, suspiciousness) {

    if ( !level ) level = this._severity_levels.inappropriate[ this._default_severity_levels.inappropriate ];

    var account_type;
    if ( user.is_primary ) {
        account_type =    'primary account'; if ( level.type == 'warning' ) level = { html: level.html, type: 'PM'         };
    } else {
        account_type = 'additional account'; if ( level.type == 'warning' ) level = { html: level.html, type: 'infraction' };
    }

    return this._notification_selector(
        level, user, all_users, 'duplicate account',
        ( suspiciousness == 1 )
        ? [account_type, level.html, 'previous dupe-related activity']
        : [account_type, level.html]
    );

}

/*
 * OUTPUT VALUES
 */

/**
 * @summary Augment the action for an inappropriate username
 * @param {Action} extra_action action associated with the extra post
 * @param {Action} action action to augment
 * @param {string} violation name of rule that was violated
 * @return {Action} augmented action
 */
NewbiePolicy.prototype._action_wrapper = function(extra_action, action, users, violation, need_ip_address_report) {
    var policy = this;
    return new Action(
        violation + ' wrapper action',
        need_ip_address_report && new IPAddressReport({ bb: this.bb, users: users }).action(),
        {
            fire: function(keys) {
                var action_data = policy._action_data( violation, users );
                var dfd = new jQuery.Deferred();
                dfd.resolve({ keys: { 'action data': action_data }});
                return dfd.promise();
            }
        }
    ).then( extra_action.then(action) );
}

/**
 * @summary Augment the root action for a single user
 * @param {string} violation name of rule that was violated
 * @param {Array.<Object>} users affected users
 * @private
 * @return {Action} augmented action
 */
NewbiePolicy.prototype._action_data = function(violation, users) {
    var date = new Date();
    var next_week = new Date();
    next_week.setDate(next_week.getDate()+7);
    return this.v.escape(
        this.bb.stringify(
            'action data',
            {
                violation: violation,
                date: date.getTime(),
                deadline: next_week.getTime(),
                users: users.map(function(u) { return { username: u.username, user_id: u.user_id } })
            }
        )
    );
}

/**
 * @summary Augment the action for an inappropriate username
 * @param {ExtraPost} extra_post extra post object
 * @param {Action} action action to augment
 * @return {Action} augmented action
 */
NewbiePolicy.prototype.action_inappropriate_wrapper = function(extra_post, action, user) {
    var extra = extra_post.val();
    return this._action_wrapper( extra_post.action(), action, [user], 'inappropriate username', extra.checked && extra.text == this._extra_post_values['ip ban'].text );
}

/**
 * @summary Augment the action for a duplicate account
 * @param {ExtraPost} extra_post extra post object
 * @param {Action} action action to augment
 * @return {Action} augmented action
 */
NewbiePolicy.prototype.action_duplicate_wrapper = function(extra_post, action, users) {
    return this._action_wrapper( extra_post.action(), action, users, 'duplicate account', true );
}
