/**
 * @file Main section for Frontier Forums Moderation Tools
 * @author Andrew Sayers
 */

/*
 * HANDLER SECTIONS
 *
 * The next few blocks handle discrete chunks of the extension process.  They generally look like:
 *
 * function handle_foo( bb, v, ... ) { BabelExt.utils.dispatch( // arguments are bulletin board, variables and anything else needed
 *     { // actions are dispatched on pages that match the criteria
 *         match_pathname: '...',
 *         match_elements: [ ... ],
 *         callback: function(stash, pathname, params) {
 *             // performs the actions relevant to the page
 *         }
 *     },
 *     ... // more actions to dispatch in different circumstances
 * )}
 *
 * They're followed by a main block that initialised the extension then calls each handler in turn.
 *
 */

/**
 * @summary Handle the dashboard page
 * @param {BulletinBoard}      bb Bulletin Board to manipulate
 * @param {Variables}          v  Variables to use
 * @param {Violations}         vi Violations to use
 * @param {SharedStore}        ss Shared Store to use
 * @param {MiscellaneousCache} mc Miscellaneous Cache to use
 * @param {string}        loading_html HTML to show while loading
 */
function handle_dashboard( bb, v, vi, ss, mc, loading_html ) { BabelExt.utils.dispatch(

    {
        match_pathname: '/',
        match_params: {
            do: 'dashboard',
        },
        match_elements: '.welcomelink a',
        pass_preferences: [ 'language' ],
        callback: function( stash, pathname, params, welcome_link, user_language ) {

            stash.intro = stash.newbies = $('<div>'); // placeholder, will be filled in later

            ss.change(function(data) {
                stash.intro.data( 'min_thread_id', data.intro_forum_thread_id+1 );
                stash.newbies.data( 'min_user_id', data.newbie_policy_base_user_id );
            });

            stash.au = new AvailableUsers({
                ss: ss,
                bb: bb,
                language: user_language
            });
            stash.au.active(true);
        }
    },

    {
        match_pathname: '/',
        match_params: {
            do: 'dashboard',
        },
        match_elements: '.below_body',
        pass_storage: ['dashboard_cache', 'dashboard-newbie-actions'],
        callback: function( stash, pathname, params, below_body, dashboard_cache, dashboard_newbie_actions ) { stash.au.promise.then(function() {

            // Dashboard CSS
            bb.css_add([ 'user_show', 'forum_show', 'thread_show', 'activity', 'folder_show' ]);
            $("head").append(
                "<style type='text/css'>" +
                v.parse( BabelExt.resources.get('res/main.css'), bb.css_keys() ) +
                "</style>"
            );

            // Because of an obscure legacy DNS feature, you can append a '.' to a domain and connect to the same server
            // this is treated as a different server for cookie purposes, allowing us to manage a second account:
            var mod_team_bb = new VBulletin({ origin: location.origin + '.' });

            var dashboard = $(BabelExt.resources.get('res/dashboard.html'));

            var recently_reported_posts = {};
            var name = $('.welcomelink a').text();

            var mod_log_thread_id = v.resolve('frequently used posts/threads', 'mod log');
            var report_forum_id = 48;
            var introductions_forum_id = 16;
            dashboard.find( '[data-thread="mod-log"]'              ).data( 'thread', mod_log_thread_id );
            dashboard.find( 'a[href="#insert-mod-log-link"]'       ).attr( 'href'  , bb.url_for.thread_show({ thread_id: mod_log_thread_id, goto: 'newpost' }) );
            dashboard.find( '[data-forum="reported-posts"]'        ).data( 'forum' , report_forum_id );
            dashboard.find( 'a[href="#insert-reported-posts-link"]').attr( 'href'  , bb.url_for.forum_show({ forum_id: report_forum_id }) );
            dashboard.find( '[data-forum="introductions"]'         ).data( 'forum' , introductions_forum_id );
            dashboard.find( 'a[href="#insert-introductions-link"]' ).attr( 'href'  , bb.url_for.forum_show({ forum_id: introductions_forum_id }) );
            dashboard.find( 'a[href="#insert-mod-queue-link"]'     ).attr( 'href'  , bb.url_for.moderation_posts() );
            dashboard.find( 'a[href="#insert-newbies-link"]'       ).attr( 'href'  , bb.url_for.users_show() );
            dashboard.find( 'a[href="#insert-activity-link"]'      ).attr( 'href'  , bb.url_for.activity() );
            dashboard.find( 'a[href="#insert-inbox-link"]'         ).attr( 'href'  , bb.url_for.folder_show({folder_id: 0}) );
            // #insert-mod-team-inbox-link is handled later, once we know the mod team's login details


            function progress_bar(button, promise, complete_message) {
                var progress_bar = $(button).parent().addClass('mod-friend-progressing').find('.mod-friend-percent').css({ width: 0 });
                return promise
                    .progress(function(percent) {
                        progress_bar.css({ width: percent + '%' });
                    })
                    .always(function() {
                        progress_bar.closest('.mod-friend-progressing').removeClass('mod-friend-progressing');
                    })
                    .done(function() {
                        $(button)
                            .prop( 'disabled', true ).val( complete_message )
                            .closest('.dashboard-section').data( 'empty' )();
                    })
                ;
            }

            /*
             * REPORTED POSTS FORUM
             */
            dashboard.find('[data-forum="reported-posts"]').data( 'filter', function(threads) {

                return threads.filter(function(thread) {
                    if ( thread.is_sticky || thread.status != 'open' ) return false;

                    // modify the container elements to make moderation easier
                    $('.threadimod', thread.container_element).remove();

                    $( '.threadstatus', this )
                        .css({ cursor: 'pointer' })
                        .attr( 'title', 'double-click to close this thread' )
                        .dblclick(function() {
                            var threadbit = $(this).closest('.threadbit');
                            bb.thread_openclose( thread.thread_id, $(this).closest('.threadbit').hasClass('lock') )
                                .done(function() { threadbit.toggleClass('lock') });
                        });

                    var report = new Report({ v: v, bb: bb, thread_id: thread.thread_id, title: thread.title })

                    recently_reported_posts['#post_'+report.target_post_id] = report.target_thread_id;

                    if ( !report.assigned ) {
                        $('<a title="Click to take this thread" class="newcontent_textcontrol" rel="nofollow" href="newreply.php?t='+thread.thread_id+'&noquote=1" style="float:right">Take this report</a>')
                            .click(function(event) {
                                report.take( name, false );
                                event.preventDefault();
                            })
                            .insertAfter(thread.title_element);
                    }

                    return true;
                });

            });


            /*
             * INTRODUCTIONS FORUM
             */

            dashboard.find('[data-forum="introductions"]').data( 'filter', function(threads) {
                return threads.filter(function(thread) {
                    if ( thread.is_sticky || thread.status != 'open' ) return false;
                    $('.threadimod input', thread.container_element).prop( 'checked', true );
                    return true;
                });
            })
                .data( 'min_thread_id', stash.intro.data( 'min_thread_id' ) );
            stash.intro = dashboard.find('[data-forum="introductions"]');

            dashboard.find('[data-forum="introductions"] .blocksubfoot input').click(function() {

                var max_thread_id = 0; // populated when reply_action is built
                var min_thread_id; // populated when update_action is fired

                var reply_action = new Action(
                    'welcome newbies',
                    dashboard.find('[data-forum="introductions"] .threadimod input').map(function() {
                        var reply_keys = { 'thread starter': $(this).closest('.threadbit').find('.username').first().text() };
                        var thread_id = parseInt(this.id.substr(21),10);
                        if ( max_thread_id < thread_id ) max_thread_id = thread_id;
                        if ( $(this).is(':checked') ) return {
                            fire: function(keys) {
                                if ( thread_id > min_thread_id ) {
                                    return bb.thread_reply({
                                        thread_id: thread_id,
                                        title    : v.resolve('other templates', 'post title: welcome', reply_keys, 'string', introductions_forum_id),
                                        bbcode   : v.resolve('other templates',  'post body: welcome', reply_keys, 'string', introductions_forum_id)
                                    });
                                }
                            }
                        }
                    }).get()
                );

                var update_action = new Action(
                    'update shared store',
                    {
                        fire: function() {
                            return ss.transaction(function(data) {
                                min_thread_id = data.intro_forum_thread_id;
                                stash.intro.data( 'min_thread_id', max_thread_id+1 );
                                if ( data.intro_forum_thread_id != max_thread_id ) {
                                    data.intro_forum_thread_id = max_thread_id;
                                    return true
                                }
                            });
                        }
                    }
                );

                progress_bar(this, update_action.then(reply_action).fire(bb), 'welcomed!');

            });

            /*
             * MOD TEAM INBOX
             */
            dashboard.find( '.mod-team-inbox' )
                .data( 'bb', mod_team_bb )
                .data( 'filter', function(pms) {
                    pms.forEach(function(pm) {
                        pm.container_element.find('a.title').each(function() {
                            this.setAttribute( 'href', mod_team_bb.fix_url('/'+this.getAttribute('href')) );
                        });
                    });
                    return pms;
                });

            /*
             * ACTIVITY
             */
            dashboard.find('[data-monitor="activity"]').data( 'filter', function(posts) {
                return posts.filter(function(post) { return stash.au.is_ours(post.thread_id, v.get_language( post.thread_id, post.forum_id )) });
            });

            /*
             * NEWBIE LIST
             */

            var newbie_policy = new NewbiePolicy({
                v : v,
                bb: bb,
                vi: vi,
                ss: ss
            });

            var update_timer = null;
            function update_actions() {

                if ( update_timer !== null ) clearTimeout(update_timer);

                update_timer = setTimeout(function() {
                    update_timer = null;
                    var title = newbie_policy.set_actions(
                        dashboard.find('.dashboard-newbies [name="issue"]:checked').map(function() { return $(this).data('action') }).get()
                    );
                    dashboard.find('.dashboard-newbies-result input').prop( 'disabled', false ).val( title || 'Validate all users' );
                }, 100 );

            }

            dashboard.find('.dashboard-newbies .dashboard-body')
                .on( 'click', 'a.collapse', function(event) {
                    $(this).closest('.options_block').toggleClass('collapsed');
                    event.stopPropagation();
                    event.preventDefault();
                })
                .on( 'click', '[name="issue"]', function() { // update when user selects an action

                    var block = $(this).closest('.options_block');

                    if ( this.value == 'valid' )
                        block.toggleClass('collapsed');
                    else
                        block.removeClass('collapsed');

                    block
                        .removeClass('valid inappropriate dupe')
                        .addClass(this.value)
                    ;

                    /*
                     * Build blocks when the user actually clicks to see them.
                     * Building this at creation time would be incredibly slow.
                     */

                    if ( this.value == 'valid' && !block.hasClass('valid-built') ) {

                        var user = block.data('user');

                        var valid = block.find('.valid');
                        valid.find( '.username').text( user.username ).attr( 'href', bb.url_for.user_show({ user_id: user.user_id }) );
                        valid.find( '.search a' ).each(function() { this.href += encodeURIComponent(user.username) });

                        block.addClass('valid-built');

                    } else if ( this.value == 'inappropriate' && !block.hasClass('inappropriate-built') ) {

                        /*
                         * Initialise the inappropriate username block
                         */

                        function update_inappropriate() {
                            if ( !extra_post ) return; // ignore the callback during construction
                            block.find('[name="issue"][value="inappropriate"]')
                                .data( 'action', newbie_policy.action_inappropriate_wrapper( extra_post, notification.action(), user ));
                            update_actions();
                        }

                        var user = block.data('user');

                        var inappropriate = block.find('.inappropriate');
                        inappropriate.find( '.search .username' ).text( user.username );
                        inappropriate.find( '.search a' ).each(function() { this.href += encodeURIComponent(user.username) });
                        var notification = new NotificationSelector($.extend(
                            newbie_policy.notification_selector_inappropriate(undefined, user),
                            widget_args,
                            { container: inappropriate.find('.notification') }
                        ));
                        var extra_post = new ExtraPost($.extend(
                            newbie_policy.extra_post_inappropriate(undefined, user),
                            widget_args,
                            {
                                container: notification.extra_block(),
                                callback : update_inappropriate
                            }
                        ));
                        new SeveritySlider($.extend(
                            newbie_policy.severity_slider_inappropriate(),
                            widget_args,
                            {
                                container: inappropriate.find('.posthead'),
                                callback: function(level) {
                                    notification.val(newbie_policy.notification_selector_inappropriate( level, user ));
                                    extra_post.val(newbie_policy.extra_post_inappropriate(level, user));
                                    update_inappropriate();
                                }
                            }
                        ));
                        inappropriate.find('.notification').prepend( notification.mode_switcher() );

                        block.addClass('inappropriate-built');

                    } else if ( this.value == 'dupe' && !block.hasClass('dupe-built') ) {

                        /*
                         * Initialise the duplicate account block
                         */

                        var user = block.data('user');

                        var suspiciousness = newbie_policy.suspiciousness_duplicate(user);

                        var dupe_level, dupe_users = [{
                            username: user.username,
                            user_id : user.user_id,
                            email   : user.email,
                            notes   : user.summary,
                            is_primary: true,
                        }]
                            .concat(user.suspected_duplicates.map(function(user) {
                                return {
                                    username  : user.username,
                                    user_id   : user.user_id,
                                    email     : user.moderation_info.email,
                                    notes     : user.info.infraction_summary + ' ' + user.moderation_info.summary,
                                    is_banned : user.info.is_banned,
                                    is_primary: false
                                };
                            }));

                        var dupe = block.find('.dupe');
                        var dupe_action_container = dupe.find('.dupe-actions');

                        function update_dupe() {

                            var extra_post, user_actions = [];

                            dupe_action_container.empty().append(

                                dupe_users.map(function(user, index) {

                                    var element = $('<fieldset class="dupe-user-action"><legend></legend><div class="notification"></div></fieldset>');
                                    element.find('legend').text( 'User action: ' + user.username );

                                    var notification = new NotificationSelector($.extend(
                                        newbie_policy.notification_selector_duplicate(dupe_level, user, dupe_users, suspiciousness ),
                                        widget_args,
                                        { container: element.find('.notification') }
                                    ));

                                    if ( !index ) {
                                        extra_post = new ExtraPost($.extend(
                                            newbie_policy.extra_post_duplicate(suspiciousness, dupe_level, user, dupe_users),
                                            widget_args,
                                            {
                                                container: notification.extra_block(),
                                                callback : update_actions
                                            }
                                        ));
                                    }

                                    user_actions.push( notification.action() );
                                    element.find('.notification').prepend( notification.mode_switcher() );
                                    return element;
                                })
                            );

                            block.find('[name="issue"][value="dupe"]')
                                .data( 'action', newbie_policy.action_duplicate_wrapper( extra_post, user_actions, dupe_users ) );

                            update_actions();

                        };

                        new SeveritySlider($.extend(
                            newbie_policy.severity_slider_duplicate(suspiciousness),
                            widget_args,
                            {
                                container: dupe.find('.posthead'),
                                callback: function(level) {
                                    dupe_level = level;
                                    update_dupe();
                                }
                            }
                        ));
                        new DuplicateAccountList($.extend(
                            widget_args,
                            {
                                required: dupe_users.slice(0,1),
                                default : dupe_users.slice(1),
                                container: dupe.find('.dupes'),
                                callback: function(u) {
                                    dupe_users = u;
                                    update_dupe();
                                }
                            }
                        ));

                        block.addClass('dupe-built');

                    }

                    update_actions();

                })
            ;

            var min_user_id, max_user_id;

            dashboard.find('.dashboard-newbies .dashboard-newbies-result input').click(function() {
                progress_bar(this, newbie_policy.fire( min_user_id, max_user_id, dashboard.find( '.dashboard-newbies [name="extra-notes"]' ).val() ), 'validated!').then(function() {
                    stash.newbies.data( 'min_user_id', max_user_id );
                });
            });

            var widget_args = {
                v               : v,
                bb              : bb,
                violations      : vi,
                violation_groups: mc.violation_groups,
                loading_html    : loading_html,
            };

            dashboard.find('[data-monitor="newbies"]').data( 'min_user_id', stash.newbies.data('min_user_id') );
            stash.newbies = dashboard.find('[data-monitor="newbies"]');

            dashboard.find('[data-monitor="newbies"]').data( 'filter', function(users) {

                var previous_users = {};

                min_user_id = Infinity;
                max_user_id = 0;

                // Need to fire this after the elements have been inserted into the DOM:
                setTimeout(function() {
                    dashboard.find('[data-monitor="newbies"] time').timeago();
                    update_actions();
                }, 0 );

                return users.filter(function(user) {

                    if ( min_user_id > user.user_id ) min_user_id = user.user_id;
                    if ( max_user_id < user.user_id ) max_user_id = user.user_id;

                    /*
                     * Initialise the basic interface.
                     * Specific blocks are initialised if and when they become visible
                     */

                    user.element.data( 'username', user.username );
                    user.element.data( 'user_id', user.user_id );
                    user.element.data( 'user', user );

                    user.element.find('h4 .title').text( user.username );

                    if ( previous_users.hasOwnProperty(user.user_id) ) {
                        user.element.find('[name="issue"][value="valid"]').first().prop( 'checked', true );
                    } else if ( user.suspected_duplicates.length ) {
                        var element =
                            user.element.removeClass('collapsed')
                            .find('.valid')
                            .html('Suspected additional accounts for <a></a> &lt;<a></a>&gt;: <ul></ul><a href="">See IP address report for <span></span></a> (only finds users with overlapping post addresses)')
                        ;
                        var anchors = element.find('a');
                        anchors.eq(0)
                            .attr( 'href', bb.url_for.user_show({ user_id: user.user_id }) )
                            .text( user.username );
                        anchors.eq(1)
                            .attr( 'href', 'mailto:' + user.email )
                            .text( user.email );
                        anchors.eq(2)
                            .attr( 'href', bb.url_for.moderation_ipsearch({ username: user.username, depth: 2 }) )
                            .find('span').text( user.username );
                        var highlighter = new AccountHighlighter({ v: v, source_username: user.username, source_address: user.email });
                        element
                            .children('ul')
                            .append(
                                user.suspected_duplicates.map(function(user) {
                                    var element = $('<li><a></a> &lt;<a><span></span>@<span></span></a>&gt; <span></span></li>')
                                    element.find('a').first()
                                        .attr( 'href', bb.url_for.user_show({ user_id: user.user_id }) );
                                    var email_element = element.find('a').last()
                                        .attr( 'href', 'mailto:' + user.moderation_info.email );
                                    highlighter.highlight_to_element(
                                        user.username,
                                        user.moderation_info.email,
                                        element.find('a').first(),
                                        email_element.children().eq(0),
                                        email_element.children().eq(1)
                                    );
                                    element.children().last().html(
                                        user.info.infraction_summary + ' ' + user.moderation_info.summary
                                    );
                                    return element;
                                })
                            );
                        user.suspected_duplicates.forEach(function(user) { previous_users[user.user_id] = true });
                    }

                    previous_users[user.user_id] = true;

                    return true;

                });

            });


            /*
             * INITIALISE
             */

            // log in to ModCP before loading the dashboard (which will then keep us logged in)
            body_wrapper = $('.body_wrapper').html( '<iframe style="margin:auto"></iframe><iframe style="margin:auto"></iframe>' );
            $.when(
                bb.moderation_page( body_wrapper.find('iframe').first(), '/modcp/index.php?do=nav', '.navlink', '.navlink' ),
                mod_team_bb.login( body_wrapper.find('iframe').last(), 'Frontier Moderation Team' )
            ).then(function() {

                // delayed from the top of the function, because we need the mod team's session ID:
                dashboard.find( 'a[href="#insert-mod-team-inbox-link"]').attr( 'href'  , mod_team_bb.url_for.folder_show({folder_id: 0}) );

                document.title = 'Dashboard';
                body_wrapper.empty().append(dashboard);
                new Dashboard({
                    cache        : JSON.parse( dashboard_cache || '{}' ),
                    cache_updater: function(cache) { BabelExt.storage.set( 'dashboard_cache', JSON.stringify( cache ) ) },
                    container: body_wrapper,
                    interval : 60000,
                    bb       : bb,
                    v        : v
                });

            });

        })}
    },

    {
        match_elements: '#globalsearch',
        pass_storage: ['dashboard_cache'],
        callback: function( stash, pathname, params, below_body, dashboard_cache ) {
            // Add "Dashboard" link to nav tab on all pages
            $('<li><a class="navtab" href="/?do=dashboard">Dashboard</a></li>').appendTo('#navtabs');
        }
    }

)}

