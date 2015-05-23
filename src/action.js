/**
 * @file Manage a directed acyclic graph of moderation actions
 * @author Andrew Sayers
 * @description Manage actions that could be taken while e.g. resolving a report
 * Most actions are represented by a tree of Promise objects - the root set of promises fires first, followed by branch promises, towards leaf promises.
 * We occasionally need branches to join up again, so in the general case it's not a tree but a directed acyclic graph.
 *
 * See action-explanation.js for an overview of how to use Actions
 */

/**
 * @summary Manage a node and associated subset of the action graph
 * @param {...(Action|Array|Object)} var_args (arrays of) promises to fire
 * @constructor
 *
 * @example
 * var my_action = new Action(
 *     'Action title', // used to make debugging data more readable
 *     // pass a list of promises that will be executed
 *     {
 *         fire: function() { // called by action.fire()
 *             return $.post(...);
 *         },
 *         description: function() { // optional: return debugging information
 *             return [
 *                 { type: "PM", target: {username: 'Joe Bloggs', user_id: 12345  } },
 *             ];
 *         },
 *         blockers: function() {
 *             return [ 'Message describing how to resolve the thing blocking the action' ];
 *         },
 *     },
 *     // further promises will be executed in parallel:
 *     new Action(...),
 *     [ { ... }, new Action(...) ], // arrays are expanded automatically
 *     // ...
 * );
 */
function Action(title) {

    var promises  = this._promises  = [];
    var contained = this._contained = [];
    this._children  = [];
    this._level     = null;
    this._title     = title;

    function add(action) {
        if ( typeof(action) == 'undefined' ) {
            // ignore e.g. undefined values returned from a 'map' function
        } else if ( action instanceof Action ) {
            contained.push(action);
        } else if ( action !== null ) {
            promises .push(action);
        }
    }

    for ( var n=1; n!=arguments.length; ++n ) {
        if ( $.isArray(arguments[n]) )
            arguments[n].forEach(add);
        else
            add(arguments[n]);
    }

}

Action.prototype = Object.create(Object, {
    _promises  : { writable: true , configurable: false },
    _contained : { writable: true , configurable: false },
    _children  : { writable: true , configurable: false },
    _level     : { writable: true , configurable: false },
    _fire_count: { writable: true , configurable: false },
    _title     : { writable: true , configurable: false },
    _debug     : { writable: true , configurable: false, value: false } // check for programming errors in actions
});
Action.prototype.constructor = Action;

/**
 * @summary add another action that will fire after this completes
 * @param {...Action} actions actions to add
 * @return {Action} the current action
 * @description
 * This mimics jQuery's "then" API, but we currently modify the existing action instead of returning a new one.
 * This was an implementation shortcut and might be fixed if we find a use for the full behaviour
 */
Action.prototype.then = function() {

    var children = this._children;

    function add(action) {
        if ( typeof(action) == 'undefined' ) {
            // ignore e.g. undefined values returned from a 'map' function
        } else if ( action !== null ) {
            children.push(action);
        }
    }

    for ( var n=0; n!=arguments.length; ++n ) {
        if ( $.isArray(arguments[n]) )
            arguments[n].forEach(add);
        else
            add(arguments[n]);
    }

    return this;

}

/**
 * @summary fire the graph of actions starting with this one
 * @param {BulletinBoard} bb   BulletinBoard
 * @param {Object}        keys keys to pass to all actions
 * @return {jQuery.Promise} promise representing the full graph of actions
 *
 * @description the promise will be resolved when the final action is resolved,
 * or rejected shortly after the first action fails (ongoing requests will be allowed to finish).
 * progress() will be called regularly with a fraction representing the completeness of the complete set of actions.
 */
