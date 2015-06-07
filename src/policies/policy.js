/**
 * @file base class for policies
 * @author Andrew Sayers
 */

/**
 * @summary manage an arbitrary policy
 * @constructor
 * @example
 * var policy = new Policy( namespace, {
 *     // objects:
 *     v : v, // Variables object
 *     bb: bb, // BulletinBoard object
 *     mc: mc, // MiscellaneousCache object
 *     vi: vi, // Violations object
 *     // configuration:
 *     severity_level: { html: 'no action', type: 'none' },
 *     thread_id     : 1234,
 *     thread_desc   : 'thread description',
 *     loading_html  : 'loading, please wait...'
 * });
 */
function Policy(args) {

    this.v  = args.v ;
    this.bb = args.bb;

    this.promise = jQuery.Deferred().resolve().promise();

    this._default_violation = args.mc.violation_groups[0].violations[0].name;

    var levels = this.get(this.name.concat([ 'severity levels' ]));

    if ( levels.text === null )
        this.severity_levels = [{ html: 'no action', type: 'none' }];
    else
        this.severity_levels = args.v.parse(levels.text, {}, 'array of items' ).map(function(level) {
            level = level.value.split(/\s*:\s*/);
            return { html: level[0], type: level[1], icon: level[2] };
        });

    this.severity_level = $.extend( {}, args.severity_level || this.severity_levels[args.severity||0] || this.severity_levels[0] );
    this.default_keys = [];
    this._widget_args  = {
        v               : args.v,
        bb              : args.bb,
        violations      : args.vi,
        namespace       : this._namespace,
        violation_groups: args.mc.violation_groups,
        thread_id       : args.thread_id || this.resolve_post('mod log'),
        thread_desc     : args.thread_desc || 'the mod log',
        loading_html    : args.loading_html
    };
    this.variable_suffix = [this.severity_level.html];

    var policy = this;
    Object.keys(this._extra_post_values).forEach(function(value) {
        if ( !policy._extra_post_values[value].initialised ) {
            policy._extra_post_values[value].initialised = true;
            policy._extra_post_values[value].thread_id = policy.resolve_post( policy._extra_post_values[value].thread_id );
        }
    });

}
Policy.prototype = Object.create(null, {

    v : { writable: true, configurable: false },
    bb: { writable: true, configurable: false },

    promise: { writable: true, configurable: false },

    root_action: { writable: true, configurable: false },
    has_actions: { writable: true, configurable: false },

    _namespace     : { writable: false, configurable: false },
    name           : { writable: false, configurable: false, value: [] },
    _widget_args   : { writable: true, configurable: false },
    default_keys   : { writable: true, configurable: false },
    variable_suffix: { writable: true, configurable: false },

    _default_violation: { writable: true, configurable: false },

    severity_levels: { writable: true, configurable: false },
    severity_level : { writable: true, configurable: false },

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
                initialised: false,
                var_prefix : 'chase-up'

            },
            'ip ban': {
                visible    : true,
                checked    : true,
                text       : 'Request that associated IP address(es) be blocked from accessing the site',
                thread_id  : 'IP Ban Request Thread', // converted to a number later on
                thread_desc: 'the IP Ban request thread',
                initialised: false,
                var_prefix : 'IP ban'
            }
        }
    }

});

/*
 * VARIABLE MANAGEMENT FUNCTIONS
 */

/**
 * @summary Build keys to pass to an action
 * @param {Object} keys keys to pass
 * @protected
 */
Policy.prototype.keys = function(keys) {
    return $.extend( this._build_keys([], 'public'), keys );
}

/**
 * @summary Get a frequently used thread or post ID
 * @param {string} name post name
 * @return {string} thread/post ID
 */
Policy.prototype.resolve_post = function(name) { return this.v.resolve('frequently used posts/threads', name ) }
/**
 * @summary Resolve a name in the policy's namespace
 * @param {string|Array.<string>} names     name(s) of variable within the namespace
 * @param {Object.<string,*>=}    keys      keys used to instantiate the variable
 * @param {string=}               parser    parser used for the variable ('string', 'array of items' or 'hash of arrays', default: 'string')
 * @return {string} variable
 */
