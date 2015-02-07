/**
 * @file Bulletin Board Dashboard
 * @author Andrew Sayers
 * @description Display continuously-updated information about a bulletin board
 */

// notification thread page
// communication with notification tab

/**
 * @summary Dashboard displaying miscellaneous real-time information
 * @constructor
 * @example
 * var dashboard = new Dashboard({
 *     cache             : { ... }, // values previously passed to cache, or an empty object on first run
 *     cache_updater     : function(cache) { ... }, // save object to pass in next time
 *     container         : $(...), // element containing dashboard content
 *     interval          : 60000   // each monitor will be polled once per this many milliseconds
 * });
 *
 * @description
 * Dashboards display information about the bulletin board you're on.
 * Currently supported: 'thread', 'forum', 'mod_queue' and 'newbies'.
 *
 * Most configuration is done through the HTML in the "container" parameter.
 * Elements with class "dashboard-header" have the dashboard header inserted.
 * Elements with class "dashboard-section" are set to dashboard sections (based on their "data-monitor" parameter)
 * Elements with class "dashboard-body" within "dashboard-section" receive the contents of the section
 * Elements with class "dashboard-refresh" will trigger a refresh of the current section when clicked
 * Elements with class "dashboard-done" are treated as buttons to (un)mark a section done
 *
 * Section elements have classes "loading", "empty", "nonempty", "done" and "undone" set as appropriate.
 */
function Dashboard( data ) {

    this.bb    = data.bb;
    this.cache = data.cache;
    this.update_cache = function() { data.cache_updater( this.cache ) }

    /*
     * INITIALISE HEADER
     */

    data.container.find('.dashboard-header').each(function() {

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

        var warning_container =
            $('<div>Dashboard<span class="dashboard-warning">&nbsp;&nbsp;&nbsp;&nbsp;WARNING: dashboard has stopped.  Please refresh the page</span></div>')
            .appendTo(this);

        setInterval(function() {
            warning_container.find('.dashboard-warning').replaceWith( warning_container.find('.dashboard-warning').clone() );
        }, data.interval );

    });

    /*
     * INITIALISE SECTIONS
     */

    var sections = data.container.find('.dashboard-section');

    var interval = data.interval;
    var tick = interval / sections.length, tick_count = 0;

    var dashboard = this;

    sections.each(function() {

        var container = $(this), monitor = container.data('monitor');

        if ( !monitor || !Dashboard.prototype.hasOwnProperty(monitor+'_refresh') ) {
            console.log("Ignoring unknown dashboard monitor: " + monitor);
            return;
        }

        // initialise "done" buttons:
        var done_time = 0;
        container.find('.dashboard-done').click(function(event) {
            done_time = new Date().getTime();

            dashboard[monitor+'_done']( container, container.hasClass('done') );
            dashboard.update_cache();

            container.toggleClass('done undone');
            event.preventDefault();
        });

        function refresh(force) {
            // don't change anything while people are looking:
            if ( force || ( done_time < new Date().getTime() - interval/2 && ! container.is(':hover') ) ) {

                done_time = new Date().getTime();
                var old_class = container.attr( 'class' );

                // set the section's state to look right while loading:
                if ( container.hasClass('done') ) container.addClass('empty');
                container.removeClass( 'nonempty done undone' ).addClass( 'loading' );

                dashboard[monitor+'_refresh'](container).then(function(contents) {
                    container.removeClass( 'empty loading' )
                    if ( typeof(contents) == 'undefined' ) {
                        container.attr( 'class', old_class );
                    } else {
                        container.find('.dashboard-body').empty().append(contents);
                        container.addClass(
                            contents.length
                            ? 'nonempty undone'
                            :    'empty'
                        );
                    }
                });

            }
        }

        // initialise "refresh" buttons:
        container.find('a.dashboard-refresh').click(function(event) {
            refresh(true);
            event.preventDefault();
        });

        // initialise the section:
        container.addClass( 'empty' );
        container.data( 'signature', '' );
        var promise = Dashboard.prototype.hasOwnProperty(monitor+'_init') ? dashboard[monitor+'_init'](container) : false;
        if ( promise ) {
            done_time = new Date().getTime(); + Math.pow( 10, 10 ); // disable refreshes until initialised
            promise.then(function() { refresh(true) });
        } else {
            refresh(true);
        }

        // fire the refresh callback once per interval,
        // with sections spaced out evenly across the interval:
        setTimeout(function() { setInterval( refresh, interval ) }, tick * tick_count++ );

    });

}