Action.prototype.fire = function(bb, keys) {

    /*
     * STEP ONE: calculate "progress levels"
     *
     * We calculate progress using the polite fiction that all actions at each level in the graph are fired at the same time.
     * Actions actually fire as soon as they're ready, but the progress bar looks prettier if we think of it that way
     *
     * 1. Actions are assigned "levels" based on their depth in the action graph
     * 2. The total number of promises at each level is calculated
     * 3. Each time an action's promise completes, progress increases by 100 / (number of promises at this level * total number of levels)
     *
     */

    var blockers = this.blockers();
    if ( blockers.length ) {
        alert( ['Blocked - please resolve the following issues:\n'].concat(blockers).join( "\n* " ) );
        var dfd = new jQuery.Deferred();
        dfd.reject();
        return dfd.promise();
    }

    var promises_per_level = [ 0 ];

    function set_level(action, level) {

        action._fire_count = 0;

        if ( action._level != null ) throw "Please fix your action graph so this Action only appears at one point: " + JSON.stringify(action);
        action._level = level;

        if ( promises_per_level.length <= level ) promises_per_level[level] = 0;
        promises_per_level[level] += action._promises.length;

        // set level for contained actions, and calculate level at which child actions will fire
        var child_level = level;
        if ( action._promises.length ) ++child_level;
        action._contained.forEach(function(action) {
            var action_level = set_level( action, level );
            if ( child_level < action_level ) child_level = action_level;
        });

        var deepest_leaf_level = child_level; // level of the deepest leaf node fired by the action subgraph rooted at this node
        action._children.forEach(function(action) {
            var action_level = set_level(action, child_level);
            if ( deepest_leaf_level < action_level ) deepest_leaf_level = action_level;
        });

        return deepest_leaf_level;

    }
    set_level( this, 0 );

    function get_title(promise) {
        if ( !promise.hasOwnProperty('description') ) return;
        var descriptions = promise.description();
        if ( !descriptions ) return;
        descriptions = descriptions.map(function(desc) {
            switch ( desc.type ) {
            case 'PM'        : return      'PM [URL="' + location.origin + bb.url_for.user_show({ user_id: desc.target.user_id }) + '"]' + desc.target.username + '[/URL]';
            case 'warning'   : return    'warn [URL="' + location.origin + bb.url_for.user_show({ user_id: desc.target.user_id }) + '"]' + desc.target.username + '[/URL]';
            case 'infraction': return 'infract [URL="' + location.origin + bb.url_for.user_show({ user_id: desc.target.user_id }) + '"]' + desc.target.username + '[/URL]';
            case 'usernote'  : return 'update [URL="' + location.origin + bb.url_for.user_notes({ user_id: desc.target.user_id }) + '"]user notes for ' + desc.target.username + '[/URL]';
            case 'close'     : return 'close [thread=' + desc.target.thread_id + ']' + desc.target.thread_desc + '[/thread]';
            case 'post'      : return 'reply to ' + (
                desc.target.post_id
                ?   '[post=' + desc.target.  post_id + ']' + desc.target.thread_desc + '[/post]'
                : '[thread=' + desc.target.thread_id + ']' + desc.target.thread_desc + '[/thread]'
            );
            case 'user IPs'  : return 'Download [URL="' + location.origin + bb.url_for.moderation_ipsearch($.extend( {depth:2}, desc.target )) + '"]IP address report for ' + desc.target.username + '[/URL]';
            case 'IP users'  : return 'Download user reports for ' + desc.target.length + ' IP address(es)';
            default          : return desc.type;
            }
        });
        switch ( descriptions.length ) {
        case 0: return;
        case 1: return descriptions[0];
        default:
            var last = descriptions.pop();
            return descriptions.join(', ') + ' and ' + last;
        }
    }

    /*
     * STEP TWO: fire actions in turn
     */

    var graph_dfd = new jQuery.Deferred();

    var progress = 0;

    var completed_promises = [];
    var failure_count = 0;

    function fire_action( action, keys, done_cb ) {

        if ( action._fire_count++ ) {
            throw "Giving up: cycle detected in action graph";
        }

        if ( failure_count ) return done_cb({ keys: keys }); // on failure, exit at the earliest convenience

        keys = $.extend( {}, keys ); // clone keys

        var start_time = new Date();
        var in_progress = 1; // in case of actions that return instantly, (see the last line in this function)

        // called when a child action completes:
        function child_completed(ret) {
            $.extend( keys, ret.keys );
            if ( !--in_progress ) done_cb({ keys: keys });
        }

        // called when all contained promises/actions have completed:
        function node_completed() {
            if ( action._children.length ) {
                in_progress = action._children.length;
                action._children.forEach(function(action) { fire_action( action, keys, child_completed ) });
            } else {
                done_cb({ keys: keys });
            }
        }

        // called when a contained promise or action completes:
        function contained_completed(ret, promise, result, error) {

            if ( ret && ret.hasOwnProperty('keys') ) $.extend( keys, ret.keys );

            if ( promise ) {
                promise.result     = result;
                promise.start_time = start_time;
                promise.end_time   = new Date();
                promise.error      = ( typeof(error) == 'string' ) ? error : '';
                promise.title      = get_title(promise);
                if ( !promise.title ) delete promise.title;
                completed_promises.push(promise);

                progress += 100 / promises_per_level[action._level];
                graph_dfd.notify( Math.floor( progress / promises_per_level.length ) );
            }

            if ( !--in_progress ) node_completed();

        }

        action._promises.forEach(function(promise) {
            if ( promise ) {
                if ( Action.prototype._debug ) {
                    try {
                        promise.promise = promise.fire($.extend( {}, keys ) );
                    } catch (error) {
                        console.log( action._title + ': ' + error, promise );
                        alert      ( action._title + ': ' + error );
                        throw error;
                    };
                } else {
                    promise.promise = promise.fire($.extend( {}, keys ) );
                }

                if ( promise.promise) {
                    ++in_progress;
                    if ( promise.promise.then ) { // looks like a promise
                        promise.promise = promise.promise.then(
                            function(ret) {                  contained_completed(ret , promise, 'success', null) },
                            function(err) { ++failure_count; contained_completed(null, promise, 'fail'   , err ) }
                        );
                    } else if ( promise.promise.keys ) { // looks like keys
                        contained_completed( promise.promise, null, 'success', null);
                    }
                }
            }
        });

        in_progress += action._contained.length;
        action._contained.forEach(function(action) { fire_action( action, keys, contained_completed ) });

        if ( !--in_progress ) node_completed(); // subtract the initial 'in progress' action

    }

    fire_action( this, keys, function(keys) {
        if ( failure_count )
            graph_dfd.reject ( completed_promises, keys.keys );
        else
            graph_dfd.resolve( completed_promises, keys.keys );
    });

    return graph_dfd.promise();

}

