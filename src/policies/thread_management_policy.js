/**
 * @file manage policy for common thread management actions
 * @author Andrew Sayers
 * This file defines thread management policy in the abstract,
 * but sadly needs to be tightly coupled to the interface.
 */

/**
 * @summary manage policy for common thread management actions
 * @constructor
 * @example
 * var policy = new ThreadManagementPolicy({
 *
 *     // objects:
 *     v : v, // Variables object
 *     bb: bb, // BulletinBoard object
 *     mod_team_bb: bb, // BulletinBoard object for the moderation team
 *     mc: mc, // MiscellaneousCache object
 *     vi: vi, // Violations object
 *
 *     // configuration:
 *     thread_id     : 1234,
 *     thread_desc   : 'thread description',
 *     loading_html  : 'loading, please wait...',
 *     user          : { username: 'thread creator username', user_id: 12345 }
 *     callback: function( action, summary, template, has_post, has_pm ) { ... };
 *
 *     // widget placement:
 *         post_selector_args: { container: $(    '.post_selector_container') },
 *           pm_selector_args: { container: $(      '.pm_selector_container') },
 *     template_selector_args: { container: $('.template_selector_container') }
 *      message_selector_args: { container: $( '.message_selector_container') }
 * });
 */
function ThreadManagementPolicy(args) {

    Policy.call( this, args );

    var policy = this;

    var action_data = {
        thread: { thread_id: args.thread_id, thread_desc: args.thread_desc, forum_id: args.forum_id },
        template: 'no template'
    };
    var variable_suffix = [action_data.template];
    this.variable_suffix = variable_suffix;

    var forum_has_icons;

    var unmerge_data;

    var macro_defaults = { template: 'no template' };
    var recent_macros = new RecentList({ ss: args.ss, name: 'recent thread management macros', });

    var thread_creator = this.user = {
        is_target: true,
        username: args.first_post.username,
        user_id : args.first_post.user_id
    };
    this.default_keys = [

        { type: 'thread'     , name: 'old thread'      , value: { thread_id: args.thread_id, thread_desc: args.thread_desc } },
        { type: 'thread'     , name: 'new thread'      , value: { thread_id: args.thread_id, thread_desc: args.thread_desc } },
        { type: 'forum'      , name: 'old forum'       , value: {  forum_id: args. forum_id,  forum_desc: args. forum_desc } },
        { type: 'forum'      , name: 'new forum'       , value: {  forum_id: args. forum_id,  forum_desc: args. forum_desc } },
        { type: 'literal'    , name: 'new prefix'      , value: '' },
        { type: 'image'      , name: 'new icon'        , value: '' },

        { type: 'literal'    , name: 'user-friendly description of actions', value: '' },
        { type: 'literal'    , name:  'mod-friendly description of actions', value: '' },

        { type: 'username'   , name: 'username'        , value: thread_creator },
        { type: 'username'   , name: 'thread creator'  , value: thread_creator },
        { type: 'literal'    , name: 'mod team user id', value: args.mod_team_user.user_id },
        { type: 'literal'    , name: 'first post id'   , value: args.first_post.post_id },
        { type: 'action data', name: 'action data'     , value: action_data },
        { type: 'literal'    , name: 'template'        , value: 'no template' }

    ];

    /*
     * BUILD CALLBACK
     */

    var original, metadata;
    function callback_timeout() {

        cb_timeout = null;

        var actions = [];

        var has_post = message_selector.find('[name="post"]').prop('checked');
        var has_pm   = message_selector.find('[name="pm"]'  ).prop('checked');

        variable_suffix.splice(1);

        if ( status_widget.val() == 'merged' ) { // Merging is a completely different process to everything else

            variable_suffix.push('merge');

            var merge_post_id;

            var edit_action = new Action( 'close thread', {
                fire: function(keys) {
                    var destination_thread = title_widget.val();
                    post.thread_id = destination_thread.target_thread_id;
                    action_data.destination_thread = destination_thread = {
                        thread_id: destination_thread.target_thread_id,
                        thread_desc: destination_thread.target_thread_desc,
                        forum_id: destination_thread.target_forum_id
                    };
                    post.bb = args.mod_team_bb; // merge posts are always sent from the mod account, so they can be searched for
                    return args.bb.thread_edit({
                        thread_id   : args.thread_id,
                        title       : args.thread_desc,
                        notes       : policy.resolve('edit notes', keys ),
                        close_thread: true
                    }).then(function(html) { // Get information from the closed thread
                        return args.bb.thread_posts( args.thread_id, html ).then(function (posts) {
                            var return_keys = {
                                'list of posts in merged thread':
                                    '[TABLE="class: outer_border"]\n' +
                                        '[TR][TH]Post #[/TH][TH]author[/TH][TH]summary[/TH][/TR]\n' +
                                        posts.map(function(post, index) {
                                            return (
                                                '[TR][TD][center][post=' + post.post_id + ']#' + (index+1) + '[/post][/center][/TD][TD]' +
                                                '[URL="' + location.origin + args.bb.url_for.user_show({ user_id: post.user_id }) + '"]' + post.username + '[/URL][/TD][TD]' +
                                                args.bb.post_summary(post) + '[/TD][/TR]\n'
                                             );
                                        }).join('') +
                                    '[/TABLE]',
                                'merge data': args.bb.stringify( 'merge data', {
                                    date: new Date().getTime(),
                                    source_thread: unmerge_data,
                                    destination_thread: destination_thread,
                                    posts: posts.map(function(post) { return post.post_id })
                                })
                            };
                            post.add_known_keys( return_keys );
                            pm  .add_known_keys( return_keys );
                            return { keys: return_keys };
                        });
                    });
                },
                description: function() {
                    return [
                        {
                            type: 'change thread status',
                            target: { thread_id: args.thread_id, thread_desc: args.thread_desc, forum_id: args.forum_id }
                        }
                    ];
                },
                blockers: function() {
                    if ( !title_widget.val().target_thread_id ) return [ 'Please select a valid merge target' ];
                }
            });

            var log_action = new Action( 'post in merge log', {
                fire: function(keys) {
                    return args.bb.thread_reply({ // Notify/save all posts in thread
                        thread_id: args.v.resolve('frequently used posts/threads', 'merge log'),
                        title    : policy.resolve('merge title' , keys),
                        bbcode   : policy.resolve('merge bbcode', keys)
                    }).then(function(post_id) {
                        merge_post_id = action_data.merge_log_post_id = post_id;
                        return { keys: { 'merge log post id': merge_post_id } };
                    });
                },
                description: function() {
                    var destination_thread = title_widget.val();
                    destination_thread = {
                        thread_id: destination_thread.target_thread_id,
                        thread_desc: destination_thread.target_thread_desc,
                        forum_id: destination_thread.target_forum_id
                    };
                    return [
                        {
                            type: 'post',
                            target: {
                                thread_desc: 'the merge log',
                                thread_id  : args.v.resolve('frequently used posts/threads', 'merge log'),
                                post_id    : merge_post_id
                            }
                        },
                    ];
                }
            });

            var merge_action = new Action( 'merge threads', {
                fire: function(keys) {
                    var destination_thread = title_widget.val();
                    return args.bb.thread_merge({
                        forum_id  :   destination_thread.target_forum_id,
                        thread_ids: [ destination_thread.target_thread_id, args.thread_id ],
                    });
                },
                description: function() {
                    var destination_thread = title_widget.val();
                    destination_thread = {
                        thread_id: destination_thread.target_thread_id,
                        thread_desc: destination_thread.target_thread_desc,
                        forum_id: destination_thread.target_forum_id
                    };
                    return [
                        {
                            type: 'merge threads',
                            source_thread: { thread_id: args.thread_id, thread_desc: args.thread_desc, forum_id: args.forum_id },
                            thread_creator: { username: args.first_post.username, user_id : args.first_post.user_id },
                            destination_thread: destination_thread
                        }
                    ];
                }
            });

            actions[0] = new Action( 'merge wrapper', edit_action.then(log_action.then(merge_action)) )

            policy.default_keys[7].value = ['merge'];

            if ( has_pm   ) {
                pm  .val( policy.notification_selector_args({ html: 'PM', type: 'PM' }) );
                actions[0].then( policy.notification_selector_action(pm  ) );
            }
            if ( has_post ) {
                post.val( policy.notification_selector_args({ html: 'post', type: 'post' }) );
                actions[0].then( policy.notification_selector_action(post) );
            }

        } else {

            var edit_actions = [],
                userfriendly_description = [],
                edit_target = { thread_id: args.thread_id, thread_desc: args.thread_desc, forum_id: args.forum_id }
            ;

            if ( status_widget.val() != original.status ) {
                var status = status_widget.val();
                if ( status == 'closed temporarily' ) {
                    action_data.deadline = status_widget.find('option:selected').data('deadline');
                    var thread_id = args.v.resolve('frequently used posts/threads', 'Moderation Chase-Up Thread' );
                    var post_id;
                    actions.push( new Action( 'chase-up post', {
                        fire: function(keys) {
                            return args.bb.thread_reply({
                                thread_id: thread_id,
                                title    : policy.resolve( 'deadline post title' , keys ),
                                bbcode   : policy.resolve( 'deadline post bbcode', keys ),
                            }).then(function(_post_id) {
                                action_data.chaseup_post_id = post_id = _post_id;
                                return { keys: {
                                    'chase-up post id': post_id,
                                    'extra actions'   : '[post=' + post_id + ']replied to the chase-up thread[/post]'
                                }};
                            });
                        },
                        description: function() { // description
                            return [{
                                type: 'post',
                                target: {
                                    thread_desc: 'the chase-up thread',
                                    thread_id  : thread_id,
                                      post_id  :   post_id
                                }
                            }];
                        }
                    }));
                }
                edit_actions.push( { type: 'change thread status', target: edit_target } );
                variable_suffix.push('change status', status);
                userfriendly_description.push('{{'+policy._namespace+': change status: ' + status + '}}');
            }
            if ( (prefix_widget.val()||'') != original.prefix ) {
                edit_actions.push( { type: 'change thread prefix', target: edit_target } );
                variable_suffix.push('change prefix');
                userfriendly_description.push('{{'+policy._namespace+': change prefix}}');
            }
            if ( forum_has_icons && icon_widget.getSelectedIndex() != original.icon ) {
                edit_actions.push( { type: 'change thread icon', target: edit_target } );
                variable_suffix.push('change icon');
                userfriendly_description.push('{{'+policy._namespace+': change icon}}');
            }

            if ( forum_widget.val() != original.forum_id ) {
                variable_suffix.push('change forum');
                userfriendly_description.push('{{'+policy._namespace+': change forum}}');
                if ( title_widget.val().thread_desc != original.title.thread_desc ) {
                    variable_suffix.push('change title');
                    userfriendly_description.push('{{'+policy._namespace+': change title}}');
                }
                actions.push( new Action(
                    'move thread',
                    {
                        fire: function(keys) {
                            var option = forum_widget.find(':selected');
                            action_data.destination_forum_id = option.val();
                            return args.bb.thread_move({
                                thread_id     : args.thread_id,
                                         title: title_widget.val().thread_desc,
                                redirect_title: original.title.thread_desc,
                                forum_id      : option.val(),
                                redirect      : parse_duration( policy.resolve( 'redirect deadline', keys ) )
                            });
                        },
                        description: function() {
                            var option = forum_widget.find(':selected');
                            var change_forum = {
                                type: 'change thread forum',
                                target: $.extend({
                                    forum_id: option.val(),
                                    forum_desc: option.text()
                                }, edit_target )
                            };
                            if ( title_widget.val().thread_desc == original.title.thread_desc )
                                return [change_forum];
                            else
                                return [
                                    change_forum,
                                    { type: 'change thread title', target: edit_target }
                                ];
                        },
                        blockers: function() {
                            if ( !forum_widget.val() ) return [ 'Please select a target forum' ];
                        }
                    }
                ));
            } else if ( title_widget.val().thread_desc != original.title.thread_desc ) {
                // we can retitle a thread at the same time as moving it
                edit_actions.push( { type: 'change thread title', target: edit_target } );
                variable_suffix.push('change title');
                userfriendly_description.push('{{'+policy._namespace+': change title}}');
            }

            policy.default_keys[6].value = userfriendly_description;
            policy.default_keys[7].value = userfriendly_description
                .map(function(d) { return d.replace(/{{'+policy._namespace+': (.*)}}/, '$1') });

            if ( edit_actions.length )
                actions.push( new Action(
                    'edit thread',
                    {
                        fire: function(keys) {
                            var edit_info = action_data.edit_info = {
                                thread_id       : args.thread_id,
                                title           : title_widget.val().thread_desc,
                                notes           : policy.resolve('edit notes', keys ),
                                icon_id         : forum_has_icons ? icon_widget.getSelectedValue() : undefined,
                                prefix_id       : prefix_widget.val(),
                                close_thread    : status_widget.val() == 'closed' || status_widget.val() == 'closed temporarily',
                                unapprove_thread: status_widget.val() == 'moderated',
                                delete_thread   : status_widget.val() == 'deleted',
                                delete_reason   : policy.resolve('delete reason', keys ),
                            };
                            return args.bb.thread_edit(edit_info);
                        },
                        description: function() {
                            return edit_actions;
                        },
                    }
                ));

            // need to do this before building the messages...
            var bump_value = bump_selector.find(':checked').val();
            //if ( bump_value ) variable_suffix.push(bump_value); // informing users about this would only cause problems

            if ( has_pm   ) {
                pm  .val( policy.notification_selector_args({ html: 'PM', type: 'PM' }) );
                actions.push( policy.notification_selector_action(pm  ) );
            }
            if ( has_post ) {
                post.val( policy.notification_selector_args({ html: 'post', type: 'post' }) );
                actions.push( policy.notification_selector_action(post) );
            }

            // ... but de-bumping must happen *after* any post action bumps the thread
            switch ( bump_value ) {
            case 'bump':
                if ( !has_post ) {
                    // bumping is redundant if you reply to a thread
                    actions.push( new Action(
                        'bump thread',
                        {
                            fire: function(keys) { return args.bb.thread_bump(args.thread_id) },
                            description: function() {
                                return [{ type: 'bump thread', target: edit_target }];
                            }
                        }
                    ));
                }
                break;
            case 'debump':
                var debump_action = new Action(
                    'debump thread',
                    {
                        fire: function(keys) { return args.bb.thread_debump(args.thread_id) },
                        description: function() {
                            return [{ type: 'debump thread', target: edit_target }];
                        }
                    }
                );
                if ( has_post )
                    actions[actions.length-1].then( debump_action );
                else
                    actions.push(debump_action);
                break;
            case '': // nothing to do
            }

        }

        if ( has_pm   ) policy.default_keys[7].value.push('PM');
        if ( has_post ) policy.default_keys[7].value.push('reply');

        policy.default_keys[7].value = policy.default_keys[7].value.join('; ');

        if ( macro_defaults.template && policy.check( [ 'macro' ].concat(variable_suffix) ) ) {

            var macro_values = { template: macro_defaults.template };

            switch ( status_widget.val() ) {
            case 'closed temporarily':
                var deadline = status_widget.find('option:selected').data('deadline');
                if ( (macro_defaults.deadline||'') != deadline ) {
                    macro_values.status = 'closed temporarily';
                    macro_values.deadline = deadline;
                }
                break;
            case 'merged':
                var target_thread_id = title_widget.val().target_thread_id;
                if ( (macro_defaults.target_thread_id||NaN) != target_thread_id ) {
                    macro_values.status = 'merged';
                    macro_values.target_thread_id = target_thread_id;
                }
            case macro_defaults.status:
                break;
            default:
                macro_values.status = status_widget.val();
            }

            if ( macro_defaults. forum_id !=   forum_widget.val()      ) macro_values.forum_id = parseInt( forum_widget.val(), 10 );
            if ( macro_defaults.prefix_id != (prefix_widget.val()||'') ) macro_values.prefix_id = prefix_widget.val()||'';
            if ( macro_defaults.  icon    !=    icon_widget.getSelectedIndex() && forum_has_icons )
                macro_values.icon = icon_widget.getSelectedIndex();


            if ( macro_defaults.has_pm   != has_pm   ) macro_values.has_pm   = has_pm  ;
            if ( macro_defaults.has_post != has_post ) macro_values.has_post = has_post;

            if ( Object.keys(macro_values).length > 1 ) {
                actions.push(new Action( 'register macro', {
                    fire: function(keys) {
                        macro_values.name = policy.resolve( [ 'macro' ].concat(variable_suffix), keys );
                        return recent_macros.push(macro_values);
                    }
                }));
            }

        }

        if ( actions.length ) {

            args.callback(
                new Action(
                    'root action',
                    // this has to be split out from the notification actions because they're performed with the mod team account:
                    new Action( policy._namespace + ' wrapper', actions ).then(new Action( 'add usernote', {
                        fire: function(keys) {
                            var return_keys = {};
                            if ( !keys.hasOwnProperty(  'pm result') ) return_keys[  'pm result'] = 'no action';
                            if ( !keys.hasOwnProperty('post result') ) return_keys['post result'] = 'no action';
                            $.extend( keys, return_keys );
                            return args.bb.usernote_add(
                                thread_creator.user_id,
                                policy.resolve( 'combined note title' , keys ),
                                policy.resolve( 'combined note bbcode', keys )
                            ).then(function() {
                                if ( keys['notification error' ] == 'fail' ) {
                                    return $.Deferred()
                                        .reject('Notification failed, but the error was postponed so we could add a usernote:\n' + error)
                                        .promise();
                                } else {
                                    return { keys: return_keys };
                                }
                            });
                        },
                        description: function() {
                            return [{ type: 'usernote', target: thread_creator }];
                        }
                    }))
                ),
                'manage [thread=' + args.thread_id + ']' + args.thread_desc + '[/thread]',
                has_post, has_pm,
                status_widget.val() == 'merged' && sender_selector.find('input:checked').val() == 'personal'
            );

        } else {
            args.callback( null, '', has_post, has_pm );
        }

    }

    var cb_timeout, callback = (
        args.callback
        ? function() {
            if ( cb_timeout ) clearTimeout(cb_timeout);
            cb_timeout = setTimeout(callback_timeout, 0 );
        }
        : function() {}
    );

    /*
     * INITIALISE WIDGETS
     */

    var was_merged = false;
    var status_widget = $(
        '<select title="set the thread status">' +
            '<option title="open the thread to replies from ordinary users" value="open">Open: </option>' +

            this.resolve( 'close periods', {}, 'array of items' ).map(function(period) {
                period = period.value.split(/\s*:\s*/, 2 );
                return '<option title="close the thread and make a note to reopen it" value="closed temporarily" data-deadline="' + period[0] + '">' + period[1] + ': </options>';
            }).join('') +
            '<option title="permanently close the thread" value="closed" data-deadline="permanent">Closed: </option>' +

            '<option title="merge this with the specified thread" value="merged">Merged with: </option>' +
            '<option title="unapprove this thread" value="moderated">Moderated: </option>' +
            '<option title="(soft-)delete this thread" value="deleted">Deleted: </option>' +
        '</select>'
    )
        .appendTo(args.status_args.container)
        .change(function() {
            if ( this.value == 'merged' ) {
                 forum_widget              .prop( 'disabled', true );
                prefix_widget              .prop( 'disabled', true );
                bump_selector.find('input').prop( 'disabled', true );
                title_widget.val({ mode: 'merge', target_thread_id: null, target_thread_desc: '' });
                title_widget.focus();
                $('#mod-friend-thread-metadata-icons').addClass('disabled');
                was_merged = true;
            } else {
                if ( was_merged ) {
                     forum_widget              .prop( 'disabled', false );
                    status_widget              .prop( 'disabled', false );
                    bump_selector.find('input').prop( 'disabled', false );
                    $('#mod-friend-thread-metadata-icons').removeClass('disabled');
                    title_widget.val({ mode: 'edit', target_thread_id: args.thread_id });
                    forum_widget.val(metadata.forum_id);
                    if ( metadata.prefixes.length ) {
                        prefix_widget.empty().show().append(metadata.prefixes.map(function(option) {
                            return $('<option>').val(option.prefix_id).text(option.text).prop( 'checked', option.checked );
                        }));
                    } else {
                        prefix_widget.empty().hide();
                    }
                }
            }
            callback();
        });

    args.icon_args.container.append('<span title="specify the thread icon" id="mod-friend-thread-metadata-icons"></span>' );
    var icon_widget = new IconSelect('mod-friend-thread-metadata-icons', {
        selectedIconWidth: 16,
        selectedIconHeight: 16,
        iconsWidth: 16,
        iconsHeight: 16,
        boxIconSpace: 0,
        vectoralIconNumber: 3,
        horizontalIconNumber: 5
    });

    var prefix_widget = $('<select title="specify the thread prefix"></select>').appendTo(args.prefix_args.container).hide();
    prefix_widget.change(function() {
        policy.default_keys[4].value = $( ':selected', this ).text();
        callback();
    });

    var prev_title_thread_id = args.thread_id;
    var title_widget = new ThreadTitleSelector($.extend({}, args, args.title_args, {
        mode: 'edit',
        callback: function(thread) {
            if ( !forum_widget ) return; // skip during creation
            if ( thread ) {
                policy.default_keys[1].value = thread;
                if ( prev_title_thread_id != thread.thread_id ) {
                    prev_title_thread_id = thread.thread_id;
                    forum_widget.val( thread.forum_id ).change();
                }
            } else {
                policy.default_keys[1].value = { thread_id: args.thread_id, thread_desc: args.thread_desc, forum_id: args.forum_id };
                forum_widget.val( args.forum_id ).change();
            }
            callback();
        }
    }));

    var forum_widget = $('<select title="move this thread to another forum" required><option value="">Please select a forum...</option></select>').appendTo(args.forum_args.container);
    var forum_metadata = {}, stored_prefixes = {}, old_forum_id;
    forum_widget.change(function() {
        if ( !this.value ) return;
        policy.default_keys[3].value.forum_id   = this.value;
        policy.default_keys[3].value.forum_desc = $( ':selected', this ).text().replace( /^\s+/, '' );
        var old_prefix = stored_prefixes[old_forum_id] = prefix_widget.val();
        var stored_prefix = stored_prefixes[this.value];
        old_forum_id = this.value;
        if ( !forum_metadata[this.value] ) forum_metadata[this.value] = args.bb.forum_metadata(this.value);
        forum_metadata[this.value].then(function(forum_metadata) {
            metadata = forum_metadata;
            if ( forum_has_icons ) {
                forum_has_icons = forum_metadata.icons.length;
                if ( !forum_has_icons )
                    $('#mod-friend-thread-metadata-icons').hide();
            } else {
                forum_has_icons = forum_metadata.icons.length;
                if ( forum_has_icons ) {
                    var default_icon;
                    icon_widget.refresh(
                        forum_metadata.icons.map(function(icon, index) {
                            if ( !icon.file ) default_icon = index;
                            return {
                                'iconFilePath': icon.file || 'data:image/gif;base64,R0lGODlhEAAQAIAAAP///////yH5BAEKAAEALAAAAAAQABAAAAIOjI+py+0Po5y02ouzPgUAOw==',
                                'iconValue': icon.icon_id
                            };
                        })
                    );
                    icon_widget.setSelectedIndex( ( original.icon == -1 ) ? default_icon : original.icon );
                    $('#mod-friend-thread-metadata-icons').show();
                }
            }

            if ( forum_metadata.prefixes.length ) {
                var has_old_prefix, has_stored_prefix;
                prefix_widget.show().empty().append(forum_metadata.prefixes.map(function(option) {
                    if (    old_prefix && option.prefix_id ==    old_prefix ) has_old_prefix    = true;
                    if ( stored_prefix && option.prefix_id == stored_prefix ) has_stored_prefix = true;
                    return $('<option>').val(option.prefix_id).text(option.text);
                })).val(
                    has_old_prefix    ?    old_prefix :
                    has_stored_prefix ? stored_prefix :
                    ''
                );
                macro_defaults.prefix_id = prefix_widget.val()||'';
            } else {
                prefix_widget.empty().hide();
            }
            callback();
        });
    });

    var post = new NotificationSelector(this.notification_selector_args(
        { html: 'post', type: 'post' },
        args.post_selector_args,
        { known_keys: ['list of posts in merged thread'], key_prefix: 'post ' }
    ));

    var pm = new NotificationSelector(this.notification_selector_args(
        { html: 'PM', type: 'PM' },
        args.pm_selector_args,
        { known_keys: ['list of posts in merged thread'], key_prefix: 'pm ' }
    ));

    var message_selector = $(
        '<div>' +
            '<label title="post a new reply in this thread"><input type="checkbox" name="post">post to thread</label>' +
            '<label><input type="checkbox" name="pm">PM the thread creator</label>' +
        '</div>'
    ).appendTo(args.message_selector_args.container);
    message_selector.find('input').change(callback)
        .last().parent().attr( 'title', 'send a private message to ' + thread_creator.username );

    var sender_selector = $(
        '<div>' +
            '<label title="more official, protects your privacy"><input type="radio" value="team" name="sender" checked>send from mod team account</label>' +
            '<label title="more individual, can ease tensions"><input type="radio" value="personal" name="sender">send from personal account</label>' +
        '</div>'
    ).appendTo(args.sender_selector_args.container);
    sender_selector.find('input').change(function() {
        if ( this.checked == (this.value == 'team' ) )
            post.bb = pm.bb = args.mod_team_bb;
        else
            post.bb = pm.bb = args.bb;
    }).filter(':checked').change();

    var bump_selector = $(
        '<div>' +
            '<label title="push this thread up to the top of the listings"><input type="radio" name="bump" value="bump">bump thread</label>' +
            '<label><input type="radio" name="bump" checked>no bump</label>' +
            '<label title="hide this thread far down in the listings"><input type="radio" name="bump" value="debump">de-bump thread</label>' +
        '</div>'
    ).appendTo(args.bump_selector_args.container);
    bump_selector.find('input').change(callback);

    var template_selector = $(
        '<select title="select a template reply or specify actions by hand" name="response_template"><option value="No template">Please choose a template...</option></select>'
    ).appendTo(args.template_selector_args.container);

    var seen_macros = {};
    var macros_to_insert = recent_macros.get().reverse().filter(function(macro) {
        if ( seen_macros.hasOwnProperty(macro.name) ) return false;
        seen_macros[macro.name] = true;
        return true;
    });
    if ( macros_to_insert.length ) {
        $('<optgroup>').attr( 'label', 'Recent' )
            .appendTo(template_selector)
            .append(
                macros_to_insert.map(function(macro) {
                    return $('<option>')
                        .text (macro.name)
                        .val  (macro.template)
                        .attr( 'title', policy.resolve(['hint',macro.template]) )
                        .data( 'macro', macro )
                })
            );
    }
    template_selector.append(

        this.resolve( 'visible templates', {}, 'array of items' ).map(function(templates) {
            templates = templates.value.split( /\s*[:,]\s*/g );
            var name = templates.shift();
            var optgroup = $('<optgroup>').attr( 'label', name );
            optgroup.append( templates.map(function(t) {
                return $('<option>')
                    .text(t)
                    .val (t)
                    .attr( 'title', policy.resolve(['hint',t]) )
            }) );
            return optgroup;
        })

    ).change(function() {

        /*
         * Update everything based on the new template
         */

        policy.default_keys[policy.default_keys.length-1].value
            = variable_suffix[0]
            = action_data.template
            = $(this).val();

        title_widget.val(original.title);

        if        ( policy.check( [ 'new thread id' ].concat(variable_suffix) ) ) {
            status_widget.val( 'merged' ).change();
            title_widget.val({
                target_thread_id: parseInt( policy.resolve([ 'new thread id' ].concat(variable_suffix)).toLowerCase(), 10 )
            });
        } else if ( policy.check( [ 'deadline' ].concat(variable_suffix) ) ) {
            var deadline = policy.resolve([ 'deadline' ].concat(variable_suffix)).toLowerCase();
            status_widget.find('option')
                .prop( 'selected', false )
                .filter(function() { return $(this).data('deadline') == deadline })
                .prop( 'selected', true )
                .change()
            ;
        } else if ( policy.check( [ 'new status' ].concat(variable_suffix) ) ) {
            status_widget.val( policy.resolve([ 'new status' ].concat(variable_suffix)).toLowerCase() ).change();
        } else {
            status_widget.val( original.status ).change();
        }

        if ( policy.check( [ 'new thread title' ].concat(variable_suffix) ) ) {
            title_widget.val({
                target_thread_id  : args.thread_id,
                target_thread_desc: policy.resolve( [ 'new thread title' ].concat(variable_suffix), { 'old thread title': args.thread_desc } ),
                target_forum_id   : args.forum_id,
            });
        }

        if ( policy.check( [ 'new icon' ].concat(variable_suffix) ) ) {
            var icon_name = policy.resolve( [ 'new icon' ].concat(variable_suffix) );
            metadata.icons.map(function(icon, index) {
                if ( icon.name == icon_name ) icon_widget.setSelectedIndex(index);
            });
        } else if ( forum_has_icons ) {
            if ( original.icon == -1 ) {
            metadata.icons.map(function(icon, index) {
                if ( !icon.file ) icon_widget.setSelectedIndex(index);
            });
            } else {
                icon_widget.setSelectedIndex(original.icon);
            }
        }

        if ( policy.check( [ 'new forum' ].concat(variable_suffix) ) ) {
            var new_forum = policy.resolve( [ 'new forum' ].concat(variable_suffix) ).toLowerCase();
            forum_widget.find('option')
                .prop( 'selected', false )
                .filter(function() { return this.textContent.toLowerCase() == new_forum })
                .prop( 'selected', true )
            ;
        } else {
            forum_widget.val( original.forum_id );
        }
        forum_widget.change();

        if ( policy.check( [ 'new prefix' ].concat(variable_suffix) ) ) {
            var new_prefix = policy.resolve( [ 'new prefix' ].concat(variable_suffix) );
            prefix_widget.find('option')
                .prop( 'selected', false )
                .filter(function() { return this.textContent.toLowerCase() == new_prefix })
                .prop( 'selected', true )
            ;
        } else {
            prefix_widget.val( original.prefix );
        }
        prefix_widget.change();

        message_selector.find('[name="post"]').prop( 'checked', policy.check( [ 'post bbcode' ].concat(variable_suffix) ) );
        post.val( policy.notification_selector_args({ html: 'post', type: 'post' }) );

        message_selector.find('[name="pm"]'  ).prop( 'checked', policy.check( [   'pm bbcode' ].concat(variable_suffix) ) );
        pm  .val( policy.notification_selector_args({ html: 'PM', type: 'PM' }) );

        // record macro defaults even if this action came from a macro, so frequent actions are frequently updated:
        macro_defaults = {
            template: variable_suffix[0],
              status: status_widget.val(),
            deadline: status_widget.find('option:selected').data('deadline') || '',
            has_post: message_selector.find('[name="post"]').prop( 'checked' ),
            has_pm  : message_selector.find('[name="pm"]'  ).prop( 'checked' ),

                     icon   :   forum_has_icons ? icon_widget.getSelectedIndex() : -1,
                    forum_id:  forum_widget.find('option:selected').val() || '',
                   prefix_id: prefix_widget.val()||'',
            target_thread_id:  title_widget.val().target_thread_id || NaN
        };

        var macro = $( 'option:selected', this ).data( 'macro' );
        if ( macro ) {

            switch ( macro.status ) {
            case undefined: break;
            case 'closed temporarily':
                status_widget.find('option')
                    .prop( 'selected', false )
                    .filter(function() { return $(this).data('deadline') == macro.deadline })
                    .prop( 'selected', true )
                ;
                status_widget.change();
                title_widget.val({ mode: 'edit' });
                break;
            case 'merged':
                status_widget.val('merged').change();
                title_widget.val({ mode: 'merge', target_thread_id: macro.target_thread_id });
                break;
            default:
                title_widget.val({ mode: 'edit' });
                status_widget.val( macro[status] ).change();
            }

            if ( macro.hasOwnProperty('icon'    ) ) icon_widget.setSelectedIndex( macro.icon );
            if ( macro.hasOwnProperty('has_pm'  ) ) message_selector.find('[name="pm"]'  ).prop('checked', macro.has_pm  ).change();
            if ( macro.hasOwnProperty('has_post') ) message_selector.find('[name="post"]').prop('checked', macro.has_post).change();

            if ( macro.hasOwnProperty('prefix_id') ) {
                if ( macro.hasOwnProperty('forum_id') ) {
                    forum_widget.val(macro.forum_id);
                    forum_metadata[macro.forum_id].then(function() {
                        prefix_widget.val(macro.prefix_id).change();
                    });
                } else {
                    prefix_widget.val(macro.prefix_id).change();
                }
            } else if ( macro.hasOwnProperty('forum_id') ) {
                forum_widget.val(macro.forum_id).change();
            }

        }

        callback();

    });

    /*
     * Download information and initialise a few last things
     */

    this.promise = $.when(
        args.bb.thread_metadata(args.thread_id),
        args.bb.forums()
    ).then(function(_metadata, forums) {

        metadata = _metadata;

        status_widget.val(
            metadata.deleted   ? 'deleted'   :
            metadata.moderated ? 'moderated' :
            metadata.open      ? 'open'      :
                                 'closed'
        );

        var selected_index;
        forum_has_icons = metadata.icons.length;
        if ( forum_has_icons ) {
            icon_widget.refresh(
                metadata.icons.map(function(icon, index) {
                    if ( icon.icon_id == metadata.icon_id ) selected_index = index;
                    return {
                        'iconFilePath': icon.file || 'data:image/gif;base64,R0lGODlhEAAQAIAAAP///////yH5BAEKAAEALAAAAAAQABAAAAIOjI+py+0Po5y02ouzPgUAOw==',
                        'iconValue': icon.icon_id
                    };
                })
            );
            icon_widget.setSelectedIndex(selected_index);
            $('#mod-friend-thread-metadata-icons').show();
        } else {
            $('#mod-friend-thread-metadata-icons').hide();
        }
        $('#mod-friend-thread-metadata-icons').on( 'changed', function() {
            policy.default_keys[5].value = (
                                          metadata.icons[icon_widget.getSelectedIndex()].file
                ? location.origin + '/' + metadata.icons[icon_widget.getSelectedIndex()].file
                : 'data:image/gif;base64,R0lGODlhEAAQAIAAAP///////yH5BAEKAAEALAAAAAAQABAAAAIOjI+py+0Po5y02ouzPgUAOw=='
            );
            callback();
        });

        if ( metadata.prefixes.length ) {
            prefix_widget
                .show()
                .empty()
                .append(metadata.prefixes.map(function(option) { return $('<option>').val(option.prefix_id).text(option.text) }))
                .val( metadata.prefix_id );
        }

        (function build_forums(options, prefix, optgroup) {
            options.forEach(function(option) {
                if ( option.forum_id ) {
                    var node = $('<option>').val(option.forum_id);
                    if ( option.forum_id == args.forum_id )
                        node.text(prefix + option.name + ' (current forum)').addClass('current-forum');
                    else
                        node.text(prefix + option.name);
                    optgroup.append( node );
                    if ( option.children )
                        build_forums( option.children, prefix + '\xA0\xA0\xA0\xA0', optgroup );
                } else if ( option.children ) {
                    build_forums( option.children, prefix, $('<optgroup>').attr( 'label', prefix + option.name ).appendTo(forum_widget) );
                }
            });
        })( forums, '', forum_widget );
        old_forum_id = metadata.forum[metadata.forum.length-1].forum_id;
        forum_widget.val( metadata.forum[metadata.forum.length-1].forum_id );

        original = action_data.original = {
            thread_id: args.thread_id,
            status   : status_widget.val(),
            title    : $.extend( {}, title_widget.val() ),
            forum_id : parseInt( forum_widget.val(), 10 ),
            prefix   : prefix_widget.val() || '',
            icon     : icon_widget.getSelectedIndex(),
            icon_id  : forum_has_icons ? icon_widget.getSelectedValue() : undefined,
        };

        unmerge_data = {
             forum_id: original.forum_id,
            thread_id: args.thread_id,
            title    : original.title.thread_desc,
              icon_id: original.icon_id,
            prefix   : original.prefix,
            status   : original.status,
                close_thread: metadata.open      ? undefined : true,
               delete_thread: metadata.deleted   ? true : undefined,
            unapprove_thread: metadata.moderated ? true : undefined,

            delete_reason: metadata.delete_reason,
            notes        : metadata.notes,
        };

        template_selector.change();

    });

}
ThreadManagementPolicy.prototype = Object.create(Policy.prototype, {
    _namespace: { writable: false, configurable: false, value: 'thread management' },
});
ThreadManagementPolicy.prototype.constructor = ThreadManagementPolicy;

