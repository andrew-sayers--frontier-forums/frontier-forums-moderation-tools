/**
 * @file Bulletin Board Dashboard
 * @author Andrew Sayers
 * @description Display continuously-updated information about a bulletin board
 */

// notification thread page
// communication with notification tab

/**
 * @summary Dashboard to display various moderation information
 * @constructor
 * @example
 * var dashboard = new Dashboard({
 *     cache             : { ... }, // values previously passed to cache, or an empty object on first run
 *     cache_updater     : function(cache) { ... }, // save object to pass in next time
 *     container         : $(...), // dashboard will be appended to this element
 *     header            : $(...), // dashboard header will be appended to this element
 *     monitor_newbies   : true, // show new users (requires moderator privileges)
 *     monitor_post_queue: true, // show moderated posts (requires moderator privileges)
 *     monitor_threads   : [{ name: 'my thread', thread_id:  123, filter: function(thread) {...} }, ... ], // threads to check for new posts
 *     monitor_forums    : [{ name: 'my forum' , forum_id: 12, filter: function(thread) {...} }, ... ], // forums to check for new threads
 *     interval          : 60000, // each monitor will be polled once per this many milliseconds
 * });
 */
function Dashboard( data ) {

    if ( data.header ) {

        /*
         * If you temporarily disable the extension, all running intervals will be cancelled.
         * This block uses a CSS animation to warn the user when that happens.
         */

        $("head").append(
            "<style type='text/css'>" +
                '@-webkit-keyframes dashboard-warning { 0%, 99% {opacity: 0; visibility: hidden} 100% {opacity: 1; visibility: visible} }' +
                        '@keyframes dashboard-warning { 0%, 99% {opacity: 0; visibility: hidden} 100% {opacity: 1; visibility: visible} }' +
                '.dashboard-warning' +
                           '{ animation: dashboard-warning ' + Math.ceil(data.interval / 500) + 's;' +
                    ' -webkit-animation: dashboard-warning ' + Math.ceil(data.interval / 500) + 's;' +
                    'float: none ! important; color: red}' +
            "</style>"
        );

        data.header.append('<div>Dashboard<span class="dashboard-warning">&nbsp;&nbsp;&nbsp;&nbsp;WARNING: dashboard has stopped.  Please refresh the page</span></div>');

        setInterval(function() {
            data.header.find('.dashboard-warning').replaceWith( data.header.find('.dashboard-warning').clone() );
        }, data.interval );
    }

    this.bb    = data.bb;
    this.cache = data.cache;
    this.transient_cache = {};

    this.update_cache = function() { data.cache_updater( this.cache ) }

    data.bb.css_add([ 'user_show', 'forum_show', 'thread_show' ]);

    var dashboard = this;

    var monitors = [];

    ( data.monitor_threads || [] ).forEach(function(thread) {
        var container = $('<div style="clear: both" class="postlist restrain"></div>').appendTo(data.container);
        monitors.push( function() { dashboard.check_thread( thread, container ) } );
    });

    ( data.monitor_forums || [] ).forEach(function(forum) {
        var container = $('<div style="clear: both" class="options_block_container"><div class="options_block" style="width: 100%"></div></div>')
            .appendTo(data.container)
            .find('.options_block')
        ;
        monitors.push( function() { dashboard.check_forum( forum, container ) } );
    });

    if ( data.monitor_post_queue ) {
        var post_queue_container = $('<div style="clear: both"></div>').appendTo(data.container);
        monitors.push( function() { dashboard.monitor_post_queue( post_queue_container ) } );
    }

    if ( data.monitor_newbies ) {
        var newbies_container = $('<div style="clear: both"></div>').appendTo(data.container);
        monitors.push( function() { dashboard.monitor_newbies( newbies_container ) } );
    }

    if ( monitors.length ) {

        // initialise everything nice and early:
        monitors.forEach(function(f) { f() });

        // then space out the refreshes over the interval:
        var interval = setInterval(function() {
            if ( monitors.length ) {
                var monitor = monitors.shift();
                monitor();
                setInterval( monitor, data.interval );
            } else {
                clearInterval(interval);
            }
        }, data.interval / monitors.length );

    }

}