/**
 * @summary Handle variables threads
 * @param {BulletinBoard} bb Bulletin Board to manipulate
 * @param {Variables}     v  Variables to use
 */
function handle_variables_thread( bb, v ) { BabelExt.utils.dispatch(
    {
        match_pathname: '/showthread.php',
        match_elements: [ '#breadcrumb .navbit a[href="forumdisplay.php?f=70"]', '#below_postlist' ],
        callback: function(stash, pathname, params) {

            // edit the first post to explain what's going on, and to recommend bumping:
            var post = bb.post_create(
                'Message from the moderation tools...',
                'Moderation tools',
                'Browser extension',
                'How to edit a variables thread',
                BabelExt.resources.get('res/variables_thread_post.html')
            );
            post.find('a.newcontent_textcontrol').click(function(event) {
                bb.thread_bump(params.t).then(function() {
                    alert('thread bumped');
                });
                event.preventDefault();
            });
            $('#posts').prepend(post);

            // Refresh variables:
            v.refresh_thread(params.t, document.body)
                .then(function() { alert('The extension has refreshed the variables in this thread.\nReload any open pages to get the new values.') });

            // When a post is updated, refresh the thread and offer to bump it:
            bb.on_posts_modified(function(modifications) {
                if ( modifications.initialised.length ) {
                    v.refresh_thread(params.t, document.body)
                        .then(function() {
                            if ( confirm("The extension has refreshed the variables in this thread.\nWould you like to bump the thread so others can see the changes?") )
                                bb.thread_bump(params.t).then(function() {
                                    alert('thread bumped');
                                });
                        });
                }
            });

        }
    }
)}

