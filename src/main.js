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
 * @param {BulletinBoard} bb          Bulletin Board to manipulate
 * @param {Variables}     v           Variables to use
 * @param {string}        loading_img HTML to create the "loading" icon
 */
function handle_dashboard( bb, v, loading_img ) { BabelExt.utils.dispatch(
    {
        match_pathname: '/',
        match_params: {
            do: 'dashboard',
        },
        match_elements: '.below_body',
        pass_storage: ['dashboard_cache'],
        callback: function( stash, pathname, params, below_body, dashboard_cache ) {

            // Dashboard CSS
            bb.css_add([ 'user_show', 'forum_show', 'thread_show' ]);

            function make_dashboard_section_header( link, empty_heading, nonempty_heading, done_text, undone_text ) {
                return (
                    '<h4 class="collapse blockhead options_correct">' +
                        '<span class="loading">'  + 'Loading '       + link + ' ' + loading_img + '</span>' +
                        '<span class="empty">'    +    empty_heading + link + ' <a href="#refresh" class="dashboard-refresh">&nbsp;</a></span>' +
                        '<span class="nonempty">' + nonempty_heading + link + ' <a href="#refresh" class="dashboard-refresh">&nbsp;</a></span>' +
                        '<a href="#mark-done" class="dashboard-done" style="float: right">' +
                            '<span class="done">' + done_text + '</span>' +
                            '<span class="undone">'+ undone_text + '</span>' +
                        '</a>' +
                    '</h4>'
                );
            }

            // Dashboard HTML
            var dashboard = $(

                '<div id="breadcrumb" class="breadcrumb" style="margin-bottom: 1em">' +
                    '<ul class="floatcontainer">' +
                        '<li class="navbithome">' +
                        '<li class="navbit lastnavbit dashboard-header"></li>'+
                    '</ul>'+
                    '<hr>' +

                    '<div class="dashboard-section postlist restrain" data-monitor="thread" data-thread="47517">' +
                        make_dashboard_section_header(
                            '<a href="' + bb.url_for.thread_show({ thread_id: 47517 }) + '">the mod log</a>',
                            'No unread posts in ',
                            'Please read recent posts in ',
                            'Mark log unread',
                            'Mark log read'
                        ) +
                        '<ol class="posts dashboard-body" start="1" style="margin-right: 2px"></ol>' +
                    '</div>' +

                    '<div class="options_block_container"><div class="options_block dashboard-section" data-monitor="forum" data-forum="48" style="width: 100%">' +
                        make_dashboard_section_header(
                            '<a href="' + bb.url_for.forum_show({ forum_id: 48 }) + '">the reported posts forum</a>',
                            'No unchecked threads in ',
                            'Please check threads in ',
                            'Mark all reports unread',
                            'Mark all reports read'
                        ) +
                        '<ol class="threads dashboard-body" start="1" style="margin-right: 2px"></ol>' +
                    '</div></div>' +

                    '<div style="clear: both" class="dashboard-section" data-monitor="mod_queue">' +
                        make_dashboard_section_header(
                            '<a href="' + bb.url_for.moderation_posts() + '">the moderation queue</a>',
                            'No unmoderated posts in ',
                            'Please moderate posts in ',
                            'Mark the queue unmoderated',
                            'Mark the queue moderated'
                        ) +
                        '<table><thead><tr><th>Forum<th>Thread<th>Title<th>author</thead><tbody class="dashboard-body"></tbody></table>' +
                    '</div>' +

                    '<div style="clear: both" class="dashboard-section" data-monitor="newbies">' +
                        make_dashboard_section_header(
                            '<a href="' + bb.url_for.users_show() + '">the member list</a>',
                            'No unvalidated newbies in ',
                            'Please validate newbie names in ',
                            'Unmark newbies valid',
                            'Mark newbies valid'
                        ) +
                        '<table><thead><tr><th>Name<th>e-mail address<th>Also associated with this IP address</thead><tbody class="dashboard-body"></tbody></table>' +
                    '</div>' +

                '</div>'

            );

            // Reported posts forum filter
            dashboard.find('[data-forum="48"]').data( 'filter', function(thread) {

                if ( thread.is_sticky || thread.status ) return false;

                // modify the container elements to make moderation easier
                $('.threadimod', thread.container_element).remove();

                var recently_reported_posts = {};
                thread.title.replace( /\[PID: ([0-9]*)\]/, function(match, pid) {
                    recently_reported_posts['#post_'+pid] = thread.thread_id;
                });

                $( '.threadstatus', this )
                    .css({ cursor: 'pointer' })
                    .attr( 'title', 'double-click to close this thread' )
                    .dblclick(function() {
                        var threadbit = $(this).closest('.threadbit');
                        bb.thread_openclose( thread.thread_id, $(this).closest('.threadbit').hasClass('lock') )
                            .done(function() { threadbit.toggleClass('lock') });
                    });

                /*
                  var title_suffix =
                  v.resolve('report process', 'report title suffix', { moderator: 'ANY_MODERATOR' })
                  .replace( /([.*+?^${}()|\[\]\/\\])/g, "\\$1" )
                  .replace( 'ANY_MODERATOR', '.*' )

                  if ( thread.title.search( title_suffix ) == -1 ) {
                  $('<a title="Click to take this thread" class="newcontent_textcontrol" rel="nofollow" href="newreply.php?t='+thread.thread_id+'&noquote=1" style="float:right">Take this report</a>')
                  .click(function(event) {
                  stash.take_thread_and_go( this.href, thread_id );
                  event.preventDefault();
                  })
                  .insertAfter(this);
                  }
                */

                return true;
            });

            // log in to ModCP before loading the dashboard (which will then keep us logged in)
            body_wrapper = $('.body_wrapper').html( '<iframe style="margin:auto"></iframe>' );
            bb.moderation_page( body_wrapper.find('iframe'), '/modcp/index.php?do=nav', '.navlink', '.navlink' ).then(function() {

                document.title = 'Dashboard';
                body_wrapper.empty().append(dashboard);
                new Dashboard({
                    cache        : JSON.parse( dashboard_cache || '{}' ),
                    cache_updater: function(cache) { BabelExt.storage.set( 'dashboard_cache', JSON.stringify( cache ) ) },
                    container: body_wrapper,
                    interval : 60000,
                    bb       : bb

                });

            });

        }
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
                'This thread contains variables used by the moderation tools.<br>' +
                '<br>' +
                'To edit an existing variable:<br>' +
                '<ol>' +
                    '<li>Search for a [quote] block attributed to your variable name' +
                    '<li>Edit the post containing that block' +
                    '<li>Make your changes' +
                    '<li>Save the new post' +
                    '<li>Load a page that uses your variable, and make sure it works as expected' +
                    '<li>Bump this thread so others will see your change' +
                '</ol>' +
                '<br>' +
                'To create a new variable:' +
                '<ol>' +
                    '<li>Edit an existing post or create a new one' +
                    '<li>Add a new piece of text like [quote=(name of your variable)](contents of your variable)[/quote]' +
                    '<li>Save the new post' +
                    '<li>Load a page that uses your variable, and make sure it works as expected' +
                    '<li>Bump this thread so others will see your change' +
                '</ol>' +
                '<div style="width: 100%; text-align: center; margin: 1em"><a class="newcontent_textcontrol" href="#bump-thread" title="Click to bump this thread" style="float: none; display: inline; text-decoration: none; font-size: 200%">Bump&nbsp;this&nbsp;thread</a></div>'
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
                    $('#deltype_soft').prop( 'checked', true )
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
 * @summary Link to Moderated Posts page from moderation links
 */
function handle_moderation_links() {
    $(function(){$('img[src="images/misc/moderated.gif"],img[src="images/misc/moderated_small.gif"]').wrap('<a href="/modcp/moderate.php?do=posts"></a>')});
}

/*
 * MAIN BLOCK
 */
BabelExt.utils.dispatch({ // initialise general stuff
    pass_storage    : ['variables'],
    pass_preferences: [ 'language', 'reload_interval' ],
    callback: function( stash, pathname, params, variables, user_language, reload_interval ) {
        // First we retrieve storage and preferences needed everywhere

        /*
         * ERROR HANDLER
         * We make a simple HTML error handler because Chrome doesn't let you copy/paste alert() boxes
         */
        var handle_error_box = $(
            '<div style="display: none; position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); border: 5px solid black; border-radius: 5px; background: white; color: black">' +
                '<h1 style="width: 100%; box-sizing: border-box; border-bottom: 1px solid black; padding: 1em; font-weight: bold">Error!</h1>' +
                '<table style="margin: 1em"><thead style="font-weight: bold"><tr><th>Message</th><th style="padding-left: 1em">Suggested resolutions</th></tr><tbody></tbody></table>' +
                '<a style="float: right; padding: 1em" href="#close-error-box">close</a>' +
            '</div>'
        );
        $(function() { handle_error_box.appendTo(document.body) });
        handle_error_box.find('a').click(function(event) {
            handle_error_box.hide();
            event.preventDefault();
        });

        function handle_error( message, resolutions ) {

            var row = $('<tr><td><td style="padding-left: 1em"></tr>').appendTo(handle_error_box.find('tbody'));
            row.children('td').first().text( message );
            row.children('td'). last().html(
                ( resolutions || [] ).map(function(resolution) {
                    return $('<a>').text( resolution.message ).attr( 'href', resolution.href );
                })
            ).children(':not(:last-child)').after(', ');
            $(function() { handle_error_box.show() });

            throw message;

        }

        /*
         * GENERAL VARIABLES
         */

        var loading_img  = '<img src="images/misc/progress.gif" alt="loading, please wait">';
        var loading_html = loading_img + ' Loading';

        var bb = new VBulletin();

        var next_week = new Date();
        next_week.setDate(next_week.getDate()+7);

        var v = new VariablesFromForum({
            bb              : bb,
            forum_id        : 70,
            cache           : JSON.parse( variables || '{}' ),
            cache_updater   : function(cache) { BabelExt.storage.set( 'variables', JSON.stringify( cache ) ) },
            reload_interval : reload_interval * 1000,
            error_callback  : handle_error,
            default_language: user_language,
            default_keys    : {
                origin     : location.origin,
                'next week': next_week.toUTCString().replace(/:[0-9][0-9] /, ' ' )
            }
        });

        v.promise.then(function() {
            handle_dashboard            ( bb, v, loading_img );
            handle_variables_thread     ( bb, v );
            handle_post_edit            ( bb );
            handle_moderation_links     ();
            handle_moderation_checkboxes();
            handle_modcp_user           ();
            handle_legacy               ( bb, v, loading_html ); // everything that hasn't been refactored yet
        });

    }

});