/**
 * @summary show notifications registered by the dashboard
 */
function show_dashboard_notifications(cache) {
}


function add_notification( title, notification_html, body_html ) {
}

/**
 * @summary Check a thread for unread messages
 * @private
 */
Dashboard.prototype.check_thread = function(thread, container) {

    var dashboard = this, thread_id = thread.thread_id, thread_name = thread.name;

    dashboard.bb.thread_whoposted(thread_id).then(function(who_posted) {

        // thread pages are very expensive to load - we use the "who posted" page as a cheaper way to generate a signature:
        var signature = who_posted.total + ',' + who_posted.users.map(function(user) { return user.post_count }).join();

        if ( ( dashboard.transient_cache['thread-signature-'+thread_id] || '' ) == signature ) return;

        var read_post_id = dashboard.cache['thread-read-'+thread_id];
        var thread_link = '<a href="' + dashboard.bb.url_for.thread_show({ thread_id: thread_id }) + '">' + thread_name + '</a>';

        $.get(dashboard.bb.url_for.thread_show( // get unread posts (or the most recent page)
            read_post_id
            ? { thread_id: thread_id, post_id: read_post_id }
            : { thread_id: thread_id, goto   : 'newpost'    }
        )).then(function(html) {
            dashboard.bb.thread_posts( thread_id, html ).then(function(posts) {

                dashboard.transient_cache['thread-signature-'+thread_id] = signature;

                if ( read_post_id  ) posts = posts.filter(function() { return this.post_id > read_post_id });
                if ( thread.filter ) posts = posts.filter(thread.filter);

                if ( !posts.length ) {
                    container.html(
                        '<h4 class="collapse blockhead options_correct">No unread posts in ' + thread_link + '</h4>'
                    );
                    return;
                };

                container.html(
                    '<h4 class="collapse blockhead options_correct">Please read recent posts in ' + thread_link +
                        '<a href="#mark-read" class="mark-read" style="float: right">Mark log read</a>' +
                    '</h4>' +
                    '<ol class="posts" start="1"></ol>'
                );
                var ol = container.find('ol');
                container.find('.mark-read').click(function(event) {
                    if ( ol.is(':visible') ) { // mark read
                        ol.hide();
                        dashboard.cache['thread-read-'+thread_id] = posts[posts.length-1].post_id;
                        $(this).text( 'Mark log unread' );
                    } else { // mark unread
                        ol.show();
                        dashboard.cache['thread-read-'+thread_id] = read_post_id;
                        $(this).text( 'Mark log read' );
                    }
                    dashboard.update_cache();
                    event.preventDefault();
                });
                ol.append( posts.map(function(post) { return this.container_element }) );

            });
        });

    });
}

/**
 * @summary Check a forum for new posts
 * @private
 */
Dashboard.prototype.check_forum = function(forum, container) {

    var dashboard = this, forum_id = forum.forum_id, forum_name = forum.name;

    // forum pages are less expensive than thread pages, so we don't bother caching them:
    var read_post_id = dashboard.cache['forum-checked-'+forum_id];
    var forum_link   = '<a href="' + dashboard.bb.url_for.forum_show({ forum_id: forum_id }) + '">' + forum_name + '</a>';

    dashboard.bb.forum_threads(forum_id).then(function(threads) {

        var last_post_ids = threads.map(function(thread) { return thread.last_post_id });

        // ignore if unchanged
        if ( ( dashboard.transient_cache['forum-signature-'+forum_id] || '' ) == last_post_ids.join() ) return;
        dashboard.transient_cache['forum-signature-'+forum_id] = last_post_ids.join();
        dashboard.update_cache();

        if ( read_post_id ) threads = threads.filter(function(thread) { return thread.last_post_id > read_post_id });
        if ( forum.filter ) threads = threads.filter(forum.filter);

        if ( !threads.length ) {
            container.html(
                '<h4 class="collapse blockhead options_correct">No unchecked threads in ' + forum_link + '</h4>'
            );
            return;
        };

        container.html(
            '<h4 class="collapse blockhead options_correct">Please check recent threads in ' + forum_link +
                '<a href="#mark-checked" class="mark-checked" style="float: right">Mark reports checked</a>' +
            '</h4>' +
            '<ol class="threads" start="1" style="margin-right: 2px"></ol>'
        );
        var ol = container.find('ol');
        container.find('.mark-checked').click(function(event) {
            if ( ol.is(':visible') ) { // mark checked
                ol.hide();
                dashboard.cache['forum-checked-'+forum_id] = Math.max.apply( Math, last_post_ids );
                $(this).text( 'Mark reports unchecked' );
            } else { // mark unchecked
                ol.show();
                dashboard.cache['forum-checked-'+forum_id] = read_post_id;
                $(this).text( 'Mark reports checked' );
            }
            dashboard.update_cache();
            event.preventDefault();
        });
        ol.append( threads.map(function(thread) { return thread.container_element }) );

    });
}