/**
 * @summary Handle threads where a form should be provided to produce replies
 */
function handle_thread_form( bb, v, error_callback ) {
    function handle_form(editor, name, thread_id) {
        var post_var = new VariablesFromFirstPost({
            bb: bb,
            thread_id: thread_id,
            namespace: 'post',
            cache_updater: function() {},
            error_callback: error_callback
        });
        form_keys( bb, $(BabelExt.resources.get('res/' + name + '.html')).insertBefore(editor), function(keys) {
            post_var.promise.then(function() {
                bb.editor_set( post_var.resolve( 'post', 'recommended reply format', keys ) );
            });
            return false; // prevent form submission
        });
    }

    var dispatchers = [];
    [
        'Moderation Chase-Up Thread',
        'Account Merge Request Thread',
        'Name Change Request Thread'
    ].forEach(function(thread) {
        var thread_id = v.resolve( 'frequently used posts/threads', thread );
        BabelExt.utils.dispatch(
            {
                match_pathname: ['/newreply.php'],
                match_elements: [ '.description a[href="showthread.php?t=' + thread_id + '"]', '#vB_Editor_001' ],
                callback: function(stash, pathname, params, a, editor) { handle_form( editor, thread, thread_id ) }
            },
            {
                match_pathname: ['/showthread.php'],
                match_elements: [ 'link[rel="canonical"][href="showthread.php?t=' + thread_id + '"]', '#vB_Editor_QR' ],
                callback: function(stash, pathname, params, a, editor) { handle_form( editor, thread, thread_id ) }
            }
        );
    });

}