/**
 * @summary call fire(), with values logged to a journal post
 * @param {BulletinBoard} bb        BulletinBoard
 * @param {Object}        keys      keys to pass to all actions
 * @param {Variables}     v         object to retrieve variables from
 * @param {Number}        thread_id thread to post the journal in
 * @param {string}        namespace namespace to retrieve journal variables from
 * @param {name}          name      unique name of this action
 * @return {jQuery.Promise} promise representing the full graph of actions
 *
 * @description To improve the audit trail for large actions, you might want to
 * record the action you're about to perform, perform the action, then record
 * the outcome.
 *
 * This function posts a reply to a thread, calls .fire(), then edits the
 * post when .fire() completes.  Posts will be constructed using variables
 * named [ name + ( ' title' or ' body' ), 'before' or 'after' ], e.g.
 * [ name+' title', 'before' ] will be used to get the title for the "before" post.
 */
Action.prototype.fire_with_journal = function(bb, keys, v, thread_id, namespace, name) {

    var policy = this;

    var sort_order = {
        title    : 0,
        promises : 1,
        contained: 2,
        children : 3
    }

    keys['debug info'] = v.escape(
        bb.stringify(
            namespace + ': ' + name,
            this.long_description(),
            function(a,b) { return sort_order[a.key] < sort_order[b.key] ? -1 : 1 }
        )
    );

    function finalise(completed_promises, journal_post_id, keys, result) {

        var start_time = completed_promises[0].start_time;

        keys['action result data'] =
            'Action started at: ' + start_time + "\n" +
            '[table]'
        ;

        completed_promises = completed_promises.filter(function(promise) { return promise.hasOwnProperty('title') });

        var has_errors = completed_promises.reduce(function(prev,promise) { return prev + promise.error }, '' ) != '';
        keys['action result data'] += (
            has_errors
            ? '[tr][th]Result[/th][th]Time[/th][th]Duration[/th][th]title[/th][th]error[/th][/tr]'
            : '[tr][th]Result[/th][th]Time[/th][th]Duration[/th][th]title[/th][/tr]'
        );

        var escape_div = $('<div></div>');

        keys['action result data'] += completed_promises.map(function(promise) {
            return '[tr]' +
                ( ( promise.result == 'success' ) ? '[td]:) success' : '[td]:o failure' ) + '[/td]' +
                '[td]' + ( ( promise.start_time.getTime() - start_time.getTime() ) / 1000 ) + 's[/td]' +
                '[td]' + ( ( promise.end_time.getTime() - promise.start_time.getTime() ) / 1000 ) + 's[/td]' +
                '[td]' + promise.title + '[/td]' +
                ( has_errors
                  ? '[td][noparse]' + escape_div.text( promise.error ).html() + '[/noparse][/td]'
                  : ''
                ) +
                '[/tr]';
        }).join('');

        var end_time = completed_promises.reduce(function(prev, p) { return prev.getTime() > p.end_time ? prev : p.end_time }, start_time );
        keys['action result data'] +=
            '[/table]\n' +
            'Action completed at: ' + end_time + ' (total duration: ' + ( ( end_time.getTime() - start_time.getTime() ) / 1000 ) + 's)'
        ;

        return bb.post_edit({
            post_id: journal_post_id,
            title : v.resolve(namespace, [ name + ' title', 'after' ], keys),
            bbcode: v.resolve(namespace, [ name + ' body' , 'after' ], keys),
            reason: 'action ' + result
        });

    }

    var blockers = this.blockers();
    if ( blockers.length ) {
        alert( ['Blocked - please resolve the following issues:\n'].concat(blockers).join( "\n* " ) );
        var dfd = new jQuery.Deferred();
        dfd.reject();
        return dfd.promise();
    }


    return bb.ping().then(function(data) {
        if ( data.result == 'success' && data.duration < 1000 ) {
            return bb.thread_reply({
                thread_id: thread_id,
                title    : v.resolve(namespace, [ name + ' title', 'before' ], keys),
                bbcode   : v.resolve(namespace, [ name + ' body' , 'before' ], keys)
            }).then(function(journal_post_id) {

                keys['journal post id'] = journal_post_id;

                return policy.fire(bb, keys).then(
                    function(completed_promises, keys) { return finalise( completed_promises, journal_post_id, keys, 'succeeded' ) },
                    function(completed_promises, keys) { return finalise( completed_promises, journal_post_id, keys, 'failed'    ) }
                );

            });
        } else if ( data.result == 'success' ) {
            alert(
                'The server took ' + (data.duration/1000) + ' seconds to respond to a simple request.\n' +
                "If we tried to complete this action now, the server might not process all of our requests.\n" +
                "Please try again when the server has calmed down."
            );
        } else {
            alert(
                'The server could not be contacted after ' + (data.duration/1000) + ' seconds.\n' +
                "Please make sure you and the server are online, then try again."
            );
        }
        var dfd = new jQuery.Deferred;
        dfd.reject();
        return dfd.promise();
    });

}