Policy.prototype.resolve = function(name, keys, parser) { return this.v.resolve(this._namespace, name, keys, parser ) }
/**
 * @summary Resolve a name in the policy's namespace
 * @param {string} name variable name
 * @return {string} variable
 */
Policy.prototype.get = function(name) { return this.v.get(this._namespace, name ) }
/**
 * @summary Check if a name exists in the policy's namespace
 * @param {string} name variable name
 * @return {string} variable
 */
Policy.prototype.check = function(name) { return this.v.check(this._namespace, name ) }

/*
 * SUMMARY BUILDING FUNCTIONS
 */
Policy.prototype.user_link = function(user) {
    if ( !user ) user = this.user;
    return '[URL="' + location.origin + this.bb.url_for.user_show({ user_id: user.user_id }) + '"]' + user.username + '[/URL]'
}

Policy.prototype.severity_icon = function() { return location.origin + this.severity_level.icon }
Policy.prototype.severity_text = function() { return ' (' + this.severity_level.html + ': ' + this.severity_level.type + ')' }

/*
 * WIDGET HELPER FUNCTIONS
 */

/**
 * @summary Build keys to pass to an action
 * @param {Array.<Object>} keys    keys to pass
 * @param {string}         context some keys should only be passed in certain contexts
 * @protected
 * @example
 * var args = policy._build_keys([
 *     { type: 'severity'                    , value: my_severity_level },
 *     { type: 'username' , name: 'username' , value:      user },
 *     { type: 'usernames', name: 'usernames', value: all_users },
 *     { type: 'literal'  , name: 'name'     , value: 'value' }
 * ]);
 */
Policy.prototype._build_keys = function(keys, context) {

    var date = new Date().getTime();

    var policy = this;
    var bb = this.bb;
    function user_username(user) { return user.username }
    function user_link    (user) { return '[URL="' + location.origin + bb.url_for.user_show({ user_id: user.user_id }) + '"]' + user.username + '[/URL]' }

    var ret = {
        me: bb.user_current().username,
    };

    [ this.default_keys, keys ].forEach(function(keys) {
        keys.forEach(function(key) {
            switch ( key.type ) {

            case 'severity':
                var level = key.value;
                ret['severity level' ] = level.html;
                ret['infraction type'] = level.type;
                break;

            case 'image':
                ret[key.name + ' URL'  ] =           key.value;
                ret[key.name + ' image'] = '[IMG]' + key.value + '[/IMG]';
                break;

            case 'username':
                ret[key.name               ] = user_username(key.value);
                ret[key.name + ' with link'] = user_link    (key.value);
                break;

            case 'usernames':
                var users = key.value;
                ret[                key.name                 ] = users.filter(function(u) { return  u.is_target  }).map(user_username)[0];
                ret[                key.name +  ' with link' ] = users.filter(function(u) { return  u.is_target  }).map(user_link    )[0];
                ret[                key.name + 's'           ] = users                                             .map(user_username);
                ret[                key.name + 's with links'] = users                                             .map(user_link    );
                ret['primary '    + key.name                 ] = users.filter(function(u) { return  u.is_primary }).map(user_username)[0];
                ret['primary '    + key.name +  ' with link' ] = users.filter(function(u) { return  u.is_primary }).map(user_link    )[0];
                ret['additional ' + key.name + 's'           ] = users.filter(function(u) { return !u.is_primary }).map(user_username);
                ret['additional ' + key.name + 's with links'] = users.filter(function(u) { return !u.is_primary }).map(user_link    );
                ret['other '      + key.name + 's'           ] = users.filter(function(u) { return !u.is_target  }).map(user_username);
                ret['other '      + key.name + 's with links'] = users.filter(function(u) { return !u.is_target  }).map(user_link    );
                break;

            case 'thread':
                ret[key.name + ' id'             ] = key.value.thread_id;
                ret[key.name + ' url'            ] = bb.url_for.thread_show({ thread_id: key.value.thread_id });
                ret[key.name + ' title'          ] = key.value.thread_desc;
                ret[key.name + ' title with link'] = '[thread=' + key.value.thread_id + ']' + key.value.thread_desc + '[/thread]';
                break;

            case 'forum':
                ret[key.name + ' title'          ] = key.value.forum_desc;
                ret[key.name + ' title with link'] = '[URL="' + location.origin + bb.url_for.forum_show({ forum_id: key.value.forum_id }) + '"]' + key.value.forum_desc + '[/URL]';
                break;

            case 'action data':
                if ( context == 'widget' ) break;
                var action_data = key.value;
                if ( action_data.hasOwnProperty('deadline') && action_data.deadline != '' ) {

                    var deadline = parse_duration(action_data.deadline);
                    if ( deadline ) {
                        action_data.deadline = deadline.date.getTime();
                        ret.deadline = deadline.date.toUTCString().replace(/:[0-9][0-9] /, ' ' );
                    } else {
                        alert( 'invalid deadline: ' + action_data.deadline );
                        throw 'invalid deadline: ' + action_data.deadline;
                    }

                }

                ret[key.name] = policy.v.escape(
                    bb.stringify( 'action data', $.extend( { namespace: policy._namespace, name: policy.name, date: date }, action_data ) )
                );
                break;

            case 'literal':
                ret[key.name] = key.value;
                break;

            }
        });
    });

    return ret;

}