/**
 * @summary build an action to unmerge a thread
 * @param {BulletinBoard} bb           Bulletin Board to manipulate
 * @param {BulletinBoard} mod_team_bb  Bulletin Board to manipulate
 * @param {Variables}     v            Variables to use
 * @param {Object}        unmerge_data 'merge data' created during merging
 * @return {Action}
 */
ThreadManagementPolicy.prototype.unmerge_action = function(bb, mod_team_bb, v, unmerge_data) {

    var merge_log = v.resolve('frequently used posts/threads', 'merge log'), merge_post_id;

    return new Action(
        'root action',
        new Action(
            'unmerge wrapper',

            new Action( 'create thread', {
                fire: function(keys) {
                    return mod_team_bb.thread_create($.extend(
                        {
                            bbcode: v.resolve('thread management', 'unmerge notification bbcode', $.extend( keys, unmerge_data.source_thread ) ),
                        },
                        unmerge_data.source_thread
                    )).then(function(new_thread_id) {
                        unmerge_data.source_thread.thread_id = new_thread_id;
                        return { keys: {
                            'new thread id': new_thread_id,
                            'old thread title with link': '[thread=' + new_thread_id + ']' + keys['old thread title'] + '[/thread]'
                        }};
                    });
                },
                description: function() {
                    return [{ type: 'create thread', target: unmerge_data.source_thread }];
                }
            }).then(
                new Action( 'move posts', {
                    fire: function(keys) {
                        return bb.posts_move( keys['new thread id'], unmerge_data.posts );
                    },
                    description: function() {
                        return [{ type: 'move posts', target: { thread: unmerge_data.source_thread, posts: unmerge_data.posts } }];
                    }
                }),
                new Action( 'post to merge log', {
                    fire: function(keys) {
                        return bb.thread_reply({
                            thread_id: merge_log,
                            title    : v.resolve('thread management', 'unmerge title' , keys),
                            bbcode   : v.resolve('thread management', 'unmerge bbcode', keys),
                        }).then(function(post_id) {
                            merge_post_id = post_id;
                        });
                    },
                    description: function() {
                        return [
                            {
                                type: 'post',
                                target: {
                                    thread_desc: 'the merge log',
                                    thread_id  : merge_log,
                                    post_id    : merge_post_id
                                }
                            },
                        ];
                    }
                }),
                ( unmerge_data.source_thread.delete_thread || unmerge_data.source_thread.unapprove_thread ) ? new Action( 'change thread status', {
                    fire: function(keys) {
                        return bb.thread_edit(unmerge_data.source_thread)
                    },
                    description: function() {
                        return [{ type: 'change thread status', target: unmerge_data.source_thread }];
                    }
                }) : undefined
            )

        ).then(
            unmerge_data.thread_creator
            ? new Action( 'add usernote', {
                fire: function(keys) {
                    var return_keys = {};
                    if ( !keys.hasOwnProperty(  'pm result') ) return_keys[  'pm result'] = 'no action';
                    if ( !keys.hasOwnProperty('post result') ) return_keys['post result'] = 'no action';
                    $.extend( keys, return_keys );
                    return args.bb.usernote_add(
                        thread_creator.user_id,
                        policy.resolve( 'combined note title' , keys ),
                        policy.resolve( 'combined note bbcode', keys )
                    ).then(function() {
                        if ( keys['notification error' ] == 'fail' ) {
                            return $.Deferred()
                                .reject('Notification failed, but the error was postponed so we could add a usernote:\n' + error)
                                .promise();
                        } else {
                            return { keys: return_keys };
                        }
                    });
                },
                description: function() {
                    return [{ type: 'usernote', target: thread_creator }];
                }
            })
            : new Action( 'fix results', {
                fire: function(keys) {
                    var return_keys = {};
                    if ( !keys.hasOwnProperty(  'pm result') ) return_keys[  'pm result'] = 'no action';
                    if ( !keys.hasOwnProperty('post result') ) return_keys['post result'] = 'no action';
                    return { keys: return_keys };
                }
            })
        )
    );

}