/**
 * @summary Long description of actions that will be performed (suitable for debugging use)
 * @return {string} long description
 */
Action.prototype.long_description = function() {

    // Get all the descriptions in the subgraph rooted at this node:
    var root_description = [], all_descriptions = [];
    var actions = [ [ root_description, this ] ];
    while ( actions.length ) {
        var action = actions.shift();
        var parent_description = action[0];
        action = action[1];
        var description = {
            title   : action._title,
            promises: action._promises.map(function(promise) {
                if ( promise.hasOwnProperty('description') ) return promise.description();
            }),
            contained: [],
            children: []
        };
        action._contained.forEach(function(action) { actions.push([ description.contained, action ]) });
        action._children .forEach(function(action) { actions.push([ description.children , action ]) });
        parent_description.push(description);
        all_descriptions.push(description);
    }

    // have to do this once .contained is fully populated:
    all_descriptions.forEach(function(description) {
        if ( !description.promises .reduce(function(prev, item) { return prev || item }, false ) ) delete description.promises;
        if ( !description.children .reduce(function(prev, item) { return prev || item }, false ) ) delete description.children;
        if ( !description.contained.reduce(function(prev, item) { return prev || item }, false ) ) delete description.contained;
    });

    return root_description[0];

}

/**
 * @summary describe the graph of actions starting with this one
 * @return {Array.<string>} short descriptions
 */