/**
 * @summary Build arguments to pass to a widget
 * @param {Object}         args arguments to pass
 * @param {Array.<Object>} keys keys to pass
 * @protected
 * @example
 * var args = this._build_widget_args({foo: 'bar'}, [
 *     { type: 'severity'                               , value: my_severity_level },
 *     { type: 'username' , name:            'username' , value:      user },
 *     { type: 'usernames', name:            'usernames', value: all_users },
 *     { type: 'literal', name: 'name' , value: 'value' }
 * ], Array.prototype.slice.call( arguments, 1 ));
 */
Policy.prototype._build_widget_args = function(args, keys, extra_args) {
    return $.extend.apply(
        $,
        [
            { keys: this._build_keys(keys, 'widget') },
            this._widget_args,
            args
        ].concat(extra_args)
    );
}

/*
 * EXTRA POST WIDGETS
 */

/**
 * @summary Build values to initialise or update an extra_post widget
 * @param {Object=}   level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Object} extra_post arguments
 */
Policy.prototype.extra_post_args = function(level) {

    if ( !level ) level = this.severity_level;

    var extra_data = this.get( this.name.concat([ 'extra action', level.html ]) ).text;

    var ret;
    if ( extra_data === null )
        ret = { visible: false, checked: false, text: '' }
    else
        ret = this._extra_post_values[extra_data.toLowerCase()] || { visible: false, checked: false, text: '' };

    ret. title_variable = this.name.concat([ ret.var_prefix + ' post title'  ]);
    ret.bbcode_variable = this.name.concat([ ret.var_prefix + ' post bbcode' ]);

    return this._build_widget_args( ret, [{ type: 'severity' , value: level }], Array.prototype.slice.call( arguments, 1 ) );

}

/**
 * @summary Build an action for an extra_post widget
 * @param {Object=} level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Action}
 */
Policy.prototype.extra_post_action = function(widget) {

    var value = widget.val();
    return new Action(
        this.name.join(': ') + ' extra post wrapper',
        ( value.checked && value.text == this._extra_post_values['ip ban'].text )
            ? new IPAddressReport({ bb: this.bb, users: [this.user] }).action().then(widget.action())
            : widget.action()
    );

}


/*
 * NOTIFICATION SELECTOR WIDGETS
 */

/**
 * @summary Build values to initialise or update a notification_selector widget
 * @param {Object=} level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Object} notification_selector arguments
 */
