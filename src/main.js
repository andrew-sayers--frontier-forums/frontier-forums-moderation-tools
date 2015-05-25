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
 * @summary Log in wherever we need to
 * @param {BulletinBoard} bb                 Bulletin Board to manipulate
 * @param {BulletinBoard} mod_team_bb        Bulletin Board to manipulate
 * @param {jQuery}        bb_iframe          iframe to use for ModCP login box
 * @param {jQuery}        mod_team_bb_iframe iframe to use for mod team login box
 * @return {jQuery.Promise}
 */
function _handle_login( bb, mod_team_bb, bb_iframe, mod_team_bb_iframe ) {
    var dfd = $.Deferred();
    $.when(
        bb.moderation_page(          bb_iframe, '/modcp/index.php?do=nav', '.navlink', '.navlink' ).progress(function() { dfd.notify() }),
        mod_team_bb.login ( mod_team_bb_iframe, 'Frontier Moderation Team'                        ).progress(function() { dfd.notify() })
    ).then(function() { dfd.resolve() }, function() { dfd.reject() });
    return dfd.promise();
}

/**
 * @summary Handle the dashboard page
 * @param {BulletinBoard}      bb Bulletin Board to manipulate
 * @param {Variables}          v  Variables to use
 * @param {Violations}         vi Violations to use
 * @param {SharedStore}        ss Shared Store to use
 * @param {MiscellaneousCache} mc Miscellaneous Cache to use
 * @param {string}             loading_html HTML to show while loading
 */