/**
 * @summary CC user notes to other users
 */
function handle_usernotes_cc( bb ) { BabelExt.utils.dispatch(
    {
        match_pathname: ['/usernote.php'],
        match_elements: ['#vB_Editor_001'],
        callback: function(stash, pathname, params, editor) {
            var cc = null;
            $(document.body).on( 'submit', '.vbform.block', function(event) {
                if ( cc ) {
                    var form = this, title = $('#titlefield').val(), bbcode = bb.editor_get();
                    $.when.apply( $, cc.map(function(user_id) { bb.usernote_add( user_id, title, bbcode ) }) ).then(function() {
                        cc = null;
                        $(form).submit();
                    });
                    event.preventDefault();
                }
            });
            form_keys( bb, $(BabelExt.resources.get('res/usernotes_cc.html')).insertBefore(editor), function(keys) {
                cc = keys[ 'cc values' ];
            });
        }
    }
)}

/**
 * @summary Handle "edit post" pages
 * @param {BulletinBoard} bb Bulletin Board to manipulate
 */
function handle_post_edit( bb ) { BabelExt.utils.dispatch(
    {
        match_pathname: ['/editpost.php'],
        match_elements: ['#deltype_soft'],
        callback: function(stash, pathname, params, button) {
            $(button).parent().css({ width: '400px' }).append( ' (recommended)' );
        }
    },

    {
        match_pathname: ['/showthread.php'],
        match_elements: [ '#below_postlist' ],
        callback: function(stash, pathname, params, button) {
            bb.on_posts_modified(function(modifications) {
                if ( modifications.edited.length ) {
                    $('#deltype_soft').click()
                        .parent().css({ width: '400px' }).append(' (recommended)');
                }
            });
        }
    }


)}