/**
 * @summary Display the list of new users
 * @private
 */
Dashboard.prototype.monitor_newbies = function(container, end_time) {

    var dashboard = this;

    var    next_user_id = dashboard.cache['newbies-next'   ];
    var current_users   = dashboard.cache['newbies-current'];

    if ( !next_user_id ) {
        dashboard.bb.users_list_new().then(function(users) {
            dashboard.cache['newbies-next'] = users[0].user_id + 1;
            dashboard.cache['newbies-current'] = [];
            dashboard.update_cache();
            dashboard.monitor_newbies(container);
        });
        return;
    }

    // approximate amount of time to spend downloading new user accounts:
    var first = !end_time;
    if ( first ) end_time = new Date().getTime() + 10000;

    dashboard.bb.user_moderation_info(next_user_id).then(function(user_info) {

        if ( user_info ) {
            return dashboard.bb.ip_users( user_info.ip ).then(function(users) {

                user_info.suspected_duplicates = users.users;
                ++dashboard.cache['newbies-next'];
                current_users.push(user_info);
                dashboard.update_cache();

                if ( new Date().getTime() < end_time ) {
                    // get another account
                    dashboard.monitor_newbies(container, end_time);
                } else {
                    // time's up - update the page:
                    do_update(current_users);
                }

            });
        } else {
            // update if there are new accounts or the container needs to be initialised:
            if ( !first || !container.html() ) {
                do_update(current_users);
            }
        }

    });

    function do_update(current_users) {

        var newbies_link = '<a href="' + dashboard.bb.url_for.users_show() + '">the member list</a>';

        if ( !current_users.length ) {
            container.html(
                '<h4 class="collapse blockhead options_correct">No unvalidated newbies in ' + newbies_link + '</h4>'
            );
            return;
        };

        container.html(
            '<h4 class="collapse blockhead options_correct">Please validate newbie names in ' + newbies_link +
                '<a href="#mark-valid" class="mark-valid" style="float: right">Mark newbies valid</a>' +
            '</h4>' +
            '<table><thead><tr><th>Name<th>e-mail address<th>Also associated with this IP address</thead><tbody></tbody></table>'
        );
        var table = container.find('table');
        container.find('.mark-valid').click(function(event) {
            if ( table.is(':visible') ) { // mark valid
                table.hide();
                dashboard.cache['newbies-current'] = [];
                $(this).text( 'Unmark newbies valid' );
            } else { // unmark valid
                table.show();
                dashboard.cache['newbies-current'] = current_users;
                $(this).text( 'Mark newbies valid' );
            }
            dashboard.update_cache();
            event.preventDefault();
        });

        table.children('tbody').html(
            current_users.sort(function (a,b) { return a.name.localeCompare(b.name) }).map(function(user) {
                var ret = $('<tr><td><a href=""></a><td>&lt;<span></span>&gt;</span><td></tr>');
                ret.find('a'   ).text( user.name ).attr( 'href', dashboard.bb.url_for.user_show({ user_id: user.user_id }) );
                ret.find('span').text( user.email );
                var dupes = user.suspected_duplicates.map(function(dupe_user) {
                    if ( user.name != dupe_user.name ) {
                        return $('<a href=""></a>')
                            .text( dupe_user.name )
                            .attr( 'href', dashboard.bb.url_for.user_show({ user_id: dupe_user.user_id }) )
                        }
                });
                if ( dupes.length ) {
                    ret.find('td').eq(2).append(dupes).children(':not(:last-child)').after(', ');
                }
                return ret;
            })
        );

    }

}