function handle_dashboard( bb, mod_team_bb, v, vi, ss, mc, loading_html ) { BabelExt.utils.dispatch(

    {
        match_pathname: '/',
        match_params: {
            do: 'dashboard',
        },
        match_elements: '.welcomelink a',
        pass_preferences: [ 'language' ],
        callback: function( stash, pathname, params, welcome_link, user_language ) {

            stash.intro = stash.newbies = $('<div>'); // placeholder, will be filled in later

            function update_values(data) {
                stash.intro.data( 'min_thread_id', data.intro_forum_thread_id+1 );
                stash.newbies.data( 'min_user_id', data.newbie_policy_base_user_id );
            }
            ss.change(update_values);
            update_values(ss.val());

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

            var dashboard = $(BabelExt.resources.get('res/dashboard.html'));

            var recently_reported_posts = {};
            var name = $('.welcomelink a').text();

            var mod_log_thread_id = v.resolve('frequently used posts/threads', 'mod log');
            var chaseup_thread_id = v.resolve('frequently used posts/threads', 'Moderation Chase-Up Thread');
            var report_forum_id = 48;
            var introductions_forum_id = 16;
            dashboard.find( '[data-thread="mod-log"]'              ).data( 'thread', mod_log_thread_id );
            dashboard.find( 'a[href="#insert-mod-log-link"]'       ).attr( 'href'  , bb.url_for.thread_show({ thread_id: mod_log_thread_id, goto: 'newpost' }) );
            dashboard.find( '[data-thread="chaseup-log"]'          ).data( 'thread', chaseup_thread_id );
            dashboard.find( 'a[href="#insert-chaseup-log-link"]'   ).attr( 'href'  , bb.url_for.thread_show({ thread_id: chaseup_thread_id, goto: 'newpost' }) );
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
             * CHASE-UP THREAD
             */
            dashboard.find('.chaseup').data( 'filter', function(posts) {

                var now = new Date().getTime();

                return posts.filter(function(post) {
                    var data = bb.parse_post('action data', post);
                    if ( !data ) return false;
                    if ( (data.deadline || data.date + 1000*60*60*24*7) > now ) return;
                    post.message_element.find('.bbcode_container').remove();
                    var content = post.message_element.find( '.postcontent' );
                    while ( content.children().last().is('br') ) content.children().last().remove();
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

            var policy_args = {
                v : v,
                bb: bb,
                vi: vi,
                ss: ss,
                mc: mc,
                loading_html: loading_html
            };

            var update_timer = null, root_action;
            function update_actions() {

                if ( update_timer !== null ) clearTimeout(update_timer);

                update_timer = setTimeout(function() {
                    update_timer = null;

                    var actions = dashboard.find('.dashboard-newbies [name="issue"]:checked').map(function() { return $(this).data('action') }).get()
                    if ( actions.length ) {
                        root_action = new Action( 'root action', actions ).then(new Action( 'update shared store', {
                            fire: function(data) {
                                var max_user_id = data['max user id'];
                                return ss.transaction(function(data) { data.newbie_policy_base_user_id = max_user_id+1 });
                            }
                        }));
                        var title = root_action.title();
                        title[0] = title[0][0].toUpperCase() + title[0].slice(1);
                        dashboard.find('.dashboard-newbies-result input').prop( 'disabled', false ).val( title.join('; ') + '; and mark users validated' );
                    } else {
                        root_action = null;
                        dashboard.find('.dashboard-newbies-result input').prop( 'disabled', false ).val( 'Validate all users' );
                    }
                }, 100 );

            }

            dashboard.find('.dashboard-newbies .dashboard-body')
                .on( 'click', 'a.collapse', function(event) {
                    var block = $(this).closest('.options_block');

                    if ( block.hasClass('collapsed') ) {
                        block.find('input[name="issue"]:checked').click();
                    } else {
                        block.addClass('collapsed');
                    }
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

                        var user = block.data('user');

                        var inappropriate = block.find('.inappropriate');
                        inappropriate.find( '.search .username' ).text( user.username );
                        inappropriate.find( '.search a' ).each(function() { this.href += encodeURIComponent(user.username) });

                        new InappropriateUsernamePolicy($.extend({
                            user: user,
                                  severity_slider_args: { container: inappropriate.find('.posthead' ) },
                            notification_selector_args: { container: inappropriate.find('.notification' ) },
                                    mode_switcher_args: { container: inappropriate.find('.mode-switcher') },
                            callback: function( action, summary, header ) {
                                block.find('.action.inappropriate').html(header).data( 'summary', summary );
                                block.find('[name="issue"][value="inappropriate"]').data( 'action', action );
                                update_actions();
                            }
                        }, policy_args ));

                        block.addClass('inappropriate-built');

                    } else if ( this.value == 'dupe' && !block.hasClass('dupe-built') ) {

                        /*
                         * Initialise the duplicate account block
                         */

                        var user = block.data('user');

                        var dupe = block.find('.dupe');
                        var dupe_action_container = dupe.find('.dupe-actions');

                        new DuplicateAccountPolicy($.extend({
                            user: user,
                                   severity_slider_args: { container: dupe.find('.posthead' ) },
                            duplicate_account_list_args: { container: dupe.find('.dupes' ) },
                            build_dupe_args: function(users) {
                                dupe_action_container.empty();
                                return users.map(function(user, index) {
                                    var element = $('<fieldset class="dupe-user-action"><legend></legend><div class="notification"><span class="mode-switcher"></span></div></fieldset>')
                                        .appendTo(dupe_action_container);
                                    element.find('legend').text( 'User action: ' + user.username );
                                    return {
                                        user: user,
                                              severity_slider_args: { container: element.find('.posthead' ) },
                                        notification_selector_args: { container: element.find('.notification' ) },
                                                   extra_post_args: { visible: !index },
                                                mode_switcher_args: { container: element.find('.mode-switcher') },
                                    }
                                });
                            },
                            callback: function(action, summary, header) {
                                block.find('.action.dupe').html(header).data( 'summary', summary );
                                block.find('[name="issue"][value="dupe"]').data( 'action', action );
                                update_actions();
                            }

                        }, policy_args ));

                        block.addClass('dupe-built');

                    }

                    update_actions();

                })
            ;

            var min_user_id, max_user_id;

            dashboard.find('.dashboard-newbies .dashboard-newbies-result input').click(function() {
                progress_bar(
                    this,
                    root_action
                        ? root_action.fire_with_journal(
                            bb,
                            {
                                'min user id': min_user_id,
                                'max user id': max_user_id,
                                'summary'    :
                                '[list]\n' +
                                    '[*]' + dashboard.find('.dashboard-newbies .action:visible').map(function() { return $(this).data('summary') }).get().join('\n[*]') + '\n' +
                                '[/list]',
                                'extra notes': dashboard.find( '.dashboard-newbies [name="extra-notes"]' ).val()
                            },
                            v,
                            v.resolve( 'frequently used posts/threads', 'newbie management log' ),
                            'newbie actions',
                            'log'
                        )
                        : ss.transaction(function(data) { data.newbie_policy_base_user_id = max_user_id; return true })
                    ,
                    'validated!'
                ).then(function() {
                    stash.newbies.data( 'min_user_id', max_user_id+1 );
                });
            });

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
           _handle_login(
               bb,
               mod_team_bb,
               body_wrapper.find('iframe').first(),
               body_wrapper.find('iframe').last ()
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
 * @summary Handle mod team replies to threads
 * @param {BulletinBoard}      bb Bulletin Board to manipulate
 * @param {Variables}          v  Variables to use
 * @param {MiscellaneousCache} mc Miscellaneous Cache to use
 * @param {string}             loading_html HTML to show while loading
 */
function handle_mod_team_replies( bb, mod_team_bb, v, mc, loading_html ) {

    var element;

    var namespace = 'mod team replies';

    function initialise(stash, pathname, params, link) {

        function build(html) {

            if ( !element ) {
                element = $( BabelExt.resources.get('res/popups/mod team replies.html') ).appendTo(document.body).hide();
                var promise = mod_team_bb.login( element.find('iframe'), 'Frontier Moderation Team' );
                if ( bb.get_pages().current == 1 ) {
                    return $.when(
                        $.get( bb.url_for.thread_show({ thread_id: params.t, posts_per_page: 1 }) ),
                        promise
                    ).then(function(html) { build(html[0]) });
                } else {
                    return promise.then(function() { build() });
                }
            }

            element.addClass('logged-in');

            var button = element.find('.button');

            var thread_creator = bb.process_posts(bb.get_posts(html))[0];

            var root_action;

            var policy = new ModTeamReplyPolicy({
                v : v,
                bb: bb,
                mc: mc,
                loading_html: loading_html,
                thread_id: params.t,
                thread_desc: bb.thread_title(),
                user: { username: thread_creator.username, user_id: thread_creator.user_id },

                mod_team_bb: mod_team_bb,
                mod_team_user: mod_team_bb.user_current(),

                template_selector_args: { container: element.find('.template_selector') },
                    post_selector_args: { container: element.find('.notification-post') },
                      pm_selector_args: { container: element.find('.notification-pm') },
                         deadline_args: { container: element.find('.reopen-reminder') },

                callback: function( action, summary, has_post, has_pm ) {
                    element.find('.notification-post')[ has_post ? 'show' : 'hide' ]();
                    element.find('.notification-pm'  )[ has_pm   ? 'show' : 'hide' ]();

                    root_action = action;
                    var title = root_action.title();

                    if ( title.length ) {
                        title[0] = title[0][0].toUpperCase() + title[0].slice(1);
                        button.last().prop( 'disabled', false ).val( title.join('; ') );
                    } else {
                        button.last().prop( 'disabled', true  ).val( 'please select some actions' );
                    }

                }

            });

            button.click(function() {
                var progress_bar = $(button).parent().addClass('mod-friend-progressing').find('.mod-friend-percent').css({ width: 0 });
                root_action.fire_with_journal(
                    bb,
                    policy.keys({ 'extra notes' : element.find('[name="extra-notes"]').val() }),
                    v,
                    v.resolve('frequently used posts/threads', 'mod team reply log' ),
                    'mod team replies',
                    'log'
                ).progress(function(percent) {
                    progress_bar.css({ width: percent + '%' });
                }).always(function() {
                    progress_bar.closest('.mod-friend-progressing').removeClass('mod-friend-progressing');
                }).done(function() {
                    $(button).prop( 'disabled', true ).val( 'replied!' );
                });
            });

        }

        function hide_element(event) {
            if ( !$(event.target).closest('.mod-friend-team-reply').is(element) ) {
                element.slideUp();
                $(document).off( 'click', hide_element );
            }
        }

        function build_event(event) {
            var promise = build(), link = this, do_click = event.type == 'click';
            function register_click(event) { do_click = true };
            reply_buttons
                .off( 'click mouseover', build_event )
                .on ( 'click'          , register_click );
            if ( promise ) promise.then(function() {
                if ( do_click ) link.click();
                $(link).off('click', register_click);
            });
        }

        var reply_buttons = $('<a class="newcontent_textcontrol" href="#mod-team-reply" style="position: absolute"><span>+</span>Mod Team Reply</a>')
            .insertBefore(link)
            .each(function() {
                $(this).css({ 'margin-left': ( $(this.nextElementSibling).outerWidth() + 10 ) + 'px' });
            })
            .on( 'click mouseover', build_event )
            .click(function(event) {
                if ( element && element.hasClass('logged-in') ) {
                    if ( element.is(':visible') ) {
                        element.slideUp();
                        $(document).off( 'click', hide_element );
                    } else {
                        var offset = $(this).offset();
                        offset.top += $(this).outerHeight();
                        element.slideDown().offset(offset);
                        setTimeout(function() {
                            $(document).on ( 'click', hide_element );
                        }, 0 );
                    }
                }
                event.preventDefault();
            })
        ;

    }

    BabelExt.utils.dispatch(
        {
            match_pathname: '/showthread.php',
            match_elements: [ '#newreplylink_top' ],
            callback: function(stash, pathname, params, link) {

                // skip this in the report forum:
                if ( $('.navbit a[href="forumdisplay.php?f=48"]').length ) return false;

                $("head").append(
                    "<style type='text/css'>" +
                        v.parse( BabelExt.resources.get('res/main.css'), bb.css_keys() ) +
                    "</style>"
                );

                initialise(stash, pathname, params, link);
            }
        },
        {
            match_pathname: '/showthread.php',
            match_elements: [ '#newreplylink_bottom' ],
            callback: initialise
        }
    );

}

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

            post.find('a[href="#download-thread"]')
                .click(function(event) {
                    var $this = $(this);
                    v.serialise_thread(params.t, document.title, document.body).then(function(xml) {
                        var link = $('<a>')
                            .attr( 'download', 'Thread ' + params.t + ' - ' + document.title + '.xml' )
                            .attr( 'href', 'data:application/octet-stream,'+encodeURIComponent(xml) )
                            .appendTo(document.body);
                        link[0].click(); // for some reason, link.click() doesn't work
                        link.remove();
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
    // I keep going to the wrong site :s
    if ( location.origin == "http://forumstest.frontier.co.uk" ) location = location.toString().replace( '://', 's://' );
    // in the root window
    if ( location.hostname.search(/\.$/)==-1) BabelExt.utils.dispatch({ // initialise general stuff
        pass_storage    : ['variables', 'violations', 'misc'],
        pass_preferences: [ 'language', 'reload_interval' ],
        callback: function( stash, pathname, params, variables, violations, misc, user_language, reload_interval ) {

            var bb = new VBulletin();


            // Because of an obscure legacy DNS feature, you can append a '.' to a domain and connect to the same server
            // this is treated as a different server for cookie purposes, allowing us to manage a second account:
            var mod_team_bb;
            if ( location.hostname == 'forumstest.frontier.co.uk' ) {
                // ... but the test site dies when you try :(
                mod_team_bb = bb;
            } else {
                mod_team_bb = new VBulletin({ origin: location.origin + '.' });
            }

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

                $.when( vi.promise, mc.promise, ss.promise ).then(function() {
                    handle_modcp_doips          ( bb );
                    handle_post_edit            ( bb );
                    handle_moderation_links     ();
                    handle_moderation_checkboxes();
                    handle_modcp_user           ();
                    handle_mod_team_replies     ( bb, mod_team_bb, v, mc, loading_html );
                    handle_thread_form          ( bb, v, handle_error );
                    handle_usernotes_cc         ( bb, v );
                    handle_dashboard            ( bb, mod_team_bb, v, vi, ss, mc, loading_html );
                    handle_legacy               ( bb, v, vi, loading_html ); // everything that hasn't been refactored yet
                });

            });

        }

    })
} else {
    // in an iframe
    if ( location.origin == 'https://forums.frontier.co.uk.' )
        VBulletin.iframe_callbacks( 'https://forums.frontier.co.uk', [ '.frontier.co.uk.', 'frontier.co.uk.' ] );
}