/**
 * @summary show notifications registered by the dashboard
 */
function show_dashboard_notifications(cache) {
}


function add_notification( title, notification_html, body_html ) {
}

/*
 * THREAD MONITORING
 */

Dashboard.prototype.thread_done = function(container, undo) {
    this.cache['thread-done-'+container.data('thread')] = container.data( undo ? 'undone_id' : 'done_id' );
}

Dashboard.prototype.thread_refresh = function(container) {

    var dashboard = this, thread_id = container.data( 'thread' );

    return dashboard.bb.thread_whoposted(thread_id).then(function(who_posted) {

        // thread pages are very expensive to load - we use the "who posted" page as a cheaper way to generate a signature:
        var signature = who_posted.total + ',' + who_posted.users.map(function(user) { return user.post_count }).join();

        if ( container.data('signature') == signature ) return;

        var read_post_id = dashboard.cache['thread-done-'+thread_id];
        container.data( 'undone_id', read_post_id );

        return $.get(dashboard.bb.url_for.thread_show( // get unread posts (or the most recent page)
            read_post_id
            ? { thread_id: thread_id, post_id: read_post_id }
            : { thread_id: thread_id, goto   : 'newpost'    }
        )).then(function(html) {
            return dashboard.bb.thread_posts( thread_id, html ).then(function(posts) {

                container.data( 'signature', signature );
                container.data( 'done_id', posts[posts.length-1].post_id );

                if ( read_post_id ) posts = posts.filter(function() { return this.post_id > read_post_id });
                if ( container.data('filter') ) posts = posts.filter(container.data('filter'));

                return posts.map(function(post) { return this.container_element });

            });
        });

    });

}

/*
 * FORUM MONITORING
 */

Dashboard.prototype.forum_done = function(container, undo) {
    this.cache['forum-done-'+container.data('thread')] = container.data( undo ? 'undone_id' : 'done_id' );
}

Dashboard.prototype.forum_refresh = function(container) {

    var dashboard = this, forum_id = container.data('forum');

    // forum pages are less expensive than thread pages, so we don't bother caching them:
    var read_post_id = dashboard.cache['forum-done-'+forum_id];
    container.data( 'undone_id', read_post_id );

    return dashboard.bb.forum_threads(forum_id).then(function(threads) {

        var last_post_ids = threads.map(function(thread) { return thread.last_post_id });
        container.data( 'done_id', Math.max.apply( Math, last_post_ids ) );

        // ignore if unchanged
        if ( container.data('signature') == last_post_ids.join() ) return;
        container.data( 'signature',  last_post_ids.join() );

        if ( read_post_id ) threads = threads.filter(function(thread) { return thread.last_post_id > read_post_id });
        if ( container.data('filter') ) threads = threads.filter(container.data('filter'));

        return threads.map(function(thread) { return thread.container_element });

    });
}

/*
 * NEWBIE MONITORING
 */

Dashboard.prototype.newbies_init = function(container) {

    if ( !this.cache['newbies-next'] ) { // first run
        return this.bb.users_list_new().then(function(users) {
            this.cache['newbies-next'] = users[0].user_id + 1;
            this.cache['newbies-current'] = [];
            this.update_cache();
            this.monitor_newbies(container);
        });
    }

}

Dashboard.prototype.newbies_done = function(container, undo) {
    this.cache['newbies-current'] = undo ? container.data( 'newbies-current' ) : [];
}

