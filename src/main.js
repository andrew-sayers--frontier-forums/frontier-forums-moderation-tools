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

            var dashboard = $(BabelExt.resources.get('res/dashboard.html'));

            var recently_reported_posts = {};
            var name = $('.welcomelink a').text();

            // Reported posts forum filter
            dashboard.find('[data-forum="reported-posts"]').data( 'filter', function(thread) {

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

            var mod_log_thread_id = v.resolve('policy', 'mod log thread id');
            var report_forum_id = 48;
            dashboard.find( '[data-thread="mod-log"]'              ).data( 'thread', mod_log_thread_id );
            dashboard.find( 'a[href="#insert-mod-log-link"]'       ).attr( 'href', bb.url_for.thread_show({ thread_id: mod_log_thread_id, goto: 'newpost' }) );
            dashboard.find( '[data-forum="reported-posts"]'        ).data( 'forum', report_forum_id );
            dashboard.find( 'a[href="#insert-reported-posts-link"]').attr( 'href', bb.url_for.forum_show({ forum_id: report_forum_id }) );
            dashboard.find( 'a[href="#insert-mod-queue-link"]'     ).attr( 'href', bb.url_for.moderation_posts() );
            dashboard.find( 'a[href="#insert-newbies-link"]'       ).attr( 'href', bb.url_for.users_show() );

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
    pass_storage    : ['variables', 'violations'],
    pass_preferences: [ 'language', 'reload_interval' ],
    callback: function( stash, pathname, params, variables, violations, user_language, reload_interval ) {

        var bb = new VBulletin();

        /*
         * ERROR HANDLER
         */
        var maintainer_user_id = 18617, maintainer_name = 'Andrew Sayers';

        var handle_error_box = $(
            '<div style="display: none; position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); border: 5px solid black; border-radius: 5px; background: white; color: black">' +
                '<h1 style="width: 100%; box-sizing: border-box; border-bottom: 1px solid black; padding: 1em; font-weight: bold">Error!</h1>' +
                '<table style="margin: 1em"><thead style="font-weight: bold"><tr><th>Message</th><th style="padding-left: 1em">Suggested resolutions</th></tr><tbody></tbody></table>' +
                '<a style="float: left; padding: 1em" href="#pm-maintainer">Send debug log to the maintainer</a>' +
                '<a style="float: right; padding: 1em" href="#close-error-box">close</a>' +
            '</div>'
        );
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

            debug_log.log( message, resolutions ).show();
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

        var vi = new Violations({
            v                  : v,
            bb                 : bb,
            cache              : JSON.parse( violations || '{}' ),
            cache_updater      : function(cache) { BabelExt.storage.set( 'violations', JSON.stringify( cache ) ) },
            reload_interval    : reload_interval * 1000,
            error_callback     : handle_error,
            default_user_action: 'warning',
        });

        $.when( vi.promise, v.promise ).then(function() {
            handle_dashboard            ( bb, v, loading_img );
            handle_variables_thread     ( bb, v );
            handle_post_edit            ( bb );
            handle_moderation_links     ();
            handle_moderation_checkboxes();
            handle_modcp_user           ();
            handle_thread_form          ( bb, v, handle_error );
            handle_usernotes_cc         ( bb, v );
            handle_legacy               ( bb, v, vi, loading_html ); // everything that hasn't been refactored yet
        });

    }

});