/**
 * @summary Handle moderation checkboxes
 * @description (so you can always tab through them, and hovering over tells you so)
 */
function handle_moderation_checkboxes() { BabelExt.utils.dispatch(
    {
        match_pathname: [ '/showthread.php', '/search.php', '/forumdisplay.php' ],
        callback: function(stash) {
            $(function() {
                $('.postimod,[name^=imodcheck]').attr( 'title', 'press tab then space to select the next item' );
                var highest_tab_index = Math.max.apply( Math, $('[tabindex]').map(function() { return parseInt( $(this).attr('tabindex'), 10 ) }).get() );
                $('.postimod').each(function() {
                    $(this).attr( 'tabindex', ++highest_tab_index );
                });
            });
        }
    }
)}

/**
 * @summary Handle "user" pages in ModCP
 */
function handle_modcp_user() { BabelExt.utils.dispatch(
    {
        match_pathname: '/modcp/user.php',
        match_params: {
            'do': 'viewuser'
        },
        match_elements: '.normal',
        callback: function(stash, pathname, params, normal) {
            $(normal).after( ' - <a href="/member.php?u='+params.u+'">go to member page</a> - <a href="/private.php?do=newpm&u=' + params.u + '">send PM</a>' );
        }
    }
)}

/**
 * @summary Make it possible to share IP search URLs
 */