/**
 * @summary Display the list of posts awaiting moderation
 * @private
 */
Dashboard.prototype.monitor_post_queue = function(container) {

    var dashboard = this;

    var read_post_id   = dashboard.cache['moderated-next-post'  ];
    var read_thread_id = dashboard.cache['moderated-next-thread'];

    var mod_link = '<a href="' + dashboard.bb.url_for.moderation_posts() + '">the moderation queue</a>';

    dashboard.bb.posts_moderated().then(function(posts_and_threads) {

        var posts = posts_and_threads.posts, threads = posts_and_threads.threads;

        if ( read_post_id   ) posts   = posts  .filter(function(post  ) { return post  .post_id   > read_post_id   });
        if ( read_thread_id ) threads = threads.filter(function(thread) { return thread.thread_id > read_thread_id });

        if ( !threads.length && !posts.length ) {
            container.html(
                '<h4 class="collapse blockhead options_correct">No unmoderated posts in ' + mod_link + '</h4>'
            );
            return;
        };

        container.html(
            '<h4 class="collapse blockhead options_correct">Please moderate posts in ' + mod_link +
                '<a href="#mark-moderated" class="mark-moderated" style="float: right">Mark posts moderated</a>' +
            '</h4>' +
            '<table><thead><tr><th>Forum<th>Thread<th>Title<th>author</thead><tbody></tbody></table>'
        );
        var table = container.find('table');
        container.find('.mark-moderated').click(function(event) {
            if ( table.is(':visible') ) { // mark moderated
                table.hide();
                if ( posts  .length ) dashboard.cache['moderated-next-post'  ] = posts  [posts  .length-1].  post_id;
                if ( threads.length ) dashboard.cache['moderated-next-thread'] = threads[threads.length-1].thread_id;
                $(this).text( 'Mark posts unmoderated' );
            } else { // mark unmoderated
                table.show();
                dashboard.cache['moderated-next-post'  ] = read_post_id;
                dashboard.cache['moderated-next-thread'] = read_thread_id;
                $(this).text( 'Mark posts moderated' );
            }
            dashboard.update_cache();
            event.preventDefault();
        });

        table.children('tbody').html(
            threads.map(function(thread) {
                var ret = $('<tr><td><a href=""></a><td><a href=""></a><td><a href=""></a><td><a href=""></a></a></tr>');
                var links = ret.find('a');
                links.eq(0).attr('href', dashboard.bb.url_for. forum_show({  forum_id: thread. forum_id }) ).text( thread.forum_name );
                links.eq(1).attr('href', dashboard.bb.url_for.thread_show({ thread_id: thread.thread_id }) ).text( thread.thread_title );
                links.eq(2).attr('href', dashboard.bb.url_for.thread_show({ thread_id: thread.thread_id }) ).text( '(first post)' );
                links.eq(3).attr('href', dashboard.bb.url_for.  user_show({   user_id: thread.  user_id }) ).text( thread.user_name );
                return ret;
            }).concat(posts.map(function(post) {
                var ret = $('<tr><td><a href=""></a><td><a href=""><td><a href=""><td><a href=""></a></a></tr>');
                var links = ret.find('a');
                links.eq(0).attr('href', dashboard.bb.url_for. forum_show({  forum_id: post. forum_id }) ).text( post.forum_name );
                links.eq(1).attr('href', dashboard.bb.url_for.thread_show({ thread_id: post.thread_id }) ).text( post.thread_title );
                links.eq(2).attr('href', dashboard.bb.url_for.  post_show({ thread_id: post.thread_id, post_id: post.post_id }) ).text( post.  post_title || '(no title)' );
                links.eq(3).attr('href', dashboard.bb.url_for.  user_show({   user_id: post.  user_id }) ).text( post.user_name );
                return ret;
            }))
        );

    });

}
