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
 * @extends Cacheable
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
 * Section elements can have a 'bb' data item if they need to access a different bulletin board
 */
function Dashboard( args ) {

    Cacheable.call( this, args );
    this.bb = args.bb;

    /*
     * INITIALISE HEADER
     */

    args.container.find('.dashboard-header').each(function() {

        /*
         * If you temporarily disable the extension, all running intervals will be cancelled.
         * This block uses a CSS animation to warn the user when that happens.
         */

        $("head").append(
            "<style type='text/css'>" +
                '@-webkit-keyframes dashboard-warning { 0%, 99% {opacity: 0; visibility: hidden} 100% {opacity: 1; visibility: visible} }' +
                        '@keyframes dashboard-warning { 0%, 99% {opacity: 0; visibility: hidden} 100% {opacity: 1; visibility: visible} }' +
                '.dashboard-warning' +
                           '{ animation: dashboard-warning ' + Math.ceil(args.interval / 500) + 's;' +
                    ' -webkit-animation: dashboard-warning ' + Math.ceil(args.interval / 500) + 's;' +
                    'float: none ! important; color: red}' +
            "</style>"
        );

        var warning_container =
            $('<div>Dashboard<span class="dashboard-warning">&nbsp;&nbsp;&nbsp;&nbsp;WARNING: dashboard has stopped.  Please refresh the page</span></div>')
            .appendTo(this);

        setInterval(function() {
            warning_container.find('.dashboard-warning').replaceWith( warning_container.find('.dashboard-warning').clone() );
        }, args.interval );

    });

    /*
     * INITIALISE SECTIONS
     */

    var sections = args.container.find('.dashboard-section');

    var interval = args.interval;
    var tick = interval / sections.length, tick_count = 0;

    var dashboard = this;

    sections.each(function() {

        var container = $(this), monitor = container.data('monitor'), bb = container.data('bb') || dashboard.bb;

        if ( !monitor || !Dashboard.prototype.hasOwnProperty(monitor+'_refresh') ) {
            console.log("Ignoring unknown dashboard monitor: " + monitor);
            return;
        }

        // initialise "done" buttons:
        var done_time = 0;
        container.find('.dashboard-done').click(function(event) {
            done_time = new Date().getTime();

            dashboard[monitor+'_done']( bb, container, container.hasClass('done') );
            dashboard.update_cache();

            container.toggleClass('done undone');
            event.preventDefault();
        });

        // empty the container in a non-undoable way:
        container.data('empty', function(event) {
            done_time = new Date().getTime();

            dashboard[monitor+'_done']( bb, container, container.hasClass('done') );
            dashboard.update_cache();

            container.removeClass('undone nonempty').addClass( 'done empty' );
        });

        $(container).on( 'mouseover click', function() { done_time = new Date().getTime() });

        function refresh(force) {
            // don't change anything while people are looking:
            if ( force || ( done_time < new Date().getTime() - interval/2 && ! container.is(':hover') ) ) {

                done_time = new Date().getTime();
                var old_class = container.attr( 'class' );

                // set the section's state to look right while loading:
                if ( container.hasClass('done') ) container.addClass('empty');
                container.removeClass( 'nonempty done undone' ).addClass( 'loading' );

                dashboard[monitor+'_refresh'](bb, container).then(function(contents) {
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
        var promise = Dashboard.prototype.hasOwnProperty(monitor+'_init') ? dashboard[monitor+'_init'](bb, container) : false;
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

Dashboard.prototype = Object.create(Cacheable.prototype, {
    bb: { writable: true, configurable: false },
});
Dashboard.prototype.constructor = Dashboard;

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

Dashboard.prototype.thread_init = function(bb, container) {

    if ( !this.cache['thread-done-'+container.data('thread')] ) {
        var dashboard = this;
        var thread_id = container.data('thread');
        return $.get(bb.url_for.thread_show({ thread_id: thread_id, goto: 'newpost' })).then(function(html) {
            // first run - get highest post ID:
            return bb.thread_posts( thread_id, html ).then(function(posts) {
                dashboard.cache['thread-done-'+thread_id] = posts[posts.length-1].post_id;
                dashboard.update_cache();
            });
        });
    }

}

Dashboard.prototype.thread_done = function(bb, container, undo) {
    this.cache['thread-done-'+container.data('thread')] = container.data( undo ? 'undone_id' : 'done_id' );
}

Dashboard.prototype.thread_refresh = function(bb, container) {

    var dashboard = this, thread_id = container.data( 'thread' );

    return bb.thread_whoposted(thread_id).then(function(who_posted) {

        // thread pages are very expensive to load - we use the "who posted" page as a cheaper way to generate a signature:
        var signature = who_posted.total + ',' + who_posted.users.map(function(user) { return user.post_count }).join();

        if ( container.data('signature') == signature ) return;

        var read_post_id = dashboard.cache['thread-done-'+thread_id];
        container.data( 'undone_id', read_post_id );

        return $.get(bb.url_for.thread_show({ thread_id: thread_id, post_id: read_post_id })).then(function(html) {
            return bb.thread_posts( thread_id, html ).then(function(posts) {

                container.data( 'signature', signature );
                container.data( 'done_id', posts[posts.length-1].post_id );

                posts = posts.filter(function() { return this.post_id > read_post_id });
                if ( container.data('filter') ) posts = container.data('filter')(posts);

                return posts.map(function(post) { return this.container_element });

            });
        });

    });

}

/*
 * FORUM MONITORING
 */

Dashboard.prototype.forum_done = function(bb, container, undo) {
    this.cache['forum-done-'+container.data('forum')] = container.data( undo ? 'undone_id' : 'done_id' );
}

Dashboard.prototype.forum_refresh = function(bb, container) {

    var dashboard = this, forum_id = container.data('forum');

    // forum pages are less expensive than thread pages, so we don't bother caching them:
    var read_post_id = dashboard.cache['forum-done-'+forum_id];

    return bb.forum_threads(forum_id, true).then(function(threads) {

        var min_thread_id = container.data('min_thread_id') || 0;
        var last_post_ids = threads.map(function(thread) { return thread.last_post_id });

        // ignore if unchanged
        if ( dashboard.cache['forum-min-thread-'+forum_id] == min_thread_id && container.data('signature') == last_post_ids.join() ) return;
        container.data( 'signature',  last_post_ids.join() );

        container.data(   'done_id', Math.max.apply( Math, last_post_ids ) );
        container.data( 'undone_id', read_post_id );
        dashboard.cache['forum-min-thread-'+forum_id] = min_thread_id;

        if ( read_post_id ) threads = threads.filter(function(thread) { return thread.last_post_id > read_post_id });
        if ( min_thread_id ) threads = threads.filter(function(thread) { return thread.thread_id >= min_thread_id });
        if ( container.data('filter') ) threads = container.data('filter')(threads);

        return threads.map(function(thread) { return thread.container_element });

    });
}

/*
 * RECENT ACTIVITY MONITORING
 */

Dashboard.prototype.activity_done = function(bb, container, undo) {
    this.cache['activity-done'] = container.data( undo ? 'undone_id' : 'done_id' );
}

Dashboard.prototype.activity_refresh = function(bb, container) {

    var dashboard = this, activity_id = container.data('activity');

    // activity pages are less expensive than thread pages, so we don't bother caching them:
    var max_read = dashboard.cache['activity-done'] || [ 0, 0, 0 ];
    if ( !$.isArray(max_read) ) max_read = [ max_read, 0, 0 ]; // upgrade old values, can be deleted after 2015-10-21

    return bb.activity(max_read[0]+1, max_read[1]+1).then(function(activity_data) {

        container.data( 'undone_id', max_read );
        container.data(   'done_id', [
            Math.max( max_read[0], activity_data.max_date      ),
            Math.max( max_read[1], activity_data.max_post_id   ),
            Math.max( max_read[2], activity_data.max_thread_id )
        ]);

        var posts = activity_data.posts;

        // Activity filter may not remove all posts, so we have to filter ourselves:
        posts = posts.filter(function(post) { return post.post_id ? post.post_id > max_read[1] : post.thread_id > max_read[2] });

        if ( container.data('filter') ) posts = container.data('filter')(posts);

        return posts.map(function(post) { return post.container_element });

    });

}

/*
 * NEWBIE MONITORING
 */

Dashboard.prototype.newbies_init = function(bb, container) {

    var dashboard = this;

    container.data( 'template', container.find( '.template' ).removeClass( 'template' ).detach() );

    if ( (dashboard.cache['newbies-data-version']||0) != 1 ) {
        delete dashboard.cache['newbies-next'];
        dashboard.cache['newbies-data-version'] = 1;
    }

    if ( !dashboard.cache['newbies-next'] ) {
        dashboard.cache['newbies-current'] = [];
        if ( container.data('min_user_id') ) {
            dashboard.cache['newbies-next'] = container.data('min_user_id') + 1;
            dashboard.update_cache();
        } else {
            // first run - get min_user_id if possible, else set it to the next user ID that will be created:
            return bb.users_list_new()
                .then(function(users) {
                    dashboard.cache['newbies-next'] = users[0].user_id + 1;
                    dashboard.update_cache();
                });
        }
    }

}

Dashboard.prototype.newbies_done = function(bb, container, undo) {
    this.cache['newbies-current'] = undo ? container.data( 'newbies-current' ) : [];
}

Dashboard.prototype.newbies_refresh = function(bb, container) {

    var dashboard = this;

    var current_users = dashboard.cache['newbies-current'];

    // approximate amount of time to spend downloading new user accounts:
    var end_time = new Date().getTime() + 10000;
    var user_count = 0;

    // get a new user account (called recursively until the time limit is reached):
    function get_user(user_info, users) {

        if ( user_info ) {
            ++user_count;

            return $.when.apply( $, // get user info about suspected duplicate accounts
                users.map(function(user) {
                    return bb.user_info(user.user_id).then(function(info) {
                        user.suspiciousness = (
                            ( info.is_banned        && 8 ) | // same IP as a currently-banned user - DODGEY!
                            ( info.infraction_count && 4 ) | // same IP as an infracted user - probably dodgey
                            ( info.   warning_count && 2 ) | // same IP as a user with a warning - might well be dodgey
                                                       1     // same IP as another user - could be dodgey
                        );
                        user.info = info;
                    });
                }).concat(
                    users.map(function(user) {
                        return bb.user_moderation_info(user.user_id).then(function(info) {
                            user.moderation_info = info;
                        });
                    })
                )
            ).then(function() {
                if ( users.length ) {
                    users.sort(function(a,b) { return b.suspiciousness - a.suspiciousness || a.username.localeCompare(b.username) });
                    user_info.suspiciousness = users[0].suspiciousness;
                } else {
                    user_info.suspiciousness = 0;
                }

                user_info.suspected_duplicates = users;
                ++dashboard.cache['newbies-next'];
                current_users.push(user_info);
                dashboard.update_cache();

                if ( new Date().getTime() < end_time ) {
                    // get another account
                    return $.when(
                        bb.user_moderation_info(           dashboard.cache['newbies-next']  ),
                        bb.user_overlapping    ({ user_id: dashboard.cache['newbies-next'] })
                    ).then(get_user);
                }
            });

        }

    };

    function get_newbies(user_id) {

        if ( dashboard.cache['newbies-next'] < user_id )
            dashboard.cache['newbies-next'] = user_id;

        current_users = current_users.filter(function(user) {
            if ( user.user_id >= user_id ) return true
            container.data( 'signature', false );
            return false;
        });

        return $.when(
            bb.user_moderation_info(           dashboard.cache['newbies-next']  ),
            bb.user_overlapping    ({ user_id: dashboard.cache['newbies-next'] })
        ).then(get_user).then(function() {

            // If the section has already been initialised and there are no new users, return unchanged:
            if ( container.data( 'signature' ) && !user_count ) return;
            container.data( 'signature', true );

            current_users.sort(function (a,b) {
                if ( a.suspected_duplicates.filter(function(user) { return user.user_id == b.user_id }).length ) {
                    // groups of duplicate users are sorted by activity time
                    return b.activity_date - a.activity_date;
                } else {
                    return b.suspiciousness - a.suspiciousness || a.username.localeCompare(b.username);
                };
            });

            container.data( 'newbies-current', current_users );

            var template = container.data( 'template' );

            var users = current_users.map(function(user) {
                return $.extend( { element: template.clone() }, user );
            });

            if ( container.data('filter') ) users = container.data('filter')(users);

            return users.map(function(user) { return user.element });

        });

    }

    return get_newbies( container.data('min_user_id') || 0 );

}

/*
 * POST QUEUE MONITORING
 */

Dashboard.prototype.mod_queue_done = function(bb, container, undo) {
    this.cache['moderated-next-post'  ] = container.data( undo ?   'post-undone' :   'post-done' );
    this.cache['moderated-next-thread'] = container.data( undo ? 'thread-undone' : 'thread-done' );
}

Dashboard.prototype.mod_queue_refresh = function(bb, container) {

    var dashboard = this;

    var read_post_id   = dashboard.cache['moderated-next-post'  ];
    var read_thread_id = dashboard.cache['moderated-next-thread'];

    return bb.posts_moderated().then(function(posts_and_threads) {

        var posts = posts_and_threads.posts, threads = posts_and_threads.threads;

        var signature =
            threads.map(function(thread) { return thread.thread_id }).concat(
             posts.map(function(post  ) { return post  .post_id   })
            ).join();
        if ( signature == container.data( 'signature' ) ) return;
        container.data( 'signature', signature );

        container
            .data(   'post-done',   posts.length ? posts  [posts  .length-1].  post_id : read_post_id   )
            .data( 'thread-done', threads.length ? threads[threads.length-1].thread_id : read_thread_id );

        if ( read_post_id   ) posts   = posts  .filter(function(post  ) { return post  .post_id   > read_post_id   });
        if ( read_thread_id ) threads = threads.filter(function(thread) { return thread.thread_id > read_thread_id });

        return threads.map(function(thread) {
            var ret = $('<tr><td><a href=""></a><td><a href=""></a><td><a href=""></a><td><a href=""></a></a></tr>');
            var links = ret.find('a');
            links.eq(0).attr('href', bb.url_for. forum_show({  forum_id: thread. forum_id }) ).text( thread.forum_name );
            links.eq(1).attr('href', bb.url_for.thread_show({ thread_id: thread.thread_id }) ).text( thread.thread_title );
            links.eq(2).attr('href', bb.url_for.thread_show({ thread_id: thread.thread_id }) ).text( '(first post)' );
            links.eq(3).attr('href', bb.url_for.  user_show({   user_id: thread.  user_id }) ).text( thread.username );
            return ret;
        }).concat(posts.map(function(post) {
            var ret = $('<tr><td><a href=""></a><td><a href=""><td><a href=""><td><a href=""></a></a></tr>');
            var links = ret.find('a');
            links.eq(0).attr('href', bb.url_for. forum_show({  forum_id: post. forum_id }) ).text( post.forum_name );
            links.eq(1).attr('href', bb.url_for.thread_show({ thread_id: post.thread_id }) ).text( post.thread_title );
            links.eq(2).attr('href', bb.url_for.  post_show({ thread_id: post.thread_id, post_id: post.post_id }) ).text( post.  post_title || '(no title)' );
            links.eq(3).attr('href', bb.url_for.  user_show({   user_id: post.  user_id }) ).text( post.username );
            return ret;
        }));

    });

}

// Some monitors need more than the default initialisation:
Dashboard.prototype.server_stats_init = function(bb, container) {

    function make_chart( name, data, settings ) {
        var chart = new Chart( container.find('.dashboard-server_stats-'+name+' canvas')[0].getContext("2d") );
        var line = chart.Line(data, settings);
        container.find('.dashboard-server_stats-'+name).append(line.generateLegend());
        container.data( name, line );
    }

    if ( !this.cache['server-stats'] ) { // first run
        this.cache['server-stats'] = {
            labels: [],
                one_minute_loadavg: [],
               five_minute_loadavg: [],
            fifteen_minute_loadavg: [],
            members_online: [],
             guests_online: []
        };
    }

    var values = this.cache['server-stats'];

    make_chart(
        'loadavg',
        {
            labels: values.labels.slice(0),
            datasets: [
                {
                    label: "One-minute load average",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "#f33",
                    pointColor: "#f33",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,222,1)",
                    data: values.one_minute_loadavg
                },
                {
                    label: "Five-minute load average",
                    fillColor: "rgba(220,220,223,0.2)",
                    strokeColor: "#e88",
                    pointColor: "#e88",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,225,1)",
                    data: values.five_minute_loadavg
                },
                {
                    label: "Fifteen-minute load average",
                    fillColor: "rgba(220,220,226,0.2)",
                    strokeColor: "#daa",
                    pointColor: "#daa",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,228,1)",
                    data: values.fifteen_minute_loadavg
                },
            ]
        },
        {
            bezierCurve: true,
            animation: false,
            scaleOverride: true,
            scaleSteps: 10,
            scaleStepWidth: 0.1,
            scaleStartValue: 0
        }
    );

    make_chart(
        'online',
        {
            labels: values.labels.slice(0),
            datasets: [
                {
                    label: "Members online",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "#3f3",
                    pointColor: "#3f3",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: values.members_online
                },
                {
                    label: "Guests online",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "#33f",
                    pointColor: "#33f",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: values.guests_online
                },
            ]
        },
        {
            bezierCurve: true,
            animation: false,
            scaleBeginAtZero: true
        }
    );

}

Dashboard.prototype.server_stats_done = function(bb, container, undo) {}

// called when it's time to refresh the list:
Dashboard.prototype.server_stats_refresh = function(bb, container) {

    var dashboard = this;

    return this.bb.server_stats().then(function(stats) {

        var time = new Date();

        time =
            time.getHours() + ':' +
            ( time.getMinutes() < 10 ? '0' : '' ) + time.getMinutes() + ':' +
            ( time.getSeconds() < 10 ? '0' : '' ) + time.getSeconds()
        ;

        var values = dashboard.cache['server-stats'];
        values.labels.push( time );
        values.    one_minute_loadavg.push( stats.    one_minute_loadavg );
        values.   five_minute_loadavg.push( stats.   five_minute_loadavg );
        values.fifteen_minute_loadavg.push( stats.fifteen_minute_loadavg );
        values.members_online.push( stats.members_online );
        values. guests_online.push( stats. guests_online );

        var loadavg = container.data('loadavg');
        var online  = container.data('online');

        if ( values.labels.length >= 15 ) {
            loadavg.removeData();
            online .removeData();
            Object.keys(values).forEach(function(key) { values[key].shift() });
        }

        dashboard.update_cache();

        loadavg.addData( [ stats.one_minute_loadavg, stats.five_minute_loadavg, stats.fifteen_minute_loadavg ], time );
        online .addData( [ stats.members_online, stats.guests_online                                         ], time );

    });

}

/*
 * PM FOLDER MONITORING
 */

Dashboard.prototype.folder_init = function(bb, container) {

    if ( !this.cache['folder-done-'+container.data('id')] ) {
        var dashboard = this;
        return this.bb.folder_pms(container.data('folder')).then(function(pms) {
            dashboard.cache['folder-done-'+container.data('id')] = pms.length ? pms[0].pm_id : 0;
            dashboard.update_cache();
        });
    }

}

// called when the user clicks the "done" or "undone" button:
Dashboard.prototype.folder_done = function(bb, container, undo) {
    // update the cache so future calls to refresh() act as if the monitor has been (un)done
    this.cache['folder-done-'+container.data('id')] = container.data( undo ? 'undone_id' : 'done_id' );
}

// called when it's time to refresh the list:
Dashboard.prototype.folder_refresh = function(bb, container) {

    var dashboard = this, folder_id = container.data('id');

    var done_id = dashboard.cache['folder-done-'+folder_id];

    return bb.folder_pms(folder_id).then(function(pms) {

        if ( !pms.length || done_id == pms[0].pm_id ) return;

        container.data( 'undone_id', done_id );
        container.data( 'done_id', pms[0].pm_id );

        pms = pms.filter(function(pm) { return pm.pm_id > done_id });
        if ( container.data('filter') ) pms = container.data('filter')(pms);

        return pms.map(function(pm) { return pm.container_element });

    });

}

/*
 * EXAMPLE MONITORING
 */
// Copy/paste this monitor to make your own monitor
// It will be registered and named automatically based on the function names:

/*

// Some monitors need more than the default initialisation:
Dashboard.prototype.example_init = function(bb, container) {
    // init() can optionally return a Deferred object:
    return $.get(...).then(function(html) {
        // 'signature' is set to '' by default, but you can override it:
        container.data( 'signature', $(html).find('.initial-value') );
    });
}

*/

// called when the user clicks the "done" or "undone" button:
Dashboard.prototype.example_done = function(bb, container, undo) {
    // update the cache so future calls to refresh() act as if the monitor has been (un)done
    this.cache['example-data'] = container.data( undo ? 'undone_id' : 'done_id' );
}

// called when it's time to refresh the list:
Dashboard.prototype.example_refresh = function(bb, container) {

    var dashboard = this, example_id = container.data('example');

    var id = dashboard.cache['example-data'];

    return bb.example(/*...*/).then(function(ret) {

        // return an undefined value to indicate the state hasn't changed:
        if ( container.data('signature') == ret.signature ) return;
        container.data( 'signature',  ret.signature );

        // update stored values after checking signature:
        container.data( 'undone_id', id );
        container.data( 'done_id', ret.id );

        // most monitors have use for some kind of filter:
        if ( id ) ret = ret.filter(function(thread) { return ret.id > id });
        if ( container.data('filter') ) ret = container.data('filter')(ret);

        // return an array (or jQuery container) of elements to populate the body:
        return ret.map(function(thread) { /* ... */ });

    });

}