function handle_modcp_doips( bb ) {
    BabelExt.utils.dispatch(
        { match_pathname: '/modcp/user.php', match_params: { do: 'doips', ipaddress: true , username: false }, callback: function(s, p, params) { bb.redirect_modcp_ipsearch(params) } },
        { match_pathname: '/modcp/user.php', match_params: { do: 'doips', ipaddress: false, username: true  }, callback: function(s, p, params) { bb.redirect_modcp_ipsearch(params) } }
    );
}

/**
 * @summary Link to Moderated Posts page from moderation links
 */
function handle_moderation_links() {
    $(function(){$('img[src="images/misc/moderated.gif"],img[src="images/misc/moderated_small.gif"]').wrap('<a href="/modcp/moderate.php?do=posts"></a>')});
}

/*
 * MAIN BLOCK (not run in iFrames)
 */
if (window.location == window.parent.location ) {
    // in the root window
    if ( location.hostname.search(/\.$/)==-1) BabelExt.utils.dispatch({ // initialise general stuff
        pass_storage    : ['variables', 'violations', 'misc'],
        pass_preferences: [ 'language', 'reload_interval' ],
        callback: function( stash, pathname, params, variables, violations, misc, user_language, reload_interval ) {

            var bb = new VBulletin();

            /*
             * ERROR HANDLER
             */
            var maintainer_user_id = 18617, maintainer_name = 'Andrew Sayers';

            var handle_error_box = $(BabelExt.resources.get('res/error_box.html'));
            $(function() {
                handle_error_box.appendTo(document.body);
                $('<a id="debug-log-show" href="#debug-log-show">(click here to show the moderators\' extension debug log)</a>')
                    .appendTo('#footer_morecopyright')
                    .before('<br>')
                    .click(function(event) {
                        debug_log.show();
                        $(this).hide();
                        event.preventDefault();
                    });
            });
            handle_error_box.find('a[href="#close-error-box"]').click(function(event) {
                handle_error_box.hide();
                event.preventDefault();
            });
            handle_error_box.find('a[href="#pm-maintainer"]').click(function(event) {
                bb.pm_send( maintainer_name, 'Debug log', debug_log.text() ).then(
                    function() {
                        alert("PM sent :)");
                    },
                    function() {
                        alert("Could not send message.  Please copy the text area at the bottom of the page to " + maintainer_name);
                    });
                event.preventDefault();
            });
            var previous_errors = {};

            function handle_error( message, resolutions ) {

                debug_log.log( message, resolutions )
                debug_log.show();
                $("#debug-log-show").hide();

                if ( !$.isArray(resolutions) ) resolutions = [resolutions];
                resolutions = resolutions.map(function(resolution) {
                    switch (resolution) {
                    case 'log in':
                        if ( bb.user_current() ) {
                            return { message: 'Contact the maintainer', href: '/private.php?do=newpm&u=' + maintainer_user_id };
                        } else {
                            return {
                                message: 'log in',
                                href   : bb.url_for.login(),
                            };
                        }
                    default: return resolution;
                    }
                });

                // ignore duplicate messages:
                if ( previous_errors[message] ) return;
                previous_errors[message] = true;

                var row = $('<tr><td><td style="padding-left: 1em"></tr>').appendTo(handle_error_box.find('tbody'));
                row.children('td').first().text( message );
                row.children('td'). last().html(
                    ( resolutions || [] ).map(function(resolution) {
                        return $('<a>').text( resolution.message ).attr( 'href', resolution.href );
                    })
                ).children(':not(:last-child)').after(', ');
                $(function() { handle_error_box.show() });

            }

            $( document ).ajaxError(function debug_ajax_errors( event, xhr, settings, error ) {
                var messages = [];
                try {
                    messages.push( error );
                    messages.push( settings );
                    messages.push( event );
                    messages.push( xhr.status );
                    messages.push( xhr.statusText );
                    messages.push( xhr.getAllResponseHeaders() );
                    messages.push( xhr.responseText );
                } catch (error) {  messages.push('caught error while adding values:', error); };
                debug_log.log.apply( debug_log, messages );
            });

            /*
             * GENERAL VARIABLES
             */

            var loading_img  = '<img src="images/misc/progress.gif" alt="loading, please wait">';
            var loading_html = loading_img + ' Loading';

            var next_week = new Date();
            next_week.setDate(next_week.getDate()+7);

            function cacheable_args(cache, name, args) {
                return $.extend({
                    bb             : bb,
                    cache          : JSON.parse( cache || '{}' ),
                    cache_updater  : function(cache) { BabelExt.storage.set( name, JSON.stringify( cache ) ) },
                    reload_interval: reload_interval * 1000,
                    error_callback : handle_error,
                }, args );
            }

            var v = new VariablesFromForum(cacheable_args( variables, 'variables', {
                forum_id        : 70,
                default_language: user_language,
                default_keys    : {
                    origin     : location.origin,
                    'next week': next_week.toUTCString().replace(/:[0-9][0-9] /, ' ' )
                }
            }));

            v.promise.then(function() { return handle_variables_thread( bb, v ) }).then(function() {

                var shared_store_note_id = v.resolve( 'policy', 'shared store note ID' );
                var ss = new SharedStore({
                    lock_url: v.resolve( 'policy', 'shared store lock URL' ),
                    store   : function(data) {
                        return bb.usernote_edit(
                            shared_store_note_id,
                            'Shared store for moderator actions - do not edit', "Do not edit this note.  It is managed automatically by the moderators' extension.\n\n" +
                            '[code]' + data + '[/code]'
                        );
                    },
                    retrieve: function() {
                        return bb.usernote_info(
                            shared_store_note_id
                        ).then(function(info) {
                            var ret = null;
                            info.bbcode.replace( /\[code\](.*)\[\/code\]$/, function(match,data) { ret = data });
                            return ret;
                        });
                    }
                });

                bb.config({
                    'unPMable user groups': v.resolve( 'policy', 'unpmable user groups', undefined, 'array of items' ).map(function(g) { return g.value }),
                    'default user group'  : v.resolve( 'policy', 'default user group' )
                });

                var vi = new Violations(cacheable_args( violations, 'violations', {
                    v: v,
                    default_user_action: 'warning',
                }));

                var mc = new MiscellaneousCache(cacheable_args( misc, 'misc', {
                    v : v,
                    vi: vi
                }));

                $.when( vi.promise, mc.promise ).then(function() {
                    handle_modcp_doips          ( bb );
                    handle_post_edit            ( bb );
                    handle_moderation_links     ();
                    handle_moderation_checkboxes();
                    handle_modcp_user           ();
                    handle_thread_form          ( bb, v, handle_error );
                    handle_usernotes_cc         ( bb, v );
                    handle_dashboard            ( bb, v, vi, ss, mc, loading_html );
                    handle_legacy               ( bb, v, vi, loading_html ); // everything that hasn't been refactored yet
                });

            });

        }

    })
} else {
    // in an iframe
    if ( location.origin == 'https://forums.frontier.co.uk.' )
        VBulletin.iframe_callbacks( 'https://forums.frontier.co.uk', [ '.frontier.co.uk.', 'frontier.co.uk.' ] );
    if ( location.origin == 'https://forumstest.frontier.co.uk.' )
        VBulletin.iframe_callbacks( 'https://forumstest.frontier.co.uk', [ '.frontier.co.uk.', 'frontier.co.uk.' ] );
}