Dashboard.prototype.newbies_refresh = function(container) {

    var dashboard = this;

    var current_users = dashboard.cache['newbies-current'];
    container.data( 'newbies-current', current_users );

    // approximate amount of time to spend downloading new user accounts:
    var end_time = new Date().getTime() + 10000;
    var user_count = 0;

    // get a new user account (called recursively until the time limit is reached):
    function get_user(user_info) {

        if ( user_info ) {
            ++user_count;
            return dashboard.bb.ip_users( user_info.ip ).then(function(users) {

                user_info.suspected_duplicates = users.users;
                ++dashboard.cache['newbies-next'];
                current_users.push(user_info);
                dashboard.update_cache();

                if ( new Date().getTime() < end_time ) {
                    // get another account
                    return dashboard.bb.user_moderation_info(dashboard.cache['newbies-next']).then(get_user);
                }

            });
        }

    };

    return dashboard.bb.user_moderation_info(dashboard.cache['newbies-next']).then(get_user).then(function() {

        // If the section has already been initialed and there are no new users, return unchanged:
        if ( container.data( 'signature' ) && !user_count ) return;
        container.data( 'signature', true );

        return current_users.sort(function (a,b) { return a.name.localeCompare(b.name) }).map(function(user) {
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
        });

    });

}

/*
 * POST QUEUE MONITORING
 */

Dashboard.prototype.mod_queue_done = function(container, undo) {
    this.cache['moderated-next-post'  ] = container.data( undo ?   'post-undone' :   'post-done' );
    this.cache['moderated-next-thread'] = container.data( undo ? 'thread-undone' : 'thread-done' );
}

Dashboard.prototype.mod_queue_refresh = function(container) {

    var dashboard = this;

    var read_post_id   = dashboard.cache['moderated-next-post'  ];
    var read_thread_id = dashboard.cache['moderated-next-thread'];
    container
        .data(   'post-undone', read_post_id   )
        .data( 'thread-undone', read_thread_id )
    ;

    return dashboard.bb.posts_moderated().then(function(posts_and_threads) {

        var posts = posts_and_threads.posts, threads = posts_and_threads.threads;

        var signature =
            threads.map(function(thread) { return thread.thread_id }).concat(
             posts.map(function(post  ) { return post  .post_id   })
            ).join();
        if ( signature == container.data( 'signature' ) ) return;
        container.data( 'signature', signature );

        if ( read_post_id   ) posts   = posts  .filter(function(post  ) { return post  .post_id   > read_post_id   });
        if ( read_thread_id ) threads = threads.filter(function(thread) { return thread.thread_id > read_thread_id });

        container.data(   'post-done',   posts.length ? posts  [posts  .length-1].  post_id : read_post_id   );
        container.data( 'thread-done', threads.lnegth ? threads[threads.length-1].thread_id : read_thread_id );

        return threads.map(function(thread) {
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
        }));

    });

}

/*
 * EXAMPLE MONITORING
 */
// Copy/paste this monitor to make your own monitor
// It will be registered and named automatically based on the function names:

/*

// Some monitors need more than the default initialisation:
Dashboard.prototype.example_init = function(container) {
    // init() can optionally return a Deferred object:
    return $.get(...).then(function(html) {
        // 'signature' is set to '' by default, but you can override it:
        container.data( 'signature', $(html).find('.initial-value') );
    });
}

*/

// called when the user clicks the "done" or "undone" button:
Dashboard.prototype.example_done = function(container, undo) {
    // update the cache so future calls to refresh() act as if the monitor has been (un)done
    this.cache['example-data'] = container.data( undo ? 'undone_id' : 'done_id' );
}

// called when it's time to refresh the list:
Dashboard.prototype.example_refresh = function(container) {

    var dashboard = this, example_id = container.data('forum');

    // forum pages are less expensive than thread pages, so we don't bother caching them:
    var id = dashboard.cache['example-data'];
    container.data( 'undone_id', id );

    return dashboard.bb.example(/*...*/).then(function(ret) {

        // return an undefined value to indicate the state hasn't changed:
        if ( container.data('signature') == ret.signature ) return;
        container.data( 'signature',  ret.signature );

        // update stored values:
        container.data( 'done_id', ret.id );

        // most monitors have use for some kind of filter:
        if ( id ) ret = ret.filter(function(thread) { return ret.id > id });
        if ( container.data('filter') ) ret = ret.filter(container.data('filter'));

        // return an array (or jQuery container) of elements to populate the body:
        return ret.map(function(thread) { /* ... */ });

    });

}