Action.prototype.title = function() {

    var descriptions = [];
    // Get all the descriptions in the subgraph rooted at this node:
    function get_descriptions(action) {
        action._promises.forEach(function(promise) {
            if ( !promise.hasOwnProperty('description') ) return;
            var desc = promise.description();
            if ( desc ) descriptions = descriptions.concat( desc );
        });
        action._contained.forEach(get_descriptions);
        action._children .forEach(get_descriptions);
    }
    get_descriptions(this);

    // Convert the list of actions to a user-friendly string:

    // STEP ONE: group together actions on a common target:
    var descriptions_by_target = { user: [], thread: [] }, target_types = {
        'PM'        : 'user',
        'warning'   : 'user',
        'infraction': 'user',
        'usernote'  : 'user',
        'user IPs'  : 'user',
        'post'      : 'thread',
        'close'     : 'thread'
    };
    descriptions.forEach(function(description, index) {

        if ( !target_types.hasOwnProperty(description.type) ) return;

        var target_type = target_types[description.type];
        var target = target_type == 'user' ? description.target.user_id : description.target.thread_id;
        if ( descriptions_by_target[target_type].hasOwnProperty(target) )
            descriptions_by_target[target_type][target].push( description );
        else
            descriptions_by_target[target_type][target] = [ description ];
    });
    Object.keys(descriptions_by_target).forEach(function(target) {
        descriptions_by_target[target].forEach(function(desc_list) {
            if ( desc_list.length == 1 ) return;
            desc_list[desc_list.length-1].type = desc_list.map(function(desc) {
                desc.ignore = true;
                switch ( desc.type ) {
                case 'PM'        : return 'PM';
                case 'warning'   : return 'warn';
                case 'infraction': return 'infract';
                case 'usernote'  : return 'add a note for';
                case 'user IPs'  : return 'build IP address report for';
                case 'post'      : return 'reply to';
                case 'close'     : return 'close';
                default: throw 'impossible: ' + desc.type;
                }
            }).join(', ').replace( /, ([^,]*)$/, " and $1 " ).replace( / for,/, ',' );
            desc_list[desc_list.length-1].multiple_target = target;
        });
    });
    descriptions = descriptions.filter(function(desc) { return desc.multiple_target || !desc.ignore });

    // STEP TWO: GROUP ACTIONS BY TYPE
    var descriptions_by_type = {}, descriptions_list = [];

    descriptions.forEach(function(description, index) {
        if ( descriptions_by_type.hasOwnProperty(description.type) ) {
            descriptions_by_type[ description.type ].highest_index = index;
            descriptions_by_type[ description.type ].targets.push( description.target );
        } else {
            descriptions_list.push(
                descriptions_by_type[ description.type ] = { type: description.type, multiple_target: description.multiple_target, targets: [ description.target ], highest_index: index }
            );
        }
    });

    // STEP THREE: BUILD THE LIST
    return descriptions_list.sort(function(a,b) { return b.highest_index < a.highest_index }).map(function(desc_type) {
        var targets = desc_type.targets;
        switch ( desc_type.multiple_target ) {
        case 'user'  : return ( targets.length == 1 ) ? desc_type.type + targets[0].username : desc_type.type + targets.length + ' users';
        case 'thread': return ( targets.length == 1 ) ? desc_type.type + targets[0].thread_desc : desc_type.type + targets.length + ' threads';
        case undefined:
            switch ( desc_type.type ) {
            case 'PM'        : return ( targets.length == 1 ) ? 'PM '      +          targets[0].username    : 'send '    + targets.length + ' PMs';
            case 'warning'   : return ( targets.length == 1 ) ? 'warn '    +          targets[0].username    : 'warn '    + targets.length + ' accounts';
            case 'infraction': return ( targets.length == 1 ) ? 'infract ' +          targets[0].username    : 'infract ' + targets.length + ' accounts';
            case 'usernote'  : return ( targets.length == 1 ) ? 'update notes for ' + targets[0].username    : 'update '  + targets.length + ' user notes';
            case 'post'      : return ( targets.length == 1 ) ? 'reply to ' +         targets[0].thread_desc : 'post '    + targets.length + ' replies';
            case 'close'     : return ( targets.length == 1 ) ? 'close '    +         targets[0].thread_desc : 'close '   + targets.length + ' threads';
            case 'user IPs'  :
                if ( targets.length == 1 )
                    return 'Build IP address report for ' + targets[0].username;
                else
                    return 'Build IP address report(s) for ' + targets.length + ' users';
            default:
                if ( targets.length == 1 )
                    return desc_type.type
                else
                    return desc_type.type + ' x ' + desc_type.targets.length;
            }
        }
    });

}

/**
 * @summary list of things blocking the action from firing
 * @return {Array.<string>} list of blockers
 */
Action.prototype.blockers = function() {

    var blockers = [];
    // Get all the blockers in the subgraph rooted at this node:
    function get_blockers(action) {
        action._promises.forEach(function(promise) {
            if ( !promise.hasOwnProperty('blockers') ) return;
            var blocker = promise.blockers();
            if ( blocker ) blockers = blockers.concat( blocker );
        });
        action._contained.forEach(get_blockers);
        action._children .forEach(get_blockers);
    }
    get_blockers(this);

    return blockers;

}