Policy.prototype.notification_selector_args = function(level) {

    var title_suffix = ' title';

    if ( !level ) level = this.severity_level;
    if ( level.type == 'infraction' || level.type == 'warning' ) title_suffix = ' administrative note';

    var default_violation = this.get( this.name.concat([ 'default violation' ]).concat(this.variable_suffix) );

    return this._build_widget_args({
        level: level.type,
              title_variable: this.name.concat([ level.type + title_suffix  ]).concat(this.variable_suffix),
                ban_variable: this.name.concat([               'ban reason' ]).concat(this.variable_suffix),
             bbcode_variable: this.name.concat([ level.type + ' bbcode'     ]).concat(this.variable_suffix),
         note_title_variable: this.name.concat([ 'note' +     ' title'      ]).concat(this.variable_suffix),
        note_bbcode_variable: this.name.concat([ 'note' +     ' bbcode'     ]).concat(this.variable_suffix),
        show_violations: default_violation.text !== null,
        violation      : ( default_violation.text === null ) ? this._default_violation : this.v.parse( default_violation.text ),
        user: this.user
    }, [{ type: 'severity' , value: level }], Array.prototype.slice.call( arguments, 1 ) );

}

/**
 * @summary Build an action for a notification_selector widget
 * @param {Object=} level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Action}
 */
Policy.prototype.notification_selector_action = function(widget) { return widget.action() }


/*
 * DEADLINE WIDGETS
 */

/**
 * @summary Build values to initialise or update a deadline widget
 * @param {Object=} level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Object} deadline arguments
 */
Policy.prototype.deadline_args = function() {

    var deadlines = this.resolve( ['deadlines'].concat(this.variable_suffix), {}, 'array of items' ).map(function(deadline) {
        deadline = deadline.value.split(/\s*:\s*/, 2 );
        return { value: deadline[0], text: deadline[1] };
    });

    return this._build_widget_args({
        deadline : this.check( ['deadline'].concat(this.variable_suffix) ) ? this.resolve( ['deadline'].concat(this.variable_suffix) ) : '',
        deadlines: deadlines,
         title_variable: ['deadline post title' ].concat(this.variable_suffix),
        bbcode_variable: ['deadline post bbcode'].concat(this.variable_suffix)
    }, [], Array.prototype.slice.call( arguments, 1 ));

}

/**
 * @summary Build an action for a deadline widget
 * @param {Object=} level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Action}
 */
Policy.prototype.deadline_action = function(widget) { return widget.action() }


/*
 * SEVERITY SLIDER WIDGETS
 */

/**
 * @summary Build values to initialise or update a severity_slider widget
 * @param {Object=} level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Object} severity_slider arguments
 */
Policy.prototype.severity_slider_args = function(level) {
    return this._build_widget_args({
        levels:          this.severity_levels,
        value : level || this.severity_level.html
    }, [], Array.prototype.slice.call( arguments, 1 ));
}


/*
 * DUPLICATE ACCOUNT LIST WIDGETS
 */

/**
 * @summary Build values to initialise or update a duplicate_account_list widget
 * @param {Object=} level severity level
 * @param {...Object} more arguments
 * @protected
 * @return {Object} duplicate_account_list arguments
 */
Policy.prototype.duplicate_account_list_args = function(level) {
    return this._build_widget_args({}, [], Array.prototype.slice.call( arguments, 1 ));
}

/*
 * COMMON NON-WIDGET-RELATED ACTIONS
 */

/**
 * @summary Close the thread targeted by this policy
 * @protected
 * @return {Action}
 */
Policy.prototype.close_thread = function() {

    var policy = this;

    return new Action( 'close thread', {
        fire: function() {
            return policy.bb.thread_openclose( policy._widget_args.thread_id, false );
        },
        description: function() {
            return [
                {
                    type: 'close',
                    target: { thread_id: policy._widget_args.thread_id, thread_desc: policy._widget_args.thread_desc }
                },
            ];
        },
    })

}
