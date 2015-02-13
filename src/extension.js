// This file is currently being refactored.  Search for "LEGACY CODE" to see where the old code starts

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

/*
 * HANDLE THE DASHBOARD PAGE
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
            $("head").append(
                "<style type='text/css'>" +
                    '.dashboard-section .nonempty, .dashboard-section .empty, .dashboard-section .loading, .dashboard-section .done, .dashboard-section .undone { display: none }' +
                    '.dashboard-section.empty table, .dashboard-section.empty.loading .dashboard-body, .dashboard-section.empty.loading .empty { display: none }' +
                    '.dashboard-section.nonempty .nonempty, .dashboard-section.empty .empty, .dashboard-section.loading .loading, .dashboard-section.done .done, .dashboard-section.undone .undone { display: inline }' +
                    '.dashboard-section h4 { clear: both }' +
                    '.dashboard-section.done .dashboard-body, .dashboard-section.done table { display: none }' +
                "</style>"
            );

            function make_dashboard_section_header( link, empty_heading, nonempty_heading, done_text, undone_text ) {
                return (
                    '<h4 class="collapse blockhead options_correct">' +
                        '<span class="loading">'  + 'Loading '       + link + ' ' + loading_img + '</span>' +
                        '<span class="empty">'    +    empty_heading + link + ' <a href="#refresh" class="dashboard-refresh"><img style="vertical-align: top" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAI/SURBVDjLjZPbS9NhHMYH+zNidtCSQrqwQtY5y2QtT2QGrTZf13TkoYFlzsWa/tzcoR3cSc2xYUlGJfzAaIRltY0N12H5I+jaOxG8De+evhtdOP1hu3hv3sPzPO/z4SsBIPnfuvG8cbBlWiEVO5OUItA0VS8oxi9EdhXo+6yV3V3UGHRvVXHNfNv6zRfNuBZVoiFcB/3LdnQ8U+Gk+bhPVKB3qUOuf6/muaQR/qwDkZ9BRFdCmMr5EPz6BN7lMYylLGgNNaKqt3K0SKDnQ7us690t3rNsxeyvaUz+8OJpzo/QNzd8WTtcaQ7WlBmPvxhx1V2Pg7oDziIBimwwf3qAGWESkVwQ7owNujk1ztvk+cg4NnAUTT4FrrjqUKHdF9jxBfXr1rgjaSk4OlMcLrnOrJ7latxbL1V2lgvlbG9MtMTrMw1r1PImtfyn1n5q47TlBLf90n5NmalMtUdKZoyQMkLKlIGLjMyYhFpmlz3nGEVmFJlRZNaf7pIaEndM24XIjCOzjX9mm2S2JsqdkMYIqbB1j5C6yWzVk7YRFTsGFu7l+4nveExIA9aMCcOJh6DIoMigyOh+o4UryRWQOtIjaJtoziM1FD0mpE4uZcTc72gBaUyYKEI6khgqINXO3saR7kM8IZUVCRDS0Ucf+xFbCReQhr97MZ51wpWxYnhpCD3zOrT4lTisr+AJqVx0Fiiyr4/vhP4VyyMFIUWNqRrV96vWKXKckBoIqWzXYcoPDrUslDJoopuEVEpIB0sR+AuErIiZ6OqMKAAAAABJRU5ErkJggg=="></a></span>' +
                        '<span class="nonempty">' + nonempty_heading + link + ' <a href="#refresh" class="dashboard-refresh"><img style="vertical-align: top" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAI/SURBVDjLjZPbS9NhHMYH+zNidtCSQrqwQtY5y2QtT2QGrTZf13TkoYFlzsWa/tzcoR3cSc2xYUlGJfzAaIRltY0N12H5I+jaOxG8De+evhtdOP1hu3hv3sPzPO/z4SsBIPnfuvG8cbBlWiEVO5OUItA0VS8oxi9EdhXo+6yV3V3UGHRvVXHNfNv6zRfNuBZVoiFcB/3LdnQ8U+Gk+bhPVKB3qUOuf6/muaQR/qwDkZ9BRFdCmMr5EPz6BN7lMYylLGgNNaKqt3K0SKDnQ7us690t3rNsxeyvaUz+8OJpzo/QNzd8WTtcaQ7WlBmPvxhx1V2Pg7oDziIBimwwf3qAGWESkVwQ7owNujk1ztvk+cg4NnAUTT4FrrjqUKHdF9jxBfXr1rgjaSk4OlMcLrnOrJ7latxbL1V2lgvlbG9MtMTrMw1r1PImtfyn1n5q47TlBLf90n5NmalMtUdKZoyQMkLKlIGLjMyYhFpmlz3nGEVmFJlRZNaf7pIaEndM24XIjCOzjX9mm2S2JsqdkMYIqbB1j5C6yWzVk7YRFTsGFu7l+4nveExIA9aMCcOJh6DIoMigyOh+o4UryRWQOtIjaJtoziM1FD0mpE4uZcTc72gBaUyYKEI6khgqINXO3saR7kM8IZUVCRDS0Ucf+xFbCReQhr97MZ51wpWxYnhpCD3zOrT4lTisr+AJqVx0Fiiyr4/vhP4VyyMFIUWNqRrV96vWKXKckBoIqWzXYcoPDrUslDJoopuEVEpIB0sR+AuErIiZ6OqMKAAAAABJRU5ErkJggg=="></a></span>' +
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

/*
 * HANDLE VARIABLES THREADS
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



/*
 * Link to Moderated Posts page from moderation links
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
            handle_dashboard       ( bb, v, loading_img );
            handle_variables_thread( bb, v );
            handle_moderation_links();
            handle_legacy          ( bb, v, loading_html );
        });

    }

});

/*
 * LEGACY CODE
 * Everything below this line is part of the old implementation, and needs to be refactored.
 */
function handle_legacy( bb, v, loading_html ) { BabelExt.utils.dispatch(

    /*
     * GENERAL UTILITIY FUNCTIONS
     */
    {
        pass_storage: ['infractions'],
        callback: function( stash, pathname, params, infractions ) {

            /*
             * Legacy compatibility:
             */
            stash.modcp_url = function(url) { return '/modcp/' + url }

            /**
             * @summary Return a list of strings containing <a> elements linking to lists of known spammers
             * @param {string}  ip          IP address to search for
             * @param {string}  name        account name to search for (only supported by some sites)
             * @param {string=} prefix_text Text to prepend to the body of each link (default: 'Check&nbsp;on&nbsp;')
             * @return {Array.<string>}
             */
            var spam_list_links_initialised = 0;
            stash.spam_list_links = function( ip, name, prefix_text ) {

                if ( prefix_text === undefined ) prefix_text = 'Check&nbsp;on&nbsp;';

                if ( !spam_list_links_initialised++ ) {
                    BabelExt.utils.runInEmbeddedPage(
                        'window.stop_forum_spam_callback = ' +
                            function stop_forum_spam_callback(data) {
                                var response = [];
                                if ( data.success ) {
                                    switch ( ( data.username || { frequency: -1 } ).frequency ) {
                                    case -1: break;
                                    case 0: response.push('username does not appear in the list'); break;
                                    case 1: response.push('username appears once in the list'); break;
                                    default: response.push('username appears ' + data.username.frequency + ' times in the list'); break;
                                    }
                                    switch ( ( data.ip || { frequency: -1 } ).frequency ) {
                                    case -1: break;
                                    case 0: response.push('IP address does not appear in the list'); break;
                                    case 1: response.push('IP address appears once in the list'); break;
                                    default: response.push('IP address appears ' + data.ip.frequency + ' times in the list'); break;
                                    }
                                } else {
                                    response.push('Could not contact server');
                                }
                                alert(response.join("\n"));
                            }
                    );

                    BabelExt.utils.runInEmbeddedPage(
                        'window.stop_forum_spam_check_callback = ' +
                            function stop_forum_spam_check_callback() {
                                document.body.setAttribute( 'stopforumspam-working', '' );
                            }
                    );
                    $.ajax({ url: 'https://api.stopforumspam.org/api?ip=127.0.0.1&f=json', dataType: "jsonp", jsonpCallback: 'stop_forum_spam_check_callback' });

                    $(document).on( 'click', '.stopforumspam', function(event) {
                        if ( document.body.hasAttribute('stopforumspam-working') || !confirm(
                            "Could not connect to api.stopforumspam.com - this is probably caused by a known permissions error on their site.\n" +
                            "Go there now to override the security settings?"
                        ) ) {
                            $.ajax({ url: this.href, dataType: "jsonp", jsonpCallback: 'stop_forum_spam_callback' });
                            event.preventDefault();
                        }
                    });

                }

                return [
                    '<a class="stopforumspam" href="//api.stopforumspam.org/api?ip=' + encodeURIComponent(ip) + '&amp;username=' + encodeURIComponent(name) + '&amp;f=json">' + prefix_text + 'StopForumSpam</a>',
                    '<a href="http://multirbl.valli.org/lookup/' + encodeURIComponent(ip) + '.html">' + prefix_text + 'MultiRBL</a>',
                    '<a href="https://www.projecthoneypot.org/ip_' + encodeURIComponent(ip) + '">' + prefix_text + 'Project&nbsp;Honeypot</a>'
                ];

            }

            /*
             * Take a thread, then go to that thread
             */
            stash.take_thread_and_go = function( url, thread_id, flip_thread_openness ) {
                return bb.thread_reply({
                    thread_id: thread_id,
                    title    : v.resolve('report process', 'post title: take report', {}, 'string', undefined, thread_id ),
                    bbcode   : v.resolve('report process', 'post body: take report' , {}, 'string', undefined, thread_id ),
                    url      : url,
                    flip_thread_openness: flip_thread_openness
                });
            }

            // HTML to display for "mark read" buttons:
            stash.mark_read_html = '<input style="width: 100%; padding: 0.5em;" type="button" class="mark-read" value="mark read">';

            /*
             * Convert a clickable link to click for menu/double-click for link
             */
            var has_link_css = 0;
            stash.convert_link_to_menu = function( element, link_title ) {
                if ( !has_link_css++ ) {
                    $("head").append(
                        "<style type='text/css'>" +
                            '.mod-tools-menu { display: inline-block }' +
                            '.mod-tools-menu ul.popupbody.memberaction_body { left: inherit; top: inherit; width: inherit }' +
                            '.mod-tools-menu ul.popupbody.memberaction_body li { width: inherit }' +
                            '.mod-tools-menu ul.popupbody.memberaction_body li a { padding: 4px 0; display: inline-block; width: 100%; margin: 0 }' +
                        "</style>"
                    );
                }
                element
                    .attr( 'title', 'click for menu, double-click to go to ' + link_title )
                    .click(function(event) {
                        if ( $(this).hasClass('mod-friend-active') ) {
                            $(this).removeClass( 'mod-friend-active' );
                            $(this.nextElementSibling).hide();
                        } else {
                            $(this).addClass( 'mod-friend-active' );
                            $(this.nextElementSibling).show();
                        }
                        event.preventDefault();
                    })
                    .dblclick(function(event) {
                        location = this.href;
                        event.preventDefault();
                    });
            }


            /*
             * USER REPORT (as seen on e.g. the report page)
             */


            stash.get_member_info = function(user_id) {
                return $.get('/member.php?u='+user_id+'&tab=infractions&pp=50').then(function(html) {
                    html = $(html);
                    var ret = {
                        stats : html.find('#view-stats_mini'),
                        joined: $.trim(html.find( '.userinfo dd' ).first().text()),
                        title : $.trim(html.find('#userinfo .usertitle').text()),

                        user_note_count: html.find('a[href="usernote.php?u='+user_id+'"]').text().replace( /.*\(([0-9])+\).*/, "$1" ),

                        summary: ' <a href="/member.php?u=' + user_id + '">' + BabelExt.utils.escapeHTML(html.find('.member_username').text()) + '</a>',

                        infraction_count  : 0,
                        warning_count     : 0,
                        infraction_summary: ''

                    };
                    ret.join_summary = 'joined ' + BabelExt.utils.escapeHTML(ret.joined) + ', ' + BabelExt.utils.escapeHTML(ret.title);
                    switch ( ret.user_note_count ) {
                    case '0': ret.summary += ' (no user notes)'; break;
                    case '1': ret.summary += ' (<a href="/usernote.php?u='+user_id+'">1 user note</a>)'; break;
                    default:  ret.summary += ' (<a href="/usernote.php?u='+user_id+'">' + ret.user_note_count + ' user notes</a>)'; break;
                    }
                    if ( html.find('.infractions_block').length ) {
                        var infractions = html.find('#infractionslist .inflistexpires').filter(function() { return $(this).text().search(/Expired|Reversed/) == -1 }).closest('li');
                        ret.infractions_block = html.find('.infractions_block');
                        ret.infraction_count   = infractions.length;
                        ret.warning_count      = infractions.has('img.inlineimg[src="images/misc/yellowcard_small.gif"]').length;
                        ret.infraction_summary += (
                            infractions.closest('li').map(function() {
                                var info = $(this).find('.inflistinfo');
                                var date = $(this).find('.inflistdate');
                                date.find('.postby').remove();
                                if ( info.find('a').length ) { // post-related infraction
                                    return (
                                        '<a href="'    + BabelExt.utils.escapeHTML(info.find('a').attr('href')) +
                                            '" title="'     + BabelExt.utils.escapeHTML($.trim(date.text()) + ': ' + info.find('em').text()) +
                                            '"><img src="/' + BabelExt.utils.escapeHTML(info.find('img').attr('src')) +
                                            '"></a>'
                                    );
                                } else {
                                    return (
                                        '<span title="'     + BabelExt.utils.escapeHTML($.trim(date.text()) + ': ' + info.find('em').text()) +
                                            '"><img src="/' + BabelExt.utils.escapeHTML(info.find('img').attr('src')) +
                                            '"></span>'
                                    );
                                }
                            }).get().reverse().join('')
                        );
                    }

                    if ( html.find('#usermenu a[href^="modcp/banning.php?do=liftban"]').length ) {
                        return $.get( stash.modcp_url( 'banning.php?do=editreason&userid=' + user_id ) ).then(function(html) {
                            ret.infraction_summary = '<span style="color: red">BANNED: ' + BabelExt.utils.escapeHTML($.trim($(html).find( '#it_reason_1' ).val())) + '</span>'
                            ret.summary = ret.infraction_summary + ret.summary;
                            return ret;
                        });
                    } else {
                        ret.summary = ret.infraction_summary + ret.summary;
                        return ret;
                    }
                });
            }

            stash.build_user_report = function( username_html, username_text, user_id, container ) {

                $("head").append(
                    "<style type='text/css'>" +
                        '#reviewed-user-info ul, #reviewed-user-info ol, #reviewed-user-info dl { margin: 0 }' +
                    "</style>"
                );
                container.html(
                    '<blockquote id="reviewed-user-info" class="postcontent">' +
                        '<div id="user-info">'+ loading_html + ' information about ' + username_html + '</div>' +
                        '<div id="duplicate-account-info" style="clear: both">' + loading_html + ' duplicate account report</div>' +
                    '</div>'
                );

                // Log in to ModCP and get the user's info page
                var iframe = $('<iframe></iframe>').insertBefore(container.find('.postcontent')); // TODO: refactor to get this back out of the promise
                var modcp_promise = bb.moderation_page(
                    iframe,
                    '/modcp/user.php?do=viewuser&u='+user_id
                );

                /*
                 * Build the duplicate account report
                 */
                modcp_promise.progress(function() {
                    // fired as soon as we've logged in
                    bb.user_ips(username_text, true).then(function(user_data) {
                        if ( user_data.unique_ip_count == user_data.used_ip_count ) {
                            container.find('#duplicate-account-info').html( '(no duplicate accounts detected)' );
                            return;
                        }

                        var known_names = {};
                        var promise_count = 1;
                        var infraction_data = {}, address_data = {};
                        known_names[ user_id ] = 0;

                        var member_info;
                        var overlapping_user_ips = {};
                        var overlapping_user_info = {};
                        var overlapping_user_emails = {};

                        $.when.apply( $,
                            [ stash.get_member_info(user_id).done(function(info) { member_info = info }), modcp_promise ].concat(
                            Object.keys(user_data.overlapping_users).map(function(user) {
                                return stash.get_member_info(user_data.overlapping_users[user].user_id).done(function(user_data) {
                                    overlapping_user_info[user] = user_data;
                                });
                            })).concat(
                            Object.keys(user_data.overlapping_users).map(function(user) {
                                return bb.user_ips(user, false).done(function(user_data) {
                                    overlapping_user_ips[user] = user_data;
                                });
                            })).concat(
                            Object.keys(user_data.overlapping_users).map(function(user) {
                                return $.get( stash.modcp_url( 'user.php?do=viewuser&u=' + user_data.overlapping_users[user].user_id ) ).done(function(html) {
                                    overlapping_user_emails[user] = $(html).find('input[name="user\\[email\\]"]').val();
                                })
                            }))
                        ).then(function() {
                            var email = BabelExt.utils.escapeHTML( $(iframe[0].contentDocument.body).find('input[name="user\\[email\\]"]').val() );
                            var email_parts = email.split('@');
                            v.resolve('internal extension data', 'common e-mail domains', {}, 'array of items').forEach(function(domain) { if ( email_parts[1] == domain.value ) email_parts[1] = 'example.com'; });
                            email_parts = [
                                new RegExp( '^(' + email_parts[0].replace( /([.*+?^${}()|\[\]\/\\])/g, "\\$1" ) + ')@' ),
                                new RegExp( '@(' + email_parts[1].replace( /([.*+?^${}()|\[\]\/\\])/g, "\\$1" ) + ')$' )
                            ];
                            container.find('#duplicate-account-info').html(
                                '<div style="font-size: larger; font-weight: bold; clear: both; margin-top: 0.5em">Possible duplicate accounts</div>' +
                                '<div style="margin: 0.5em 0" >The following users have used the same IP address as <i>' + username_html + '</i>.  That might just mean they\'re friends that have checked the forums from each others\' houses, but it can be a useful lead when looking for duplicate accounts.  If they have any active infractions, you can hover over the icons to see the date and reason.</div>' +
                                '<ul style="margin-left: 1em"><li style="list-style:disc">' + member_info.summary +
                                ' &lt;<a href="mailto:' + email + '">' + email + '</a>&gt;' +
                                ' has used ' + user_data.used_ip_count + ' IP address(es) ' +
                                ' - ' + member_info.join_summary +
                                '<ul style="margin-left:1em">' + Object.keys(user_data.overlapping_users).map(function(name) {
                                    var overlap_data = user_data.overlapping_users[name];
                                    var  member_info =       overlapping_user_info[name];
                                    var      ip_data =       overlapping_user_ips [name];
                                    var email        =     overlapping_user_emails[name];
                                    email = BabelExt.utils.escapeHTML(email).replace( email_parts[0], "<b>$1</b>@").replace( email_parts[1], "@<b>$1</b>"); // highlight similar parts of an e-mail address
                                    var registration_message = '';
                                    if ( ip_data.registration_ip == user_data.registration_ip ) {
                                        registration_message = ', both registered from the same IP address';
                                    } else if ( user_data.used_ips.filter(function() { return this == ip_data.registration_ip }).length ) {
                                        if ( ip_data.used_ips.filter(function() { return this == user_data.registration_ip }).length ) {
                                            registration_message = ', both registered from addresses used by each other';
                                        } else {
                                            registration_message = ', registered from an address used by ' + username_html;
                                        }
                                    } else if ( ip_data.used_ips.filter(function() { return this == user_data.registration_ip }).length ) {
                                        registration_message = ' including the address ' + username_html + ' registered from';
                                    }
                                    return '<li style="list-style:disc">' + member_info.summary +
                                        ' &lt;<a href="mailto:' + email + '">' + email + '</a>&gt;' +
                                        ' has shared ' + overlap_data.addresses.length + '/' + ip_data.used_ip_count + ' address(es)' + registration_message +
                                        ' - ' + member_info.join_summary +
                                        ' - <a href="#more-info" class="more-info" data-name="' + BabelExt.utils.escapeHTML(name) + '">more info</a>' +
                                        '</li>';
                                }).join('') + '</ul></li></ul>');
                            container.find('#duplicate-account-info .more-info').one( 'click', function(event) {
                                var table_container = $('<div>' + loading_html + '</div>').insertAfter(this);
                                $(this).click(function(event) {
                                    table_container.toggle();
                                    event.preventDefault();
                                });

                                var name = $(this).data('name');

                                // Sort addresses used by which user(s) have used them and which user(s) were registered there
                                var scored_addresses = {};
                                [
                                    [ [ user_data.registration_ip, 8 ] ],
                                    user_data                 .used_ips.map(function() { return [ [ this, 4 ] ] }).get(),
                                    [ [ overlapping_user_ips[name].registration_ip, 2 ] ],
                                    overlapping_user_ips[name].used_ips.map(function() { return [ [ this, 1 ] ] }).get(),
                                ].forEach(function(address_scores) {
                                    address_scores.forEach(function(address_score) {
                                        if ( !scored_addresses.hasOwnProperty(address_score[0]) ) scored_addresses[address_score[0]] = 0;
                                        scored_addresses[address_score[0]] += address_score[1];
                                    });
                                });

                                bb.when(Object.keys(scored_addresses).map(function(address) { return bb.ip_users(address) })).done(function(addresses) {

                                    addresses.sort(function(a,b) { return scored_addresses[b.ip] - scored_addresses[a.ip] || a.domain_name.localeCompare(b.domain_name) });

                                    table_container.html(
                                            '<table style="text-align: center">' +
                                            '<thead><th>Address<th style="padding:0 1em">' + username_html + '<th style="padding:0 1em">' + BabelExt.utils.escapeHTML(name) + '<th style="padding:0 1em">Check on...<th style="padding:0 1em">Also used by</tr></thead><tbody>' +
                                            addresses.map(function(address) {
                                                var ret = '<tr><th style="text-align: right">' + address.domain_name;
                                                if ( scored_addresses[address.ip] & 8 ) ret += '<td style="padding:0 1em">registered';
                                                else if ( scored_addresses[address.ip] & 4 ) ret += '<td style="padding:0 1em">yes';
                                                else ret += '<td style="padding:0 1em">';
                                                if ( scored_addresses[address.ip] & 2 ) ret += '<td style="padding:0 1em">registered';
                                                else if ( scored_addresses[address.ip] & 1 ) ret += '<td style="padding:0 1em">yes';
                                                else ret += '<td style="padding:0 1em">';
                                                ret += '<td style="padding:0 1em">' + stash.spam_list_links( address.ip, username_text, '' ).join('&nbsp;');
                                                ret += '<td style="padding:0 1em">' +
                                                    address.users
                                                    .filter(function(user) { return user.name != username_text && user.name != name })
                                                    .map(function(user) { return '<a href="/member.php?u=' + user.user_id + '">' + BabelExt.utils.escapeHTML(user.name) + '</a>' }).join(', ');
                                                return ret;
                                            }).join('') +
                                            '</tbody></table>'
                                    );

                                });
                                event.preventDefault();
                            });
                        });

                    });
                });

                /*
                 * Gather information about the user from various pages,
                 * and show it all in a "reviewed user info" block
                 */
                var userinfo_promise = $.when(
                    $.get('usernote.php?u=' + user_id),
                    modcp_promise,
                    stash.get_member_info(user_id)
                ).then(function( user_notes, mod_cp_iframe, member ) {

                    var infraction_count = 0, warning_count = 0, pm_titles = [];

                    // later we'll scroll the page so this marker appears to have stayed still in the viewport:
                    var old_marker_pos = container.offset().top;

                    // create the block (and add easy-to-add info):
                    container.find('#user-info').html(
                        '<div class="view-stats_mini"></div>' +
                        ( stash.watched_users.hasOwnProperty(user_id) ? stash.watchlist_html : '' ) +
                        '<div><a id="browsing_options" href="/modcp/user.php?do=viewuser&u='+user_id+'#ctrl_options[receivepm]"><b>Browsing options</b></a></div>' +
                        '<div class="profile_content"><div id="infractions_block"><b>Infractions</b>: none</div></div>' +
                        '<ol id="user_notes"><li><b>User notes</b>: none</ol>'
                    );

                    // Populate the block with information from the member page:
                    container.find('.view-stats_mini').replaceWith( member.stats.removeAttr( 'id' ).addClass( 'view-stats_mini' ) );
                    container.find('.view-stats_mini')
                        .find('.blockbody').removeClass('blockbody')
                        .find('.userinfo').css({ width: 'inherit', 'padding-left': 0, 'float': 'left' });
                    container.find('.view-stats_mini .userprof_blocksubhead').text( username_text );
                    if ( member.infractions_block ) {
                        $('#infractions_block').replaceWith( member.infractions_block.css({ clear: 'both' }) );
                        $('.infractions_block').prepend( '<h2 style="text-align: center; font-weight: bold; padding-top: 1em">Infractions</h2>' );
                        infraction_count = member.infraction_count;
                        warning_count    = member.warning_count;
                        $('input[name="issue-type"]:checked').click();
                    }

                    // Populate the block with information from the user notes page
                    var notes = $(user_notes[0]).find('#posts');
                    if ( notes.length ) {
                        $('#user_notes').replaceWith( notes.attr( 'id', 'user_notes' ).css({width:'99%'}) );
                        $('#user_notes').before( '<h2 style="text-align: center; font-weight: bold; padding-top: 1em; clear: both">User notes</h2>' );

                        pm_titles = $('#user_notes').find('h2.title').map(function() { return $(this).text() }).get();

                        $('#user_notes').children().each(function() {
                            var summary = $(
                                '<li style="clear:both; border-bottom: 1px solid grey" class="userprof_content">' +
                                  '<div class="infractionbit">' +
                                    '<div class="inflistinfo">' +
                                      '<div class="infraction_reason"><span class="shade">Title:</span> <em><a href="/usernote.php?do=viewuser&u='+user_id+'#' + this.id + '"></a></em></div>' +
                                    '</div>' +
                                    '<div class="inflistdate"><span class="date"></span><div class="postby">by <a href="member.php?u="></a></div></div>' +
                                    '<div class="inflistexpires"></div>' +
                                    '<div class="inflistpoints" style="margin-top:0.5em"><a href="#uncollapse"><img alt="" src="/images/buttons/collapse_40b_collapsed.png"></a></div>' +
                                  '</div>' +
                                '</div>' +
                              '</li>'
                            ).insertBefore(this);
                            summary.find('.date').append( $('.posthead .date', this).clone() );
                            summary.find('.infraction_reason').text( $('h2', this).text() || $('blockquote',this).text().replace(/^\s*(.*?)\s*(?:$|\n)(?:.|\n)*$/,'$1') );
                            summary.find('.postby a').replaceWith( $('.username', this).clone() );
                            summary.find('.postby a').html(summary.find('.postby a b').html());
                            $(this).hide();
                        });
                        $('#user_notes .inflistpoints a').click(function(event) {
                                if ( $(this).attr('href') == '#collapse' )
                                    $(this).attr( 'href', '#uncollapse' ).children().attr('src', '/images/buttons/collapse_40b_collapsed.png').closest('li').next().hide();
                                else
                                    $(this).attr( 'href',   '#collapse' ).children().attr('src', '/images/buttons/collapse_40b.png'          ).closest('li').next().show();
                                event.preventDefault();
                            });

                    }

                    // Populate the block with information from their Moderator Control Page:
                    setInterval(function() {
                        // make sure we stay logged in to ModCP
                        var title = document.title;
                        $(mod_cp_iframe).one( 'load', function() { document.title = title });
                        mod_cp_iframe.src = stash.modcp_url( 'user.php?do=viewuser&'+new Date().getTime() );
                    }, 60000);
                    var message;
                    var mod_cp = $( mod_cp_iframe.contentDocument.body );
                    if ( mod_cp.find('input[id^="rb_1_options\\[receivepm\\]"]').is(':checked') ) { // receive PMs
                        if ( mod_cp.find('input[id^="rb_1_options\\[emailonpm\\]"]').is(':checked') ) { // notification e-mail
                            if ( mod_cp.find('input[id^="rb_1_user\\[pmpopup\\]"]').is(':checked') ) // notification popup
                                message = ': <span style="padding: 0 2px 2px 2px; color: white; background: green">[should read]</span> will be notified of private messages by popup and e-mail';
                            else
                                message = ': <span style="padding: 0 2px 2px 2px; color: white; background: green">[should read]</span> will be notified of private messages by e-mail only';
                        } else { // no notification e-mail
                            if ( mod_cp.find('input[id^="rb_1_user\\[pmpopup\\]"]').is(':checked') ) // notification popup
                                message = ': <span style="padding: 0 2px 2px 2px; color: white; background: green">[should read]</span> will be notified of private messages by popup only';
                            else
                                message = ": <span style=\"padding: 0 2px 2px 2px; background: yellow\">[might read]</span> will receive private messages, but won't be notified so probably won't see them";
                        }
                    } else { // won't receive PMs
                        message = ': <span style="padding: 0 2px 2px 2px; color: white; background: #a00">[won\'t read]</span> will not receive private messages';
                    }
                    $('#browsing_options').after(message);

                    var current_time = new Date().getTime();
                    $('#reviewed-user-info .time').each(function() {
                        var node = this;
                        $(this.parentNode).text().replace( /^\s*([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})/, function( match, day, month, year ) {
                            var time = Math.floor( ( current_time - new Date(year, parseInt(month,10)-1, day ).getTime() ) / (24*60*60*1000) );
                            $(node).after(
                                ', about ' + Math.abs(time) +
                                    ( ( Math.abs(time) == 1 ) ? ' day' : ' days' ) +
                                    ( ( time < 0 ) ? ' from now' : ' ago' )
                            );
                        });
                    });

                    // scroll down by the new box height, so the user doesn't see any difference
                    if ( container[0].getBoundingClientRect().top < 0 )
                        window.scrollBy( 0, Math.floor( container.offset().top - old_marker_pos ) );

                    return { infraction_count: infraction_count, warning_count: warning_count, pm_titles: pm_titles };

                });

                return { modcp: modcp_promise, userinfo: userinfo_promise };

            }

        }

    },


    /*
     * FUNCTIONS TO SEND MODERATION MESSAGES
     */

    {
        pass_storage: ['infractions','infractions_timestamp'],
        pass_preferences: [ 'variable_thread_id', 'reload_interval' ],
        callback: function( stash, pathname, params, infractions, infractions_timestamp, variable_thread_id, reload_interval ) {

            stash.infractions = JSON.parse(infractions||'[]');

            // Refresh the list of infractions
            if ( parseInt(infractions_timestamp||'0',10)+reload_interval*1000 < new Date().getTime() ) {
                v.promise.done(function() {
                    bb.infraction_ids().then(function(infractions) {
                        if ( !infractions.length ) {
                            alert( "Could not refresh the list of infractions - some moderator actions may not work until you refresh the page" );
                            return;
                        }

                        var infraction_map = {};
                        infractions.forEach(function(infraction) { infraction_map[ infraction.name.toLowerCase() ] = true });
                        var bad_infractions = v.resolve('policy', 'infraction-worthy violations', {}, 'array of items').filter(function(violation) { return !infraction_map.hasOwnProperty(violation.value) });
                        if ( bad_infractions.length && confirm(
                            "Some infraction-worthy violations do not exist.  Please fix the following:\n\n" +
                                bad_infractions.map(function(violation) { return violation.value }).join("\n") + "\n\n" +
                                "To fix these names, paste the above into a text editor, go to the variables forum and change \"infraction-worthy violations\" in the relevant \"policy\" thread.\n" +
                                "\n" +
                                "Would you like to go there now?"
                        )) {
                            location = '/forumdisplay.php?f=70';
                            return;
                        }

                        var bad_pms = v.resolve('policy', 'PM-worthy violations', {}, 'array of items').filter(function(violation) { return !infraction_map.hasOwnProperty(violation.value) });
                        if ( bad_pms.length && confirm(
                            "Some PM-worthy violations do not exist.  Please fix the following:\n\n" +
                                bad_pms.map(function(violation) { return violation.value }).join("\n") + "\n\n" +
                                "To fix these names, paste the above into a text editor, go to the variables forum and change \"pm-worthy violations\" in the relevant \"policy\" thread.\n" +
                                "\n" +
                                "Would you like to go there now?"
                        )) {
                            location = '/forumdisplay.php?f=70';
                            return;
                        }

                        stash.infractions = infractions;
                        BabelExt.storage.set( 'infractions', JSON.stringify( infractions ) );
                        BabelExt.storage.set( 'infractions_timestamp', new Date().getTime() );

                    },
                    function() {
                        alert( "Could not refresh the list of infractions - some moderator actions may not work until you refresh the page" );
                    });
                });
            }

            stash.find_user_ban = function( username ) {
                return $.get( stash.modcp_url( 'banning.php?do=modify' ) ).then(function(html) {
                    var first = 2, last = parseInt( $(html).find( '#cpform_table' ).last().find( 'tr:eq(1) a' ).last().text(), 10 ), current = 1;
                    function check(html) {
                        var table = $(html).find( '#cpform_table' ).last();
                        var names = table.find('a b');
                        if        ( username.localeCompare( names.eq(0             ).text() ) < 0 ) { // this page is after the matching page
                            last = current - 1;
                        } else if ( username.localeCompare( names.eq(names.length-1).text() ) > 0 ) { // this page is before the matching page
                            first = current + 1;
                        } else if ( first > last ) {
                            return;
                        } else {
                            var match = table.find('a b').filter(function() { return this.textContent == username });
                            if ( match.length ) {
                                match = match.closest('tr').find('td');
                                return {
                                    name      : username,
                                    banned_by : match.eq(1).text(),
                                    ban_period: match.eq(3).text(),
                                    ban_reason: $.trim( match.eq(7).text() ),
                                    page      : stash.modcp_url( 'banning.php?do=modify&page=' + current )
                                };
                            } else {
                                return; // user has not been banned
                            }
                        };
                        current = Math.floor( ( first + last + 1 ) / 2 );
                        return $.get( stash.modcp_url( 'banning.php?do=modify&page=' + current ) ).then(check);
                    }
                    return check(html);
                });
            }

        }

    },

    { // retrieve the wathchlist
        match_pathname: [ '/showthread.php', '/member.php', '/inlinemod.php' ],
        pass_storage: [ 'watched_users', 'watched_users_timestamp' ],
        pass_preferences: [ 'reload_interval' ],
        callback: function( stash, pathname, params, watched_users, watched_users_timestamp, reload_interval ) {
            stash.watchlist_html = '<a style="background: none" href="/showthread.php?t=10650"><img title="user is on the watch list" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAQAAAAXtxYXAAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfeCQgAIRS6AVz/AAAA+ElEQVQY002Pv23CQBxG3yWWbATmzEF5/DkhUaSxNzAbMIK9ASOYEdgANjCZADZwaNJmBJMuFrZ+KaxIea96xVd8CgBiTa5ylfQlH3LmfP8GUABvO3VWEXBTN5AtW5CH5J/v8AKbU3dpo/bYRc2hSZqkOXRRe2yj7rI5Aa5w4up1CqvUSe8qhXXqaieuwIqtFzGALazMy3lpxRYAi9jWVrwnICvu8ARIANQD4CdSANPMiJHJHmbafBkxYqqZhsneiJFpBoyzUEIZXYdLrXWqU62Hy9E1lLAeZ/1tBnFQBRKIX/mFX/hVIIEE1SDmP17mla/S65Xe35ZfppZeW0ULI8kAAAAASUVORK5CYII=" style="margin-right: 0.5ex">on the watchlist</a>';
            stash.watched_users = JSON.parse( watched_users || '{}' );

            if ( parseInt(watched_users_timestamp||'0',10)+reload_interval*1000 < new Date().getTime() ) {
                $.ajax({
                    url: '/showpost.php?p=246029&postcount=1',
                    dataType: "html",
                    success: function( msg ) {
                        msg = $(msg).find('#post_message_246029');
                        if ( msg.length ) {
                            stash.watched_users = {};
                            msg.find( 'a[href^="http://forums.frontier.co.uk/search.php?do=finduser&u="]' )
                                .each(function() {
                                    stash.watched_users[this.href.substr(54)] = 1;
                                });
                            BabelExt.storage.set( 'watched_users', JSON.stringify( stash.watched_users ) );
                            BabelExt.storage.set( 'watched_users_timestamp', new Date().getTime() + 60*60*1000 );
                        } else {
                            alert( "Could not refresh the watchlist - some users may be incorrectly shown as (not) on the list until you refresh the page" );
                        }
                    },
                    error: function() {
                        alert( "Could not refresh the watchlist - some users may be incorrectly shown as (not) on the list until you refresh the page" );
                    }
                });
            }

        }
    },

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
    },

    /*
     * DELETE POSTS AS SPAM
     */
    {
        match_pathname: '/inlinemod.php',
        match_params: {
            p: true
        },
        match_elements: '#iplist',
        callback: function(stash, pathname, params) {

            var block = $('<div class="blockrow"></div>').insertAfter( $('#iplist').closest('.blockrow') );

            $('#userlist a').each(function() {
                var name = $(this).text();
                $('<div style="text-align: center; font-size: larger; font-weight: bold; margin:1em 0 0.5em"></div>').text( name ).appendTo(block);
                stash.build_user_report( BabelExt.utils.escapeHTML(name), name, this.nextElementSibling.value, $('<div></div>').appendTo(block) );
            });

            $('#deleteother,#useraction_ban').prop( 'checked', true );

        }
    },
    {
        match_pathname: '/inlinemod.php',
        match_params: {
            'do': 'spamconfirm'
        },
        match_elements: '.blockfoot',
        callback: function(stash, pathname, params) {
            $('select[name="usergroupid"]').val(22); // spambots
            bb.redirect_duration.period = 'PERMANENT'; // trick the "redirect duration" code into setting the correct duration
            $('input[name="reason"]').val('Spambot');
        }
    },

    /*
     * EDIT POST PAGES
     */
    {
        match_pathname: ['/editpost.php'],
        match_elements: ['#deltype_soft'],
        callback: function(stash, pathname, params, button) {
            $(button).parent().css({ width: '400px' }).append( ' (recommended)' );
        }

    },

    /*
     * MODERATION USER PAGE
     */
    {
        match_pathname: '/modcp/user.php',
        match_params: {
            'do': 'viewuser'
        },
        match_elements: '.normal',
        callback: function(stash, pathname, params, normal) {
            $(normal).after( ' - <a href="/member.php?u='+params.u+'">go to member page</a> - <a href="/private.php?do=newpm&u=' + params.u + '">send PM</a>' );
        }
    },


    { // retrieve the list of posts awaiting moderation
        pass_storage: [ 'moderated_posts', 'moderated_posts_timestamp' ],
        callback: function(stash, pathname, params, moderated_posts, moderated_posts_timestamp) {
            stash.moderated_posts = moderated_posts || '(log in to see the moderation queue)';
            function update_moderated_posts( html ) {
                html = $(html);
                if ( html.find('#threads_table').length ) { // logged in
                    var posts = {};
                    html.find( 'a[href^="user.php"]').each(function() { if ( posts.hasOwnProperty(this.outerHTML) ) ++posts[this.outerHTML]; else posts[this.outerHTML]=1 });
                    posts = Object.keys(posts).map(function(post) { return post + ( ( posts[post] == 1 ) ? '' : ' x ' + posts[post] ); }).join(', ');
                    BabelExt.storage.set( 'moderated_posts', posts );
                    BabelExt.storage.set( 'moderated_posts_timestamp', new Date().getTime() );
                } else {
                    BabelExt.storage.set( 'moderated_posts', '' );
                }
            }
            if ( pathname == '/modcp/moderate.php' && params.do == 'posts' ) {
                $(function() { update_moderated_posts(document.body) });
            } else if ( parseInt(moderated_posts_timestamp||'0',10)+600*1000 < new Date().getTime() ) {
                $.ajax({
                    url: stash.modcp_url( 'moderate.php?do=posts' ),
                    dataType: "html",
                    success: update_moderated_posts
                });
            }
        }
    },

    /*
     * MODERATION QUEUE PAGE
     */
    {
        match_pathname: '/modcp/moderate.php',
        match_elements: '.copyright',
        callback: function(stash) {

            $('a[href^="user.php"]').each(function() {
                var ignore_button = $(this).closest('tr').next().next().next().next().next().find('label').last();
                var username = $(this).text();

                var spam_button = $('<label><input type="radio" tabindex="1" value="0">Spambot</label>')
                    .insertAfter(ignore_button)
                    .before(' ')
                    .children()
                    .attr( 'name', ignore_button.children().attr('name') )
                    .addClass( 'spambot' )
                    .closest('label')
                ;

                var user_id = this.href.split('&u=')[1];
                ignore_button.closest('td').data( 'user_id', user_id ).addClass( 'user-'+user_id );

                $.get( 'user.php?do=viewuser&u=' + user_id, function(html) {
                    spam_button.after( ' - ' + stash.spam_list_links( $(html).find('#it_user\\[ipaddress\\]_18').val() || '(no address found)', username ).join(' - ') );
                });

            });
            $('input[value="1"][name^="threadaction"]').each(function() {
                $('<label>Validate and bump&nbsp;</label>').insertBefore(this.parentNode).prepend($(this).clone().removeAttr('id').addClass('bump'));
            });

            $('<a style="margin-left:1em" href="#update-notes">update</a>')
                .insertAfter('input[id^="it_threadnotes"]')
                .click(function(event) {
                    var input = this.previousElementSibling;
                    input.id.replace(/^it_threadnotes\[([0-9]*)\]_[0-9]*$/, function( match, thread_id ) {
                        bb.thread_edit({
                            thread_id       : thread_id,
                            title           : $('input[name="threadtitle\\['+thread_id+'\\]"]').val(),
                            notes           : $(input).val(),
                            unapprove_thread: true
                        });
                    });
                    event.preventDefault();
                });


            $('.tfoot').append( '<span class="counts"></span>' );
            $('.thead input').click(function() {
                $(this).closest('table').find('input[type="radio"]:checked').change();
            });
            $('#threads_table .thead input,#threads_table .tfoot input').each(function() {
                this.title = this.title.replace( / *$/, ' all threads' );
                this.value = this.value.replace( / *$/, ' all threads' );
            });
            $('#posts_table .thead input,#posts_table .tfoot input').each(function() {
                this.title = this.title.replace( / *$/, ' all posts' );
                this.value = this.value.replace( / *$/, ' all posts' );
            });
            function radio_change() {
                var siblings = $(this).closest('table').closest('tr').prevUntil(':has(.thead)').addBack();
                switch ( $(this).closest('td').find('input[type="radio"]:checked').val() ) {
                case "-1": // delete
                    siblings.find('.alt1').css({ 'background-color': '#cc4949' });
                    siblings.find('.alt2').css({ 'background-color': '#da5353' });
                    break;
                case "0": // ignore
                    if ( $(this).hasClass('spambot') ) {
                        siblings.find('.alt1').css({ 'background-color': '#854' }); // the colour of SPAM
                        siblings.find('.alt2').css({ 'background-color': '#965' });
                    } else {
                        siblings.find('.alt1').css({ 'background-color': '#cc9800' });
                        siblings.find('.alt2').css({ 'background-color': '#daa600' });
                    }
                    break;
                case "1": // validate
                    siblings.find('.alt1').css({ 'background-color': '#39bb39' });
                    siblings.find('.alt2').css({ 'background-color': '#43ca43' });
                    break;
                }
                var counts = {}, count_str = [];
                $(this).parent().closest('[id]').find('input[type="radio"]:checked').each(function() {
                    var value = $(this).hasClass('spambot') ? 'spam' : this.value;
                    if ( counts[value] )
                        ++counts[value];
                    else
                        counts[value] = 1;
                });
                if ( counts[ 1] ) count_str.push( counts[ 1] + ' validated' );
                if ( counts[ 0] ) count_str.push( counts[ 0] + ' ignored'   );
                if ( counts[-1] ) count_str.push( counts[-1] + ' deleted'   );
                if ( counts.spam ) count_str.push( counts.spam + ' spambots'   );
                if ( $(this).parent().closest('[id]').attr( 'id' ) == 'threads_table' ) {
                    if ( counts[1] || counts[-1] || counts.spam )
                        $('#posts_table').not($(this).parent().closest('[id]')).hide();
                    else
                        $('#posts_table').not($(this).parent().closest('[id]')).show();
                }
                $(this).parent().closest('[id]').find('.counts').text( count_str.join(', ') );
            };

            $('input[type="radio"]').change(radio_change);
            $('#threads_table input[type="radio"],#posts input[type="radio"]')
                .change(function() {
                    if ( $(this).hasClass('spambot') ) {
                        $('.user-'+$(this).closest('td').data('user_id') + ' .spambot').prop( 'checked', true ).each(radio_change);
                    } else {
                        $('.user-'+$(this).closest('td').data('user_id') + ' .spambot:checked').closest('td').find( 'input[value=0]').not('.spambot').prop( 'checked', true ).each(radio_change);
                    }
                });
            $('a[href^="user.php"]').each(function() {
                var user_id = this.href.split('&u=')[1];
                var pm_link = $(this).after(' - <a href="/member.php?u=' + user_id + '">member page</a> - <a class="pm_link" href="/private.php?do=newpm&u=' + user_id + '">send PM</a>').nextUntil('.pm_link').next();
                stash.get_member_info(user_id).done(function(info) { pm_link.after( ' - ' + info.summary + ', ' + info.join_summary ); });
            });
            $('<a style="margin-left:1em" href="#switch-mode">switch to preview mode</a>')
                .appendTo('div.smallfont')
                .click(function() {
                    var $this = $(this);
                    var vbcode = this.parentNode.previousElementSibling;
                    if ( !vbcode.previousElementSibling ) {
                        $('<div>foo</div>').insertBefore(vbcode).height( $(vbcode).outerHeight() + 2 );
                    }
                    var preview = vbcode.previousElementSibling;
                    if ( $this.hasClass('previewing') ) {
                        $this.removeClass('previewing').text( 'switch to preview mode' );
                        $(vbcode ).show();
                        $(preview).hide();
                    } else {
                        $this.   addClass('previewing').text( 'switch to vbCode mode' );
                        $(vbcode ).hide();
                        $(preview).show().html(loading_html);
                        bb.bbcode_html_newthread( $(this).closest('tr').prev().prev().find('a').attr('href').split('?f=')[1], $(vbcode).val() )
                            .done(function(html) {
                                $(preview).html(html);
                            });
                    }
                });
            $('#submit0,#submit1').click(function(event) {
                var promises = [], known_users = {}, form = $(this).closest('form'), table = $( this.id == 'submit0' ? '#threads_table' : '#posts_table' );
                table.find('input.bump:checked').each(function() {
                    $(this).attr('name').replace( /^threadaction\[([0-9]*)\]$/, function( match, thread_id ) {
                        promises.push( bb.thread_bump(thread_id) );
                    });
                });
                table.find('input.spambot:checked').each(function() {
                    var user_id = $(this).closest('td').data('user_id');
                    if ( known_users.hasOwnProperty(user_id) ) return;
                    known_users[user_id] = true;
                    $(this).attr('name').replace( /^(post|thread)action\[([0-9]*)\]$/, function( match, type, id ) {
                        promises.push(
                            ( type == 'post' )
                            ?                                                     bb.spammer_delete( user_id, id               )
                            : bb.thread_posts( id ).then(function(posts) { return bb.spammer_delete( user_id, posts[0].post_id ) })
                        );
                    });
                });
                if ( promises.length ) {
                    $.when.apply( $, promises ).done(function() { form.submit() });
                    event.preventDefault();
                }
            });

            $('textarea[id^="ta_threadpagetext"]').each(function() {
                var textarea = this;
                this.id.replace( /\[([0-9]*)\]/, function( match, thread_id ) {
                    $(textarea).next().append( '<a style="margin-left:1em" href="/showthread.php?t='+thread_id+'#posts">go to thread</a>' );
                    $(textarea).closest('tr').prev().prev().find('a')
                        .after( ' - <a href="https://forums.frontier.co.uk/postings.php?do=movethread&t='+thread_id+'">move thread</a>' )
                    ;
                });
            });
            $('textarea[id^="ta_postpagetext"]').each(function() {
                var textarea = this;
                this.id.replace( /\[([0-9]*)\]/, function( match, post_id ) {
                    $(textarea).next().append( '<a style="margin-left:1em" href="/showthread.php?p='+post_id+'#post'+post_id+'">go to post</a>' );
                });
            });

        }
    },

    /*
     * MEMBER PAGES
     */
    {
        match_pathname: '/member.php',
        match_elements: '.profile_content',
        callback: function(stash, pathname, params) {
            $('<dd class="userprof_moduleinactive"><a onclick="return tabViewPicker(this);" href="#userreport-content" id="userreport-tab">Report</a></dd>')
                .appendTo('#tab_container > dl')
                .one( 'click', function() {
                    stash.build_user_report(
                        BabelExt.utils.escapeHTML( $('#userinfo .member_username').text() ),
                        $('#userinfo .member_username').text(),
                        params.u,
                        $('#view-userreport-content')
                    );
                });
            $('.profile_content').append(
                '<div id="view-userreport-content" class="view_section"></div>'
            );
        }
    },

    /*
     * "WELCOME" LINK ON SEARCH AND FORUM PAGES
     */
    {
        callback: function(stash) {
            stash.add_welcome_button = function(selector) {
                $('<a style="float: right" title="click here to send a generic &ldquo;welcome to the forums&rdquo; message" href="#welcome-response">send "welcome" response</a>')
                    .insertAfter(selector)
                    .click(function(event) {
                        var $this = $(this)
                        var thread_starter = $this.closest('.inner').find('.username').text();
                        $this.html( loading_html );
                        bb.thread_reply({
                            thread_id: $this.siblings('.title').attr('id').substr(13), // thread_title_12345
                            title    : v.resolve('other templates', 'post title: welcome', { 'thread starter': thread_starter }, 'string', 16),
                            bbcode   : v.resolve('other templates',  'post body: welcome', { 'thread starter': thread_starter }, 'string', 16)
                        })
                            .done(function() { $this.replaceWith( '<span style="float: right">reply sent</span>' ) });
                        event.preventDefault();
                    });
            }
        }
    },
    {
        match_pathname: '/forumdisplay.php',
        match_params: {
            f: 16
        },
        match_elements: [ '#inlinemod_formctrls' ],
        callback: function(stash, pathname, params) {
            stash.add_welcome_button('.threadinfo .inner .title');
        }
    },
    {
        match_pathname: '/search.php',
        match_elements: [ '#inlinemod_formctrls' ],
        callback: function(stash, pathname, params) {
            stash.add_welcome_button(
                $('.threadpostedin a[href="forumdisplay.php?f=16"]').closest('li').find('.threadinfo .inner .title')
            );
        }
    },


    /*
     * MODERATION TOOLS SECTION ON THREAD PAGES
     */
    {
        match_pathname: '/showthread.php',
        pass_storage: [ 'newbies', 'max_newbie_id', 'mod_log_post_id', 'popup_mod_log_post_id', 'popup_on_mod_log_post' ],
        callback: function(stash, pathname, params, newbies, max_newbie_id, mod_log_post_id, popup_mod_log_post_id, popup_on_mod_log_post) {

            // Fix conflicts created by adding the above CSS:
            $("head").append(
                "<style type='text/css'>" +
                    '.thread-management-log div.blockbody, .thread-management-log div.section, .thread-management-log li.blockrow { padding: 0 }' +
                    '.thread-management-log li div { display: inline-block }' +
                "</style>"
            );
            stash.report_block = $(
                '<div class="thread-management-log"></div>' +
                '<div class="thread_info block">' +
                    '<div class="options_block_container">' +
                        '<div class="options_block" style="width: 100%">' +
                            '<h4 class="collapse blockhead options_correct">Active threads in <a href="/forumdisplay.php?f=48">the reported posts forum</a></h4>' +
                            '<div id="threadbits_forum_48_container" class="threadlist" style="width: 100%"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="thread_info block">' +
                    '<div class="options_block_container">' +
                        '<div class="options_block" style="width: 100%">' +
                            '<h4 class="collapse blockhead options_correct">Most recent post in <a href="/showthread.php?t=' + v.resolve('policy', 'mod log thread id') + '&goto=newpost">the moderation thread</a></h4>' +
                            '<table id="last_post_container" style="width: 100%"></table>' +
                            '<input type="checkbox"' + (popup_on_mod_log_post?' checked="checked"':'') + ' id="popup-on-mod-log-post"><label for="popup-on-mod-log-post"> Show popup notification when new posts appear in the moderation log</label>' +
                            stash.mark_read_html +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="thread_info block" style="margin-bottom: 2.5em">' +
                    '<div class="options_block_container">' +
                        '<div class="options_block" style="width: 100%">' +
                            '<h4 class="collapse blockhead options_correct">Users registered since yesterday - please check and infract inappropriate usernames</h4>' +
                            '<div id="memberlist"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="thread_info block" style="margin-bottom: 2.5em">' +
                    '<div class="options_block_container">' +
                        '<div class="options_block" style="width: 100%">' +
                            '<h4 class="collapse blockhead options_correct">Users with posts waiting in <a href="/modcp/moderate.php?do=posts">the moderation queue</a></h4>' +
                            '<div id="moderatedlist">' + stash.moderated_posts + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );
            var dfd = new jQuery.Deferred();
            stash.recently_reported_posts_promise = dfd.promise();
            $.get( '/postings.php?do=editthread&t=' + params.t, function(html) {
                html = $(html);
                if ( html.find('input[name=notes]').val() != '' )
                    html.find('div.vbform .blockhead')
                      .append( ' - <b>note:</b> <i></i>' )
                      .find('i').text(html.find('input[name=notes]').val())
                ;
                var moderation_events = html.find('div.vbform');
                moderation_events.find('h2.blockhead').html( '<a href="/postings.php?do=editthread&t=' + params.t + '">Thread management log</a>' );
                var info = moderation_events.find('.summaryinfo');
                moderation_events.find('ul').append( info.detach().get().reverse() );
                if ( info.length > 5 ) info.slice( 0, info.length - 5 ).remove();
                moderation_events.find('.blockhead').wrapInner( '<a href="/postings.php?do=editthread&t=' + params.t + '"></a>' );
                stash.report_block.filter('.thread-management-log').append( moderation_events );
            });
            stash.report_block.find('#popup-on-mod-log-post').change(function() {
                BabelExt.storage.set( 'popup_on_mod_log_post', $(this).prop('checked') ? 1 : '' );
            });
            stash.report_block.find('#threadbits_forum_48_container').load( '/forumdisplay.php?f=48 #threads', function() {
                var recently_reported_posts = {};
                stash.report_block.find('#threadbits_forum_48_container a.title').each(function() {
                    var href = this.href;
                    $(this).text().replace( /\[PID: ([0-9]*)\]/, function(match, pid) {
                        recently_reported_posts['#post_'+pid] = href;
                    });
                });
                stash.report_block.find('.prefix_closed,.prefix_deleted').closest('li').remove();
                stash.report_block.find('.prefix.understate').filter(function() { return $(this).text().search(/^\s*(?:Closed|Moved):\s*$/) != -1 }).closest('li').remove();
                stash.report_block.find('.threadstatus')
                    .css({ cursor: 'pointer' })
                    .attr( 'title', 'double-click to close this thread' )
                    .dblclick(function() {
                        var threadbit = $(this).closest('.threadbit');
                        bb.thread_openclose( threadbit.attr('id').substr(7), $(this).closest('.threadbit').hasClass('lock') )
                            .done(function() { threadbit.toggleClass('lock') });
                });
                var title_suffix =
                    v.resolve('report process', 'report title suffix', { moderator: 'ANY_MODERATOR' })
                    .replace( /([.*+?^${}()|\[\]\/\\])/g, "\\$1" )
                    .replace( 'ANY_MODERATOR', '.*' )
                stash.report_block.find('#threadbits_forum_48_container a.title').filter(function() { return $(this).text().search( title_suffix ) == -1 }).each(function() {
                    var thread_id = this.href.split(/\?t=/)[1];
                    $('<a title="Click to take this thread" class="newcontent_textcontrol" rel="nofollow" href="newreply.php?t='+thread_id+'&noquote=1" style="float:right">Take this report</a>')
                        .click(function(event) {
                            stash.take_thread_and_go( this.href, thread_id );
                            event.preventDefault();
                        })
                        .insertAfter(this);
                });

                dfd.resolve(recently_reported_posts);
            });
            var last_post_container = stash.report_block.find('#last_post_container');
            last_post_container
                .load( '/showthread.php?t=' + v.resolve('policy', 'mod log thread id') + '&goto=newpost .postcontainer:last', function() {
                    last_post_container.find('.posthead,.postfoot,.after_content').remove();
                    last_post_container.find('.postbitlegacy').css({ 'margin-bottom': 0 });
                    var new_mod_log_post_id = last_post_container.find('.postbitlegacy').attr('id').substr(4);
                    last_post_container.next().next().next().click(function() {
                        if ( last_post_container.is(':visible') ) { // mark read
                            last_post_container.hide();
                            BabelExt.storage.set( 'mod_log_post_id', new_mod_log_post_id );
                            this.value = 'mark unread';
                        } else {
                            last_post_container.show();
                            BabelExt.storage.set( 'mod_log_post_id', '' );
                            this.value = 'mark read';
                        }
                    });
                    if ( new_mod_log_post_id == mod_log_post_id )
                        last_post_container.next().next().next().click();
                    if ( new_mod_log_post_id != popup_mod_log_post_id ) {
                        BabelExt.storage.set( 'popup_mod_log_post_id', new_mod_log_post_id );
                        if ( popup_on_mod_log_post && confirm( 'New message in the moderation log.\n\nClick OK to view it, or cancel to hide this prompt.' ) )
                            document.location = '/showthread.php?t=' + v.resolve('policy', 'mod log thread id') + '&goto=newpost';
                    }
                });
            newbies = JSON.parse( newbies || '[]' );
            max_newbie_id = parseInt( max_newbie_id || '0' );
            var memberlist_pageno = 0, memberlist = stash.report_block.find('#memberlist'), new_max_newbie_id = 0;
            function get_memberlist(html) {
                html = $(html);
                var has_old_members = false;
                html.find('#memberlist_table tr:not(.columnsort)').each(function() {
                    if ( $(this).children('td').filter(function() { return $(this).text().search( /^(?:Today|Yesterday)$/ ) != -1 }).length == 0 ) {
                        has_old_members = true;
                    } else {
                        var a = $( 'a.username', this );
                        var user_id = parseInt( a.attr('href').split('?u=')[1], 10 );
                        if ( user_id > max_newbie_id ) {
                            newbies.push(a.prop('outerHTML'));
                            new_max_newbie_id = Math.max( new_max_newbie_id, user_id );
                        } else {
                            has_old_members = true;
                        }
                    }
                });
                if ( has_old_members || memberlist_pageno++ == 10 ) {
                    if ( new_max_newbie_id ) {
                        BabelExt.storage.set( 'newbies', JSON.stringify( newbies ) );
                        BabelExt.storage.set( 'max_newbie_id', new_max_newbie_id );
                    };
                    stash.report_block.find('#memberlist')
                        .html( '<div style="margin-bottom: 0.5em">' + newbies.join(', ') + '</div>' + stash.mark_read_html )
                        .find( 'input' ).click(function() {
                            var usernames = $(this.previousElementSibling);
                            if ( usernames.is(':visible') ) { // mark read
                                usernames.hide();
                                BabelExt.storage.set( 'newbies', '[]' );
                                this.value = 'mark unread';
                            } else {
                                usernames.show();
                                BabelExt.storage.set( 'newbies', JSON.stringify( newbies ) );
                                this.value = 'mark read';
                            }
                        });
                } else {
                    $.get( '/memberlist.php?order=desc&sort=joindate&pp=100&page=' + memberlist_pageno, get_memberlist );
                }
            }
            get_memberlist('<html></html>');
        }
    },

    { // start downloading some data if this looks like it's going to be a report thread
        match_pathname: '/showthread.php',
        match_elements: 'title',
        callback: function(stash) {
            document.title.replace( /\[PID: ([0-9]*)\] \[TID: ([0-9]*)\]/, function(match, post_id, thread_id) {
                stash.  post_to_review_id = post_id;
                stash.thread_to_review_id = thread_id;
                var dfd = new jQuery.Deferred();
                stash.review_post_promise = dfd.promise();
                $.get( '/showthread.php?t='+thread_id+'&p='+post_id+'&viewfull=1', function(html) {
                    var html = $(html);
                    dfd.resolve( html, html.find( '#post_' + post_id ) );
                });
                stash.review_post_contents_promise = bb.post_info( post_id );
                stash.report_block.filter('.block.vbform').hide(); // no-one cares about the thread management log for report threads
            });
        }
    },

    {
        match_pathname: '/showthread.php',
        match_elements: 'link[rel="stylesheet"][type="text/css"]',
        callback: function(stash, pathname, params, stylesheet) {
            $(stylesheet)
                .clone()
                .attr( 'href', stylesheet.href.replace( /([?&]sheet)=[^&]*/, '$1=threadlist.css,member.css') )
                .insertBefore(stylesheet)
            ;
            // Fix conflicts created by adding the above CSS:
            $("head").append(
                "<style type='text/css'>" +
                    '#above_postlist { top: 0 }' +
                "</style>"
            );

        }
    },

    { // prepare to merge threads
        match_pathname: [ '/showthread.php', '/postings.php', '/inlinemod.php' ],
        pass_storage: [ 'merge_timestamp' ],
        pass_preferences: [ 'reload_interval' ],
        callback: function(stash, pathname, params, merge_timestamp, reload_interval) {

            // close the current thread and report the merge you're about to do in the mod log
            stash.report_merge = function( current_thread, title, destination_forum,  destination_thread,  destination_title ) {
                return bb.thread_edit({
                    thread_id   : current_thread,
                    title       : title,
                    notes       : 'Closing in preparation for merge',
                    close_thread: true
                }).then(function(html) { // Get information from the closed thread
                    html = $(html);
                    var current_forum = html.find( '#breadcrumb .navbit a').last().attr('href').split( '?f=' )[1];
                    var current_title = html.find( '#breadcrumb .navbit.lastnavbit' ).text().replace( /^\s*|\s*$/g, '' );
                    return bb.thread_posts( current_thread, html ).then(function (posts) {
                        var variable_data = {
                            'current thread id': current_thread,
                            'current thread op post id': posts[0].post_id,
                            'destination thread id' : destination_thread,
                            'current thread title': current_title,
                            'destination thread title' : destination_title,
                            'thread creator id'  : posts[0].user_id,
                            'thread creator name': posts[0].username,
                            'merge data': '/* BEGIN THREAD MERGE DATA */\n' +
                                JSON.stringify(
                                    {
                                        thread_id: current_thread,
                                        forum_id: current_forum,
                                        title: current_title,
                                        posts: posts.get().map(function(post) { return post.post_id })
                                    },
                                    null,
                                    '  '
                                ) +
                                '\n/* END THREAD MERGE DATA */'
                        };
                        return bb.thread_reply({ // Notify/save all posts in thread
                            thread_id: v.resolve('policy', 'merge log thread id'),
                            title    : v.resolve('report process', 'merge title', variable_data),
                            bbcode   : v.resolve('report process', 'merge body' , variable_data)
                        });
                    })
                });
            }

            stash.merge_destinations = v.resolve('policy', 'frequent merge destinations', {}, 'array of items');

            if ( parseInt(merge_timestamp||'0',10)+reload_interval*1000 < new Date().getTime() ) {

                BabelExt.storage.set( 'merge_timestamp', new Date().getTime() + 60*60*1000 );

                var get_requests = [];
                var failed_gets = '';

                // Periodically check everything's still working
                stash.merge_destinations.forEach(function(destination) {

                    if ( destination.type != 'thread' ) {
                        alert(
                            'non-thread destination found in the list of frequent merge destinations.\n' +
                                'Please edit the variable and remove this value.'
                        );
                    }

                    get_requests.push(
                        $.get( '/showthread.php?t=' + destination.thread_id, function(html) {
                            html = $(html);
                            var title = $.trim(html.find( '#breadcrumb .navbit.lastnavbit' ).text());
                            var real_thread_id = html.find('input[name="t"]').val();
                            switch ( real_thread_id ) {
                            case ''+destination.thread_id: return;
                            case undefined: failed_gets += '* Thread ' + destination.thread_id + ' (' + destination.value + ') has been hard-deleted or merged without a redirect.\n'; break;
                            default       : failed_gets += '* Thread ' + destination.thread_id + ' (' + destination.value + ') has been merged into thread ' + real_thread_id + ' (' + title + ')\n';
                            }
                        })
                    );
                });

                if ( get_requests.length )
                    $.when.apply( $, get_requests ).done(function() {
                        if ( failed_gets.length && confirm(
                            'Some frequent merge destinations have changed recently.  Please fix the following issues:\n\n' +
                                failed_gets + "\n" +
                                "To fix these issues, paste the above notes into a text editor then go to the variables thread and change the \"frequent merge destinations\" block.\n" +
                                "\n" +
                                "Would you like to go there now?"
                        ))
                            location = '/showthread.php?' + variable_thread_id; // TODO: update this now we have a whole variables forum
                    });
            }

        }
    },

    { // start downloading some data if this looks like it's going to be a report thread
        match_pathname: '/showthread.php',
        match_elements: '#threadtools',
        pass_preferences: [ 'reload_interval' ],
        callback: function(stash, pathname, params, threadtools, reload_interval) {

            var quick_merge = $(
                    '<li class="popupmenu">' +
                      '<h6><a href="javascript://" class="popupctrl">Quick Merge</a></h6>' +
                      '<ul style="min-width: 350px; left: 5px; top: 18px" class="popupbody"></ul>' +
                    '</li>'
            ).insertBefore(threadtools);
            quick_merge.find('h6 a').click(function() {
                    // Sometimes YUI handles this itself, sometimes it fails to bind the handler
                    if ( $(this).hasClass('mod-friend-active') ) {
                        $(this).removeClass( 'active mod-friend-active' );
                        $(this.parentNode.nextElementSibling).hide();
                    } else {
                        $(this).addClass( 'active mod-friend-active' );
                        $(this.parentNode.nextElementSibling).show();
                    }
                });

            stash.merge_destinations.forEach(function(destination) {

                var link = $('<li></li>').appendTo(quick_merge.find('.popupbody'));
                if ( destination.thread_id < params.t ) {
                    link.html('<a class="merge-title" rel="nofollow" href="showthread.php?t='+destination.thread_id+'"></a>')
                        .click(function(event) {
                            $(this).html(loading_html);
                            $.get( '/showthread.php?t=' + destination.thread_id, function(html) {
                                html = $(html);
                                var forum_id = html.find( '#breadcrumb .navbit a').last().attr('href').split( '?f=' )[1];
                                var title = $.trim($('.lastnavbit').text());
                                stash.report_merge( params.t, title, forum_id, destination.thread_id, destination.value).done(function() {
                                    bb.thread_merge({
                                        forum_id  : forum_id,
                                        thread_ids: [ destination.thread_id, params.t ],
                                        url       : '/showthread.php?goto=newpost&t='+v.resolve('policy', 'mod log thread id'),
                                    });
                                });
                            });
                            event.preventDefault();
                        });
                } else if ( destination.thread_id > params.t ) {
                    link.html('<span class="merge-title" title="can\'t merge earlier threads into later ones\nIf you really want to do this, please merge from that thread into this one."></span>');
                } else { // equal
                    link.html('<span class="merge-title" title="can\'t merge a thread with itself."></span>')
                }

                link.find('.merge-title').text(destination.value);

            });

        }
    },

    {
        match_pathname: '/showthread.php',
        match_elements: ['input[value="openclosethread"]'],
        callback: function( stash, pathname, params, openclose_button) {
            var li = $(openclose_button).closest('li'), text = li.text();
            li.empty();
            $(
                ( text.search( /Open/ ) == -1 )
                ? '<a style="padding:6px 2.5em" href="#close">Close Thread</a>'
                : '<a style="padding:6px 2.5em" href="#open">Open Thread</a>'
            )
                .appendTo(li)
                .click(function(event) {
                    bb.thread_openclose( params.t, $(this).attr('href') == '#open' ).done(function() {
                        location.reload();
                    });
                    event.preventDefault();
                })
        }
    },

    {
        match_pathname: '/showthread.php',
        match_elements: ['#thread_info'],
        callback: function( stash, pathname, params, thread_info) {
            stash.report_block.insertBefore( thread_info );
            stash.recently_reported_posts_promise.done(function(recently_reported_posts) {
                $(Object.keys(recently_reported_posts).join()).each(function() {
                    $(this).find('.report')
                        .attr( 'href', recently_reported_posts['#'+this.id] )
                        .attr( 'title', 'Go to report thread')
                        .text('Already reported');
                });
            });

            var infractions = stash.infractions.map(function(infraction) { return '<li><a href="">&nbsp;Take report: ' + infraction.name + '&nbsp;' }).join('');

            bb.process_posts().each(function() {
                this.linking.append(
                    '<a href="/usernote.php?u=' + this.user_id + '" style="background: none; padding: 0"><span style="font-size: 120%">&#x266b;</span> User Notes</a>' +
                        (
                            stash.watched_users.hasOwnProperty(this.user_id)
                                ? stash.watchlist_html
                                : ''
                        )
                );

                var report_element = this.report_element.wrap('<div class="mod-tools-menu"></div>').parent();

                stash.convert_link_to_menu( report_element.find('a'), 'the report page' );

                var morse_to_latin = {
                    ".-": "a",
                    "-...": "b",
                    "-.-.": "c",
                    "-..": "d",
                    ".": "e",
                    "..-.": "f",
                    "--.": "g",
                    "....": "h",
                    "..": "i",
                    ".---": "j",
                    "-.-": "k",
                    ".-..": "l",
                    "--": "m",
                    "-.": "n",
                    "---": "o",
                    ".--.": "p",
                    "--.-": "q",
                    ".-.": "r",
                    "...": "s",
                    "-": "t",
                    "..-": "u",
                    "...-": "v",
                    ".--": "w",
                    "-..-": "x",
                    "-.--": "y",
                    "--..": "z",

                    ".-.-": "ä",
                    ".--.-": "á",
                    ".--.-": "å",
                    "----": "ch",
                    "..-..": "é",
                    "--.--": "ñ",
                    "---.": "ö",
                    "..--": "ü",

                    "-----": "0",
                    ".----": "1",
                    "..---": "2",
                    "...--": "3",
                    "....-": "4",
                    ".....": "5",
                    "-....": "6",
                    "--...": "7",
                    "---..": "8",
                    "----.": "9",

                    ".-.-.-": ".",
                    "--..--": ",",
                    "---...": ":",
                    "..--..": "?",
                    ".----.": "'",
                    "-....-": "-",
                    "-..-. ": "/",
                    "-.--.-": "()",
                    ".-..-.": "\"",
                    ".--.-.": "@",
                    "-...-": "=",
                    ".-.-": "\n"
                };
                var morse_messages = {}, has_morse;
                this.message.replace( /[-.][-. ]{5,}[-.]/g, function(morse) {
                    var latin = morse.split( /\s+/ ).map(function(letter) { return morse_to_latin.hasOwnProperty(letter) ? morse_to_latin[letter] : letter }).join('');
                    if ( morse.search(/-/) != -1 && morse.search(/\./) != -1 && latin.search( /[^-. ]/ ) != -1 ) {
                        morse_messages['<li><i>' + morse + '</i> is Morse code for <i>' + latin + '</i>'] = 1;
                        has_morse = 1;
                    }
                });
                if ( has_morse ) {
                    $(this.message_element).closest('.postrow').after('<ol class="notices">' + Object.keys(morse_messages).sort().join("<br>") + '</ol>');
                }


                report_element.append(
                    '<ul class="popupbody memberaction_body">' + infractions + '</ul>'
                ).find('li a').attr( 'href', 'report.php?p=' + this.post_id ).click(function(event) {
                    var post_id = $(this).attr('href').substr(13);
                    $(this).before(loading_html);
                    bb.post_report(
                        post_id,
                        $(this).text().replace( /^.Take report: /, '' ).replace( /\xA0$/, '' ),
                        '/forumdisplay.php?f=48' // reported posts forum, so we can find our report and go there
                    ).done(function(html) {
                        var re = new RegExp( "\\[PID: " + post_id + "\\]" );
                        var report_thread = $(html).find('a.title').filter(function() { return $(this).text().search(re) != -1 }),
                            report_thread_href = report_thread.attr('href'),
                            report_thread_id = report_thread_href.substr(17),
                            report_thread_text = report_thread.text()
                        ;
                        if ( report_thread.closest('li').find('a[href^="misc.php?do=whoposted&t="]').text() == '0' )
                            stash.take_thread_and_go( report_thread_href, report_thread_id );
                        else
                            $.get( report_thread_href, function( html ) {
                                var report_owner = bb.process_posts( $(html).find('.flare_Moderator').closest('li') )[0].username
                                if ( report_owner == $('.welcomelink a').text() ) {
                                    stash.take_thread_and_go( report_thread_href, report_thread_id );
                                } else {
                                    if ( confirm( "Ninja'd by " + report_owner + "\nView anyway?" ) ) location = report_thread_href;
                                }
                            });
                    });
                    event.preventDefault();
                });

                var ip_element = this.ip_element.wrap('<div class="mod-tools-menu"></div>').parent();
                stash.convert_link_to_menu( ip_element.find('a'), 'the IP information page' );
                $(
                    '<ul class="popupbody memberaction_body">' +
                        '<li>' + stash.spam_list_links( this.ip, this.username ).join('<li>') +
                    '</ul>'
                ).appendTo(ip_element);

            });

            // link from moderated posts to moderation page
            $('img.moderated').parent().wrap('<a></a>').parent().attr( 'href', stash.modcp_url( 'moderate.php?do=posts' ) );

        }

    },

    { // set redirect duration
        match_pathname: [ '/postings.php', '/inlinemod.php' ],
        match_elements: [ '#footer' ],
        callback: function(stash, pathname, params, expires, period, frame) {
            $('#rb_redirect_expires').click();
            $('select[name="period"]').val( bb.redirect_duration.period );
            $('select[name="frame"]' ).val( bb.redirect_duration.frame  );
        }
    },
    {
        match_pathname: '/postings.php',
        match_elements: [ 'input[name="mergethreadurl"]', '.description' ],
        callback: function(stash, pathname, params, input, description) {
            $('<datalist id="thread-urls"></datalist>')
                .appendTo(document.body)
                .append(
                    stash.merge_destinations.map(function(destination) {
                        return $('<option>').attr( 'value', '/showthread.php?t=' + destination.thread_id ).attr( 'label', destination.value );
                    })
                );
            $(input).attr( 'list', 'thread-urls' );
            var current_thread = parseInt( $('input[name=t]').val(), 10 );
            var warning = $('<p style="display: none; border: 4px solid black; background: #800; color: white; padding: 1em"></p>').insertAfter(description);
            $('input[name="mergethreadurl"]').on( 'input', function() {
                this.value.replace( /[0-9]+/, function(thread_id) {
                    thread_id = parseInt(thread_id, 10);
                    if ( thread_id < current_thread ) {
                        warning.hide();
                    } else if ( thread_id > current_thread ) {
                        warning.show().text( 'Your merge destination was created after your merge source.  If you really want to do this, please merge the other thread into this one.' );
                    } else {
                        warning.show().text( 'You can\'t merge a thread with itself' );
                    }
                });
            })
                .trigger( 'input' );
        }
    },
    { // merging
        match_pathname: '/inlinemod.php',
        match_params: {
            p: false
        },
        // match_params: { 'do': 'mergethreadcompat' }, // not present when merging more than two threads at once
        match_elements: [ 'select[name="frame"]', 'input[name="do"][value="domergethreads"]' ],
        callback: function(stash, pathname, params) {

            var submit_state = 'start';

            bb.when( $('#destthread option').map(function() { return $.get( '/showthread.php?t='+this.value ) }).get() ).done(function(threads) {
                var forums = {}, forum_count = 0;
                threads.forEach(function(thread) {
                    var forum_id = $(thread[0]).find('.navbit:not(.lastnavbit) a').last().attr('href').split('?f=');
                    if ( !forums.hasOwnProperty(forum_id) ) {
                        ++forum_count;
                        forums[forum_id] = 1;
                    }
                });
                if ( forum_count > 1 ) {
                    $('.description').last().after('<p style="border: 4px solid black; background: #800; color: white; padding: 1em">Warning: merging threads from ' + forum_count + ' forums.  Make sure these are all on the same topic, and check the destination forum is correct.</p>');
                }
            });

            $('form[name="vbform"]').submit(function(event) {

                if ( submit_state != 'done' ) event.preventDefault();
                if ( submit_state == 'start' )
                    submit_state = 'progress';
                else
                    return;

                $('input[type="submit"]').before(loading_html);

                var destination_forum  = $('#destforum').val();
                var destination_thread = $('#destthread option:selected').val();
                var destination_title  = $('#destthread option:selected').text().replace(/^\s*\[[0-9]+\]\s*|\s*$/g, '');

                $.when.apply(
                    $,
                    $('#destthread option:not(:selected)').map(function() {
                        return stash.report_merge( this.value, this.text.replace(/^\[[0-9]*\]\s*/, ''), destination_forum, destination_thread, destination_title )
                    }).get()
                ).done(function() {
                    submit_state = 'done';
                    $('form[name="vbform"]').submit();
                });

            });

        }
    },

    { // unmerge threads
        match_pathname: [ '/showthread.php' ],
        // match_params: { t: mod_log_thread }, // doing this neatly would be an architectural hassle, TODO: consider said hassle some day
        match_elements: [ '#below_postlist' ],
        callback: function(stash, pathname, params) {
            var merge_log = v.resolve('policy', 'merge log thread id');
            if ( params.t == merge_log ) {
                // Unmerge data in the merge log
                $('.bbcode_code').each(function() {
                    var $code = $(this);
                    $code.text().replace( /\/\* BEGIN THREAD MERGE DATA \*\/\s*((?:.|\n)*?)\s*\/\* END THREAD MERGE DATA \*\//, function( match, json ) {
                        var data = JSON.parse(json);
                        var variable_data = {
                            'current thread id': data.thread_id,
                            'current thread title': data.title,
                            'destination thread title' : data.title
                        };
                        $('<input type="button" value="Unmerge this thread">')
                            .insertAfter($code.parent())
                            .click(function() {
                                bb.thread_create( data.forum_id, data.title, v.resolve('report process', 'unmerge notification body', variable_data) ).done(function(html) {
                                    var new_thread_id = $(html).find( 'input[name="t"]' ).val();
                                    if  ( typeof(new_thread_id) == 'undefined' ) {
                                        alert("Failed to create unmerge thread - please try again later");
                                    } else {
                                        variable_data['destination thread id'] = new_thread_id;
                                        bb.posts_move( new_thread_id, data.posts ).done(function() {
                                            bb.thread_reply({
                                                thread_id: merge_log,
                                                title    : v.resolve('report process', 'unmerge title', variable_data),
                                                bbcode   : v.resolve('report process', 'unmerge body' , variable_data),
                                                url      : '/showthread.php?goto=newpost&t='+merge_log
                                            });
                                        });
                                    }
                                });
                            });
                    });
                });
            }
        }
    },


    { // infraction pages
        match_pathname: '/infraction.php',
        match_params: {
            'do': [ 'report', 'update' ]
        },
        match_elements: '#ci_reason',
        callback: function(stash, pathname, params) {

            $('input[name=infractionlevelid]').click(function() {
                var warning_links = $('input[name^=warning]'),
                    is_warning = ( warning_links.filter(':checked').length ) ? true : false,
                    infraction = $.trim($(this).parent().text())
                ;
                warning_links.hide().prop( 'checked', false );
                $(this).closest('tr').find('input[name^=warning]').show().prop( 'checked', is_warning );

                var forum  = $('#breadcrumb .navbit a[href^="forumdisplay.php"]').last().attr('href');
                var thread = $('#breadcrumb .navbit a[href^="showthread.php"]'  ).last().attr('href');

                $('#note').val( ( is_warning ? 'Official warning for ' : 'Infraction for ' ) + infraction.toLowerCase() );
                BabelExt.utils.runInEmbeddedPage(
                    "vB_Editor['vB_Editor_001'].write_editor_contents(" + JSON.stringify(
                        v.resolve(
                            'violation info',
                            [ thread ? 'infraction' : 'user infraction', infraction ],
                            {
                                violation: infraction,
                                name: $('.vbform .blocksubhead').first().text(),
                                'infraction type': is_warning ? 'official warning' : 'infraction',
                                'post id': thread && thread.split(/#post/)[1],
                                action: 'edited'
                            },
                            'string',
                            forum  &&  forum.split('?f='   )[1],
                            thread && thread.split(/\?t=|&/)[1]
                        )
                    ) + ");"
                );
            });
            $('input[name^=warning]').click(function() {
                $(this).closest('tr').find('input[name=infractionlevelid]:checked').click();
            });

            if ( params['do'] == 'report' ) {
                $('input[name=infractionlevelid]:checked').closest('tr').find('input[name^=warning]').prop( 'checked', true );
                $(function() {
                    $('input[name=infractionlevelid]:checked').click();
                });
            } else {
                $('input[name^=warning]').hide();
                $('input[name=infractionlevelid]:checked').closest('tr').find('input[name^=warning]').show();
            }

        }
    },


    /*
     * ADD "REPORTED POSTS FORUM" extras
     */
    {
        match_pathname: '/showthread.php',
        match_elements: [ '#breadcrumb .navbit a[href="forumdisplay.php?f=48"]', '#below_postlist' ],
        callback: function(stash, pathname, params) {

            if ( $('a[href="forumdisplay.php?f=71"]').length ) return; // disable extras in the dupe account forum

            var pm_worthy_violations = {};
            v.resolve('policy', 'pm-worthy violations', {}, 'array of items').forEach(function(violation) { pm_worthy_violations[violation.value] = true });
            var infraction_worthy_violations = {};
            v.resolve('policy', 'infraction-worthy violations', {}, 'array of items').forEach(function(violation) { infraction_worthy_violations[violation.value] = true });

            var first_post = bb.process_posts()[0],
                user_to_review = first_post.message_element.find('a').filter(function() { return this.href.search(/member.php\?/) > -1 && !$(this).closest('bbcode_container').length }).eq(1),
                user_to_review_id = user_to_review.attr( 'href' ).split( '?u=' )[1]
            ;

            var promises = stash.build_user_report(
                user_to_review.html(),
                user_to_review.text(),
                user_to_review_id,
                $(
                    '<li class="postbitlegacy postbitim postcontainer new">' +
                      '<div class="posthead"><span class="postdate new"><span class="date">User information</span></span></div>' +
                      '<div class="postdetails">' +
                        '<div class="userinfo">' +
                          '<div class="username_container"><a class="username guest"><strong>Moderator tools</strong></a></div>' +
                          '<hr>' +
                          '<span class="usertitle">Browser extension</span>' +
                        '</div>' +
                        '<div class="postbody">' +
                          '<div class="postrow">' +
                            '<div class="content"></div>' +
                          '</div>' +
                          '<div class="cleardiv"></div>' +
                        '</div>' +
                      '</div>' +
                    '</li>'
                ).appendTo( '#posts' ).find('.content')
            );

            stash.review_post_promise.done(function(html, post) {
                if ( post.find( '.deleted' ).length )
                    first_post.message_element.find('a[href^="' + location.origin + '/showthread.php?t="]').first().after( ' <em>(this post has now been deleted)</em>' );
                if ( html.find( '#newreplylink_top' ).text() == 'Closed Thread' )
                    first_post.message_element.find('a[href^="' + location.origin + '/showthread.php?t="]').first().after( ' <em>(this thread has now been closed)</em>' );

                var post_text = first_post.message_element.find('blockquote > .bbcode_container').eq(1);
                var post_text_inner = post_text.find('.quote_container').first();
                post = post.clone();
                $('<ul></ul>').append(post).insertBefore(post_text);
                post.find('.content .postcontent').empty().append(post_text_inner);
                post_text_inner.attr( 'class', '' ).children('.bbcode_quote_container').remove();
                post_text.remove();

            });

            first_post.linking.find('.infraction').remove();

            var thread_closed = $( '#newreplylink_top' ).text() == 'Closed Thread';
            var thread_status = thread_closed ? 'closed' : 'open';
            var mod_posts = bb.process_posts( $('.flare_Moderator').closest('li') );

            var logged_in_user = $('.welcomelink a').text();

            var report_owner = ( mod_posts.filter(function() { return this.title.search(/^(?:Reported Item$|Reported Post by )/) == -1 })[0] || { username: undefined } ).username;
            if ( report_owner ) {
                if ( thread_status == 'open' ) thread_status = ( report_owner == logged_in_user ) ? 'yours' : 'taken';
            } else {
                report_owner = mod_posts.length ? mod_posts[0].username : logged_in_user;
            }

            // guess the default action from mod posts:
            var infraction_id, logged_in_user_has_suggested_infraction_id;
            mod_posts.each(function() {
                var infraction_name = this.message_element.find('.quote_container').first().text().replace(/^\s*|[.\s]*$/g,'') || '';
                var infraction = stash.infractions.filter(function(infraction) { return infraction.name == infraction_name });
                if ( infraction.length ) {
                    if ( !infraction_id || ( this.username == logged_in_user && !logged_in_user_has_suggested_infraction_id ) ) {
                        logged_in_user_has_suggested_infraction_id = this.username == logged_in_user;
                        infraction_id = infraction[0].id;
                    };
                }
            });

            var take_thread_text;
            if ( thread_status == 'open' ) {
                take_thread_text = '<span>+</span> Take this thread';
                if ( report_owner != logged_in_user ) take_thread_text += ' from ' + report_owner;
            } else {
                if ( report_owner == logged_in_user ) {
                    take_thread_text = 'Your thread';
                } else {
                    take_thread_text = 'Taken by ' + report_owner;
                }
            }

            function take_thread(event) {
                if ( take_thread_text !== 'Your thread' || confirm( "You have already taken this thread - are you sure you want to post again?" ) )
                    stash.take_thread_and_go( location.toString(), params.t );
                event.preventDefault();
            }
            $('<a title="Click to take this thread" class="newcontent_textcontrol" rel="nofollow" href="newreply.php?t='+params.t+'&noquote=1" style="margin-left:10px;">' + take_thread_text + '</a>')
                .insertAfter('#newreplylink_top,#newreplylink_bottom')
                .click(take_thread)
                .last().css({ 'margin-left': '155px' }); // only apply to the element at the bottom, which is styled differently for some reason

            var common_actions = $(
                '<li class="postbitlegacy postbitim postcontainer common-actions">' +
                  '<div class="posthead"><span class="postdate"><img alt="Default" src="images/icons/vbposticons/icon2.gif" title="Arrow"> Common actions</span></div>' +
                  '<a style="display:none" class="username" href=""></a>' + // the Forumite's Friend extension expects to see a username for each post
                  '<div class="postdetails">' +
                    '<div class="postrow content"><blockquote class="postcontent restore"></blockquote></div>' +
                    '<div class="cleardiv"></div>' +
                  '</div>' +
                    '<div class="postfoot"><div class="textcontrols floatcontainer">' +
                    '<span class="postcontrols">&nbsp;</span>' +
                    '</div></div>' +
                  '<hr>' +
                '</li>'
            ).appendTo('#posts');

            switch ( thread_status ) {
            case 'yours':
                var expected_title_suffix = v.resolve('report process', 'report title suffix', { moderator: $('.welcomelink a').text() });
                if ( document.title.search( expected_title_suffix.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1") ) == -1 )
                    bb.thread_edit({
                        thread_id: params.t,
                        title: document.title.replace(
                            new RegExp(
                                v.resolve('report process', 'report title suffix', { moderator: "\uE000" })
                                    .replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1") // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
                                    .replace( "\uE000", '.*?' )
                                    + '$'
                            )
                        ) + expected_title_suffix,
                        notes: 'appending username',
                        close_thread: thread_closed
                    });
                handle_thread();
                break;
            case 'taken':
                var report_owner_id = mod_posts.filter(function() { return this.username == report_owner })[0].user_id;
                common_actions.find('.postcontent').html(
                    '<ul style="margin: 1em; padding-left: 1em">' +
                        '<li><a href="/private.php?do=newpm&u=' + report_owner_id + '">PM the report owner (' + report_owner +')</a>' +
                        '<li><a href="/newreply.php?t=' + v.resolve('policy', 'mod log thread id') + '">Copy an appeal to the moderation log</a>' +
                        '<li><a href="/infraction.php?do=report&u='+user_to_review_id+'">Give a warning or infraction for publicly contesting this action</a>' +
                        '<li><a href="/showgroups.php">Find an administrator</a> and PM them the post and user name if you want an infraction revoked' +
                        '<li><a href="#handle">Handle it anyway</a>' +
                    '</ul>'
                )
                    .find('a[href="#handle"]').click(function(event) {
                        handle_thread();
                        event.preventDefault();
                    });
                break;
            case 'open':
                if ( report_owner == logged_in_user ) {
                    common_actions.find('.postcontent').html(
                        '<a class="newcontent_textcontrol" href="newreply.php?t='+params.t+'&noquote=1" rel="nofollow" title="Click to take this thread" style="margin: 1em 50%; font-size: 200%">Take&nbsp;this&nbsp;thread</a>'
                    )
                        .find('a').click(take_thread);
                    break;
                }
                // FALL THROUGH
            default:
                common_actions.find('.postcontent').html(
                    '<ul style="margin: 1em; padding-left: 1em">' +
                        '<li><a href="/usernote.php?do=newnote&u=' + user_to_review_id + '">Post a new user note</a> for the reported user' +
                        '<li><a href="/forumdisplay.php?f=47">Check the infractions/warnings forum</a>' +
                        '<li><a href="/newreply.php?t=' + v.resolve('policy', 'mod log thread id') + '">Copy an appeal to the moderation log</a>' +
                        '<li><a href="/infraction.php?do=report&u='+user_to_review_id+'">Give a warning or infraction for publicly contesting this action</a>' +
                        '<li><a href="/showgroups.php">Find an administrator</a> and PM them the post and user name if you want an infraction revoked' +
                    '</ul>'
                );
            }

            var forum_to_review_id;
            function handle_thread() {

                if ( !forum_to_review_id ) {
                    stash.review_post_promise.done(function(html) {
                        forum_to_review_id = $('#breadcrumb .navbit a[href^="forumdisplay.php"]').last().attr('href').split('?f=')[1];
                        handle_thread();
                    });
                    return;
                }

                var infraction_count = 0, warning_count = 0;
                promises.userinfo.done(function( data ) {

                    infraction_count = data.infraction_count;
                       warning_count = data.warning_count;

                    // Do not PM for issues mentioned in the title:
                    var pm_worthy_re = new RegExp( '(?:' + Object.keys(pm_worthy_violations).join('|') + ')', 'gi' );
                    data.pm_titles.forEach(function(title) {
                        title.replace( pm_worthy_re, function(match) {
                            delete pm_worthy_violations[ match.toLowerCase() ];
                        });
                    });

                    $('input[name="issue-type"]:checked').click();
                });

                var foreground_colour = $('.navbit').css( 'color' );

                $("head").append(
                    "<style type='text/css'>" +

                        '.common-actions #default-actions textarea { height: 2.1em; width: inherit; min-height: 2.1em; min-width: 100% }' +

                        '.common-actions #issues ul { margin: 0 }' +
                        '.common-actions #issues ul > li { list-style: none }' +

                        '.common-actions .row { clear: both }' +
                        '.common-actions .column1 { margin-left: 1em; width: 28em; float: left }' +
                        '.common-actions .column2 { margin-left: 30em }' +

                        '.common-actions .delete .vbcode { color: red }' +
                        '.common-actions .ignore .vbcode { opacity: 0.25 }' +

                        '.common-actions .label-input div > * { display: table-cell; vertical-align: sub; margin-right: 0.25em }' +
                        '.common-actions .label-input div { display: inline-table }' +
                        '.common-actions .label-input { display: inline-block; border-spacing: 0 }' +

                        '.common-actions .link-to-post-info { border-bottom: 1px solid '+foreground_colour+'; padding-bottom: 0.5em; margin-bottom: 0.5em }' +

                        '.common-actions .useraction div.none, .common-actions .useraction div.pm, .common-actions .useraction div.warn, .common-actions .useraction div.infract { display: none }' +
                        '.common-actions .useraction.none .none,.common-actions .useraction.pm .pm,.common-actions .useraction.warn .warn,.common-actions .useraction.infract .infract { clear: both; display: inherit }' +
                        '.common-actions .useraction-level-text { margin: 0 1em; display: none }' +
                        '#useraction-level { padding: 0 1em; width: 100%; box-sizing: border-box }' +
                        '#useraction-level[data-value="0"]::-moz-range-thumb { background: white }' +
                        '#useraction-level[data-value="1"]::-moz-range-thumb { background: black }' +
                        '#useraction-level[data-value="2"]::-moz-range-thumb { background: #FF0 }' +
                        '#useraction-level[data-value="3"]::-moz-range-thumb { background: #FF0 }' +
                        '#useraction-level[data-value="4"]::-moz-range-thumb { background: #FF0 }' +
                        '#useraction-level[data-value="5"]::-moz-range-thumb { background: #866 }' +
                        '#useraction-level[data-value="6"]::-moz-range-thumb { background: #F80 }' +
                        '#useraction-level[data-value="7"]::-moz-range-thumb { background: #F40 }' +
                        '#useraction-level[data-value="8"]::-moz-range-thumb { background: #F00 }' +

                        '#useraction-level-1 input, #useraction-level-2 input, #useraction-level-3 input, #useraction-level-4 input { float: right }' +
                        '#useraction-level-5 input, #useraction-level-6 input, #useraction-level-7 input, #useraction-level-8 input { float: left  }' +
                        '#useraction-level-5, #useraction-level-6, #useraction-level-7, #useraction-level-8 { text-align: right }' +
                        '#useraction-level-1 span { margin-left: 11% }' +
                        '#useraction-level-2 span { margin-left: 22% }' +
                        '#useraction-level-3 span { margin-left: 33% }' +
                        '#useraction-level-4 span { margin-left: 44% }' +
                        '#useraction-level-5 span { margin-right: 33% }' +
                        '#useraction-level-6 span { margin-right: 22% }' +
                        '#useraction-level-7 span { margin-right: 11% }' +
                        '#useraction-level-8 span { margin-right:  0% }' +

                        '.common-actions .per-post.vbcode-mode.hand-edit div.vbcode,.common-actions .per-post.vbcode-mode textarea.vbcode { display: none }' +
                        '.common-actions .per-post.vbcode-mode.hand-edit textarea.vbcode { display: block }' +
                        '.common-actions .preview-mode .vbcode,.common-actions .preview-mode .switch-mode-preview, .common-actions .vbcode-mode .preview,.common-actions .vbcode-mode .switch-mode-vbcode { display: none }' +

                        '.common-actions .switch-mode-preview, .common-actions .switch-mode-vbcode { width: 14em; margin: 0 0.25em }' +

                        '.common-actions del { text-decoration: line-through; color: red }' +
                        '.common-actions ins { color: green }' +

                        '.common-actions fieldset { border: 1px solid '+foreground_colour+'; padding: 1em }' +
                        '.common-actions legend, .common-actions h1 { color: '+foreground_colour+'; font-size: larger; font-weight: bold; margin-bottom: 0.25em }' +

                        '.common-actions textarea { width: 100%; height: 20em }' +

                        '.april-fools { width: 100%; padding: 0.5em; margin: 0.75em 0 1em 0; color: red }' +

                        '.attments .deleted .denied { width: 50px; height: 50px; position: absolute; display: inline-block; background: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAB3RJTUUH3wEbBBcOcPb8OQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAg+SURBVGjexdpdjF1VFQfw3z53pnOHMoWkHb4sBatg+f6UAJLYATVSIAhowyNI9M2gMTG+CH4kygsJTTQEiUQejFogoAbU1NKiWBGKYOsUrFoKtEKcKSkdysy0c8/2Ye+BO6d3Zm6nt2Unk0nmnDl7//de67/Wf60dHOLYQO8IfTVOwFKcGjgZPZEFBXUoGQvswXjkdWzHtgZv9jFyOaOHso4wl39aTW2M+smcUXJO4HKcjhPRHzg2MpZf78q/G4iBesnuwBDewNbIhoLNI2wZY3xlevfwAbmT4gZ6h7mk4ALchA8HFqKWfw5mNGJa9C680uCRwAtv8dwg736HsuNAImE9vQW3l9yOBeiNaZfDIVpozGsZw9uBVfO5Zy9jy9OzzgD5N7UdXIWbIl8O2vx6ei/micLB7G7k/oKHS9YOtGFqs358O13b+R6ujFwyy6LLQCzZH9LkXTE7caAXE5FaQXckBIpZpn8usDZyxwD75wxkHefjqzGdxqKQGagFgDHsDQyX7Ii8FhmqMR7YUxIiCwLzQiKDJVgcWYT50303M91wZG3BPQO8eNBA1nF+5A6sQFeoOHI2mYhXIy/jTyVbuvjPXoZ7GO0i9LFvF2Ee3RPEcXrnp01Z2uCswBWRMwKnSKcUKvM0MIEnAt+dDkyYwZx+E/nsDGwzjL9HHivZOMrgGBMr2dcmhc+r09XLWbi4xudwbqbv6djv97iulZkdAOQPfKjgNnwJJ7b6aEyB7eGS+2psGmL/XLh/Mib1093g3Mj1Na4MXIh5LU7mjZL78ZNPsbP5eVeVYp9KO3RNZPEM9rgAJ9TYM/B+4JvTyBvQwLO/5X81NkVuxorQBCZv6OIa1xY8s57/NlNzrTnYTaTgdltk+XQO2DROiyy6hcEHk5kd8vgZu29hZ4OtNeZHlrXwzaMjExNsWcrbT2Uw7720iqNGubXgizlSt8P3Z3cazIOMXceuHl4vOC6k/K3WNGc9sCSyp48XH8o+WUzaaU47bnQgiEb2ienA3By5cx3LdGisTIz3En4R+Vs80P8WFtzYz3mTfygm7bSLxYFzWuRLYwX3Yc1MYHC3Do4Bdo/z1wZPYihOTSZqITHc0ilA/sjxkXul6DslUkf+XOf7A3ym5JczzL3iSX7eyZO5mu2BX2FTi6yojnvXJPmg2EDveGKpPfHAl1+NPDaamang2zOBORxmVmNTg8cir1YDcjb5FRvoLUboK7g8sLA5qua046WSjUM5AA3w8pEGk+feGHipSeNMJqELa1w2Ql9R44TAaS18Y2/k6VEGm4Ndu2A65TMraYwyGHkaeyvz1Aou7aJeZIc5sRlIzmKH5bSjhSPOCgYr1vF4J8CcxP4agzmBbBZbtZKeLk4tcCr6K0iLkh0F26bLnY4kmIvZH9mGHaHix5H+/VxYBE4OHFtNnyOv7Z0lyLULphNstpfhBq+VlYSx4NjAyUWudoxVTqQRGeppo7JxpAigh9HIUKgEx7z2nq4seKpZcFcWRW3J04GkR25eR1/WL9MRwAJcMxcgXUmcjVcTXVm0FbnuVKvw82jOZfYd5HxfP1xmti/5yZ68tilRvsis1cm04uWr0s4/0WlqXjhLvaPIJZhGc6AJqcxzzEhF3HyQJzOS9P6CQG/F5CcwVuQwX0U7EZg30X7V57ATwASxQY8WcS2yp5Ccul55UAv0j1eSyA/SzMbTSfTHSgaS1z5eRF4v2V2xt+7IkvmpXHOofnPNTGDaDZq58rKkoLuy6btjEmG254LyFO0eWFyydPXc/aRjPrM6mflHilQLCwfmlbYXUuh/o+LwBRaVnFU/kLePuM/U6So4M6ZTaWbaRl77tqLBm7m0X5WT82tc0ctZqw++yt4xMKup9eZCXrKwqTIcWxu8WfQxEtmAXc2BJov85d2cMteaVScIIMvwUwo+WTSRUg7cuyIb+hgpLme0YHNonaochR+s4/gOB862CeCZlNDeFVN5SEVYvVKwOWNghC0T3BHZUZWTJUeXfGVtqs12crRDAI+/y925llVN33fikddTtSU5zliKJS+E9LBRQd2Pq0oufbSS7h8Bn1mBz4fk5KHiGztLXqjnzL0GDxGvZbie9Pv5zU4VKEIqlPV0s/U6dj3UIrrOsRg3fCv/KFPh+uxpwPSo9FFiatU9UPDYtSkjnuoTz9H7DqtyAbvVeAi3dzN8xSyNl4Md2SdWzNbMyT26H0e+NsC7U+paTSpsrODhhKnl+AIemODT65O26DQBrJnpnQziWTyyvCL6pgBZTtzPYJl6Iztia9q9ssG3GnxjDR9fR70TceaZJFlflHZ5umT1HTy5mLVV7R6mOeZl+GYu78+bpos0hE0lj0aeH2XwJPZf3KbJNTd6AhcV3IDzQsrvWnXH9gV+gbuyIjUrkAym3dbbdrzc4OmCwYJt1dbbpJ5obr2VqQw1GbGX5WpOZ1tvk2M98yK/xidwdBtthqFcINga+Zd0Oq/mZ6fElLmeHvhoTEF2kdynj9M4Nt4JPF3n+ktnkN6hDTZZ1mBlwQAuCBwzgzN2sj39dsmLgScDq1uZ00EBIfUVAxcFrg7v91DacvA5XBhoRN7CIw1+F9hY7RfOGUg2szCf+t7Ud79dOpn6+6x4SGPyG6OSbF1Vsmo5o6FNud02bf401WDL+Skt+EvJlpDqWN3oCS3ovJ3dz+Y2hM34UckPA4+uZ3TgIGoGc77mVKenjzMnOLfGZfI1p0h/8f41p9C0We9dc4pJWg/FrIXKJCM2v8GWOmOH/ZrTTGMtS7o4teRjuU8ecFzM5JAvnb2ZperzBf+s8coV6RLaIY//AxfkPDY47lXCAAAAAElFTkSuQmCC") center no-repeat; }' +
                    "</style>"
                );

                // making an nice-looking input with a label is a bit fiddly, so we automate it:
                var input_id = 0;
                function make_input( type, name, value, label, checked, extra ) {
                    ++input_id;
                    return (
                        '<div class="label-input">' +
                            '<div>' +
                            '<input type="'+type+'" name="'+name+'" value="'+value+'" id="mod-tools-input-'+input_id+'"' + (checked?' checked':'') + (extra||'') + '>' +
                                '<label for="mod-tools-input-'+input_id+'">'+label+'</label>' +
                            '</div>' +
                        '</div>'
                    );
                }

                var search_replace_html =
                    '<div class="search-replace-block" style="margin-bottom: 0.5em">' +
                      '<textarea placeholder="search for" class="search-for"></textarea>' +
                      '<textarea placeholder="replace with" class="replace-with"></textarea>' +
                      '<div style="position: absolute"><ul style="top:0;min-width:100%;width:inherit" class="popupbody memberaction_body"></ul></div>' +
                    '</div>'
                ;

                var violation_variable_data = {
                    name: user_to_review.text(),
                    violation: '<span class="issue-name"></span>',
                    points: '<span class="issue-points"></span>',
                    message: '<div class="preview"></div><textarea class="vbcode" placeholder="notification message"></textarea>'
                };

                var switch_mode = '<input type="button" class="switch-mode-preview" value="switch to preview mode"><input type="button" class="switch-mode-vbcode" value="switch to vB Code mode">';

                var form = $(
                    '<div class="row">' +
                      '<div class="column1" id="issues">' +

                        '<fieldset>' +
                          '<legend>Type of issue</legend>' +
                          make_input( 'radio', "issue-type", '', 'Issue not yet specified', true, ' disabled' ) + '<br>' +
                          stash.infractions.map(function(infraction) { return make_input( 'radio', "issue-type", infraction.id, infraction.name, undefined, ' data-points="'+infraction.points+'"' ) + '<br>' }).join('') +
                          '<br>' + make_input( 'checkbox', "allow-multiple", 1, "Multiple infractions" ) +
                        '</fieldset>' +
                        '<fieldset>' +
                          '<legend>About this issue type</legend>' +
                          '<div id="issue-info"></div>' +
                        '</fieldset>' +

                        '<fieldset>' +
                          '<legend>Further information</legend>' +
                          '<ul>' +
                            '<li><a href="/showthread.php?t=18103">Forum Rules</a> (covers most issues)' +
                            '<li><a href="https://www.frontier.co.uk/legal/terms/">Frontier Developments Terms of Service</a>' +
                            '<li><a class="forum-rules" data-forum="65" href="/showthread.php?t=38002">Groups Forum Rules</a>' +
                            '<li><a class="forum-rules" data-forum="64" href="/showthread.php?t=37996">Roleplaying Forum Rules</a> ' +
                            '<li><a class="forum-rules" data-forum="34" href="/showthread.php?t=4213">DDF rules and format</a>' +
                            '<li><a class="forum-rules" data-forum="44" href="/showthread.php?t=9201">Alpha Forum Rules & Guidelines</a>' +
                          '</ul>' +
                        '</fieldset>' +

                        '<fieldset id="default-actions">' +
                          '<legend>Default actions</legend>' +
                          '<div>' + search_replace_html + '</div>' +
                          '<input id="delete-posts" type="checkbox"><label for="delete-posts">delete posts</label>' +
                        '</fieldset>' +
                        '<fieldset>' +
                          '<legend>Also process posts that&hellip;</legend>' +
                          make_input('checkbox', 'apply-to', 'quotes', '&hellip; quote the reported post <span id="apply-to-quotes"></span>', true ) + '<br>' +
                          make_input('checkbox', 'apply-to', 'search', '&hellip; match a search pattern <span id="apply-to-search"></span>' ) + '<br>' +
                          make_input('checkbox', 'apply-to', 'link-direct', '&hellip; link to the reported post <span id="apply-to-link-direct"></span>' ) + '<br>' +
                          make_input('checkbox', 'apply-to', 'link-indirect', '&hellip; quote/link to a processed post <span id="apply-to-link-indirect"></span>' ) + '<br>' +
                          make_input('checkbox', 'apply-to', 'after', '&hellip; were posted after the processed post <span id="apply-to-after"></span>' ) + '<br>' +
                          '<br>Total examined posts: <em id="total-processed"></em>' +
                          '<br>Total edited posts: <em id="total-edited"></em>' +
                          '<br>Total deleted posts: <em id="total-deleted"></em>' +
                        '</fieldset>' +

                      '</div>' +

                      '<div class="column2">' +

                        // April fools!
                        ( new Date().getMonth() == 3 && new Date().getDate() == 1 ? '<input type="button" class="april-fools" value="BAN THEM ALL!">' : '' ) +

                        '<fieldset class="useraction none vbcode-mode">' +
                          '<legend>User action</legend>' +
                          '<div style="margin-bottom: 1em" class="posthead">' +
                            '<input id="useraction-level" type="range" data-value="0" min="0" max="8" value="0">' +
                            '<div class="useraction-level-text" id="useraction-level-0" style="display: block"><img src="images/buttons/add-infraction_sm.png" style="visibility: hidden">no action</div>' +
                            '<div class="useraction-level-text" id="useraction-level-1"><span><img src="images/buttons/add-infraction_sm.png">explanatory PM</span>'+switch_mode+'</div>' +
                            '<div class="useraction-level-text" id="useraction-level-2"><span><img src="images/buttons/yellow-card_sm.png">first warning</span>'+switch_mode+'</div>' +
                            '<div class="useraction-level-text" id="useraction-level-3"><span><img src="images/buttons/yellow-card_sm.png">second warning</span>'+switch_mode+'</div>' +
                            '<div class="useraction-level-text" id="useraction-level-4"><span><img src="images/buttons/yellow-card_sm.png">final warning</span>'+switch_mode+'</div>' +
                            '<div class="useraction-level-text" id="useraction-level-5"><span><img src="images/buttons/red-card_sm.png"> infraction with automatic ban (recommended)</span>'+switch_mode+'</div>' +
                            '<div class="useraction-level-text" id="useraction-level-6"><span><img src="images/buttons/red-card_sm.png"> infraction with manual seven-day ban</span>'+switch_mode+'</div>' +
                            '<div class="useraction-level-text" id="useraction-level-7"><span><img src="images/buttons/red-card_sm.png"> infraction with manual one-month ban</span>'+switch_mode+'</div>' +
                            '<div class="useraction-level-text" id="useraction-level-8"><span><img src="images/buttons/red-card_sm.png"> manual permaban</span>'+switch_mode+'</div>' +
                          '</div>' +
                          '<div class="none">' +
                            '(no action will be taken)' +
                          '</div>' +
                          '<div class="pm">' +
                            '<input type="text" placeholder="title" style="width: 30em; margin-bottom: 1em"><br>' +
                            '<div class="preview"></div>' + '<textarea class="vbcode" placeholder="notification message"></textarea>' +
                          '</div>' +
                          '<div class="warn">' +
                            v.resolve( 'report process',    'warning message', violation_variable_data, 'string', forum_to_review_id, stash.thread_to_review_id ) +
                          '</div>' +
                          '<div class="infract">' +
                            '<div style="text-align:center;font-size:larger" id="need-modcp-login"><b>Note:</b> you must log in to ModCP (above) before you can issue a ban.</div>' +
                            v.resolve( 'report process', 'infraction message', violation_variable_data, 'string', forum_to_review_id, stash.thread_to_review_id ) +
                          '</div>' +
                        '</fieldset>' +

                        '<fieldset class="per-post vbcode-mode">' +
                          '<legend>Per-post actions</legend>' +
                          '<div style="text-align: center; margin-bottom: 1em; float: none" class="posthead">' +
                            '<input type="button" id="goto-prev" value="&laquo; prev"> ' +
                             make_input('radio', 'action', '', 'default', true ) + ' ' +
                             make_input('radio', 'action', 'ignore', 'ignore' ) + ' ' +
                             switch_mode +
                             make_input('radio', 'action', 'hand-edit', 'edit by hand' ) + ' ' +
                             make_input('radio', 'action', 'delete', 'delete' ) + ' ' +
                             '<input type="button" id="goto-next" value="next &raquo;">' +
                          '</div>' +
                          '<div class="link-to-post-info"><a id="link-to-current-post"></a> by <a id="link-to-current-post-user"></a></div>' +
                          '<textarea class="vbcode"></textarea>' +
                          '<div class="vbcode" style="white-space: pre-wrap"></div>' +
                          '<div class="preview"></div>' +
                          '<div class="attments"></div>' + // 'attachments' is used by the page CSS
                        '</fieldset>' +

                        '<fieldset>' +
                          '<legend>Extra notes</legend>' +
                            '<textarea id="extra-notes" placeholder="Information that would be useful for future moderators (optional)"></textarea>' +
                          '</fieldset>' +

                      '</div>' +

                    '</div>'

                ).appendTo( common_actions.find('.postcontent').empty() );

                promises.modcp.done(function() {
                    $('#need-modcp-login').remove();
                });

                common_actions.find('.postcontrols').html('<a id="submit-resolution" class="report" href="#submit-resolution"></a>');

                /*
                 * POST CONTROLS
                 */
                var resolution_data = [], commands_in_the_air = 0, resolution_variables = {}, action_count = 0;
                var useraction_data = {
                    get_promises: function() {},
                    titles:   [],
                    variables: function() { return {} },
                    description: ''
                };
                var posts = [], current_post = 0;
                var per_post_actions = {};
                var per_post_data = {
                    get_promises: function() {
                        return (
                            per_post_actions.attment.map(function(post) {
                                return bb.attachments_delete( post.attment.to_delete.map(function(id) { return post.attment.all[id] }) );
                            }).concat(
                                per_post_actions.del .map(function(post) {
                                return post.vbcode_promise.then(function() {
                                    return bb.post_delete(
                                        post.post_id,
                                        v.resolve('report process', [ 'deletion reason', post.is_reported_post ? 'reported post' : 'later post', resolution_variables.violation ], resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id)
                                    );
                                });
                            })).concat(
                                per_post_actions.edit.map(function(post) {
                                return post.vbcode_promise.then(function() {
                                    return bb.post_edit(
                                        post.post_id,
                                        post.replaced_vbcode,
                                        v.resolve('report process', [ 'edit reason', post.is_reported_post ? 'reported post' : 'later post', resolution_variables.violation ], resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id)
                                    );
                                });
                            }))
                        );
                    },
                    titles:   [],
                    variables: function() { return {
                        'per-post actions': '(no actions taken)\n'
                    } },
                    description: ''
                };
                function run_resolution_command(event) { // unlike $.when(), this always waits for all commands to complete/fail before continuing
                    if ( resolution_data.length ) {
                        var resolution_datum = resolution_data.shift();
                        var resolution_commands = resolution_datum.get_promises();
                        if ( resolution_commands.length != resolution_datum.titles.length ) {
                            // sanity check added while tracking down a weird bug
                            alert(
                                "Extension error: the number of commands to run (" + resolution_commands.length + ") doesn't equal the number of command titles (" + resolution_datum.titles.length + ")\n" +
                                "Please copy this message and give it to the extension maintainer, so this bug can be fixed."
                            );
                        }
                        commands_in_the_air = resolution_commands.length;
                        resolution_commands.forEach(function(promise,index) {
                            promise.then(
                                function() {
                                    resolution_datum.titles[index] = '[*] :) ' + resolution_datum.titles[index] + '... OK\n';
                                    if ( !--commands_in_the_air ) {
                                        resolution_variables['actions taken'] += resolution_datum.titles.join('');
                                        run_resolution_command();
                                    }
                                },
                                function() {
                                    resolution_datum.titles[index] = '[*] :o ' + resolution_datum.titles[index] + '... failed\n';
                                    if ( !--commands_in_the_air ) {
                                        resolution_variables['actions taken'] += resolution_datum.titles.join('');
                                        run_resolution_command();
                                    }
                                }
                            );
                        });
                    } else {
                        resolution_variables['actions taken'] += '[/list]'
                        bb.thread_reply({
                            thread_id: params.t,
                            title    : v.resolve('report process', 'post title: close report', resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id),
                            bbcode   : v.resolve('report process', 'post body: close report' , resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id),
                            url      : location.toString(),
                            flip_thread_openness: !thread_closed
                        });
                    }
                }
                $('#submit-resolution').click(function(event) {
                    if ( !action_count ) {
                        bb.thread_reply({
                            thread_id: params.t,
                            title    : v.resolve('report process', 'post title: close report without action', {}, 'string', forum_to_review_id, stash.thread_to_review_id),
                            bbcode   : v.resolve('report process', 'post body: close report without action' , {}, 'string', forum_to_review_id, stash.thread_to_review_id),
                            url      : location.toString(),
                            flip_thread_openness: !thread_closed
                        });
                        event.preventDefault();
                        return;
                    }
                    if ( $('input[name="issue-type"][value=""]').prop( 'checked' ) ) {
                        alert( "Please specify an issue type" );
                        event.preventDefault();
                        return;
                    }
                    resolution_variables = $.extend( resolution_variables, useraction_data.variables(), per_post_data.variables() );
                    resolution_variables['extra notes'] = $('#extra-notes').val();
                    resolution_data.push(
                        {
                            get_promises: function() { return [
                                bb.usernote_add(
                                    user_to_review_id,
                                    v.resolve('report process', 'user notes title: report', resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id ),
                                    v.resolve('report process', 'user notes body: report' , resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id )
                                )
                            ]},
                            titles: [ 'Update [URL="'+location.origin+'/usernote.php?u='+user_to_review_id+'"]user notes[/URL]' ],
                        }
                    );
                    run_resolution_command();
                    $(this).html(loading_html + '...');
                    event.preventDefault();
                });
                function update_submit_message() {
                    resolution_data = [];
                    resolution_variables = {
                        'logged in user': logged_in_user,
                        'actions taken': '[list]\n',
                        'notification type': 'no notification',
                        'report thread': params.t
                    };
                    var actions = [];

                    if ( useraction_data.titles.length ) {
                        resolution_data.push( useraction_data );
                        actions.push( 'Give [i]' + user_to_review.text() + '[/i] an ' + useraction_data.action_text );
                        resolution_variables['notification type'] = useraction_data.description;
                    }
                    if ( per_post_data.titles.length ) {
                        resolution_data.push( per_post_data );
                        actions.push( per_post_data.description );
                    }

                    action_count = actions.length;

                    if ( action_count ) {
                        resolution_variables.overview = actions.join(', ').replace(/^(.)/, function(_,letter) { return letter.toUpperCase() } ) + ', update user notes and close the report';
                    } else {
                        resolution_variables.overview = 'Close the report without taking any action';
                    }

                    $('#submit-resolution').html( resolution_variables.overview.replace( /\[(\/?i)\]/g,'<$1>').replace( /\[img\](.*?)\[\/img\]/, '<img style="position:static" src="$1">' ) );

                };


                $('.switch-mode-vbcode' ).click(function() { $(this).closest('.preview-mode').removeClass('preview-mode').addClass('vbcode-mode'); });
                $('.switch-mode-preview').click(function() { $(this).closest( '.vbcode-mode').removeClass('vbcode-mode').addClass('preview-mode'); });

                /*
                 * PER-POST ACTIONS
                 */

                var post_to_review_id = stash.post_to_review_id;
                var automatic_useraction_level = -1;

                function refresh_post_list_and_searches() {
                    var searches = $('.common-actions .search-for').map(function() {
                        if ( $(this).val() != '' ) return [ [ $(this).val(), $(this.nextSibling).val() ] ];
                    });
                    if ( searches.length ) {
                        var search_count = 0;
                        for ( var n=0; n!=posts.length; ++n ) {
                            var message = posts[n].message;
                            var replacements = searches.map(function() {
                                if ( message.indexOf(this[0]) != -1 )
                                    return (
                                        this[1].length
                                            ? '[i]' + this[0].replace( /\[/g, '[noparse][[/noparse]' ) + '[/i] \u27f6 [i]' + this[1].replace( /\[/g, '[noparse][[/noparse]' ) + '[/i]'
                                            : 'Delete [i]' + this[0].replace( /\[/g, '[noparse][[/noparse]' ) + '[/i]'
                                    );
                            }).get();
                            posts[n].matches_pattern = replacements.length > 0;
                            posts[n].matches_text = replacements.join(', ');
                            if ( posts[n].matches_pattern ) ++search_count;
                        }
                        $('#apply-to-search').text( ' (' + search_count + ')' );
                    } else {
                        for ( var n=0; n!=posts.length; ++n ) {
                            posts[n].matches_pattern = false;
                            posts[n].matches_text = '(no change)';
                        }
                        $('#apply-to-search').text( '' );
                    }
                    return refresh_post_list();
                }
                function refresh_post_list() {

                    if ( refresh_timeout ) clearTimeout(refresh_timeout);

                    var default_action = $('#delete-posts').prop('checked') ? 'delete' : 'edit';

                    var process_post_key = [ 'is_reported_post' ];
                    if ( $('input[name="apply-to"][value="quotes"]'       ).prop('checked') ) process_post_key.push( 'quotes_target'      );
                    if ( $('input[name="apply-to"][value="link-direct"]'  ).prop('checked') ) process_post_key.push( 'links_to_target'    );
                    if ( $('input[name="apply-to"][value="search"]'       ).prop('checked') ) process_post_key.push( 'matches_pattern'    );
                    if ( $('input[name="apply-to"][value="link-indirect"]').prop('checked') ) process_post_key.push( 'links_to_processed' );
                    if ( $('input[name="apply-to"][value="after"]'        ).prop('checked') ) process_post_key.push( 'after'              );

                    per_post_actions = {
                        attment: [],
                        del: [],
                        edit: [],
                    };
                    var next_enabled = 0, links_to_processed_count = 0, link_to_processed_re = null, processed_searches = [], per_post_text = '';
                    $('#goto-prev').prop( 'disabled', true );
                    $('#goto-next').prop( 'disabled', true );
                    var total_processed = 0;
                    for ( var n=0; n!=posts.length; ++n ) {

                        if ( link_to_processed_re ) {
                            posts[n].links_to_processed = posts[n].message_element.find('a').filter(function() { return this.href.search(link_to_processed_re) != -1 }).length > 0;
                            if ( posts[n].links_to_processed ) ++links_to_processed_count;
                        } else {
                            posts[n].links_to_processed = false;
                        }

                        if ( posts[n].is_deleted )
                            posts[n].per_post_action = 'delete';

                        var replacements = $('.common-actions .search-for').map(function() {
                            if ( $(this).val() == '' )
                                return;
                            else
                                return {
                                    from: new RegExp( $(this).val().replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&"), 'gi' ),
                                    to: $(this.nextSibling).val()
                                };
                        }).get();

                        posts[n].is_processed = process_post_key.filter(function(key) { return posts[n][key] }).length > 0;
                        if ( posts[n].is_processed ) {
                            ++total_processed;
                            if ( !posts[n].vbcode_promise ) posts[n].vbcode_promise = bb.post_info(posts[n].post_id);
                            if ( n < current_post )
                                $('#goto-prev').prop( 'disabled', false ).data( 'post', n );
                            else if ( n > current_post && !next_enabled++ )
                                $('#goto-next').prop( 'disabled', false ).data( 'post', n );
                            posts[n].action = posts[n].per_post_action || default_action;
                            if ( posts[n].attment && posts[n].attment.to_delete.length && !posts[n].action != 'delete' ) per_post_actions.attment.push( posts[n] );
                            if ( posts[n].action == 'edit' ) {
                                (function (post) {
                                    post.vbcode_promise.done(function(info) {
                                        var vbcode = info.bbcode;
                                        replacements.forEach(function(replacement) { vbcode = vbcode.replace( replacement.from, function(match) {
                                            return '\uE001' + match + '\uE002' + replacement.to + '\uE003'; // characters from Unicode's private use area
                                        })});
                                        post.replaced_vbcode = vbcode.replace(/\uE001(?:.|\n)*?\uE002((?:.|\n)*?)\uE003/g, '$1' );
                                        post.replaced_html   = BabelExt.utils.escapeHTML(vbcode).replace(/\uE001/g,'<del>').replace(/\uE002/g,'</del><ins>').replace(/\uE003/g,'</ins>')
                                    });
                                })(posts[n]);
                            } else if ( posts[n].action == 'hand-edit' && posts[n].hasOwnProperty('edited_vbcode') ) {
                                posts[n].replaced_vbcode = posts[n].edited_vbcode;
                                posts[n].replaced_html   = BabelExt.utils.escapeHTML(posts[n].edited_vbcode);
                            } else {
                                (function (post) { post.vbcode_promise.done(function(info) {
                                    post.replaced_vbcode = info.bbcode;
                                    post.replaced_html   = BabelExt.utils.escapeHTML(info.bbcode);
                                })})(posts[n]);
                            }

                        } else {
                            posts[n].action = 'ignore';
                        }

                        if ( posts[n].is_processed || posts[n].links_to_processed ) {
                            processed_searches.push(posts[n].post_id);
                            link_to_processed_re = new RegExp( 'showthread\.php(?:\\?|.*&)p=(?:' + processed_searches.join('|') + ')($|&|#)' );
                        }

                        var post_text = '[*] [post='+posts[n].post_id+']post ' + posts[n].post_id + '[/post]: ';
                        switch ( posts[n].action ) {
                        case    'delete': if ( !posts[n].is_deleted     )   per_post_actions.del .push( posts[n] ); per_post_text += post_text + 'deleted\n'; break;
                        case 'hand-edit':                                   per_post_actions.edit.push( posts[n] ); per_post_text += post_text + 'hand-edited\n'; break;
                        case      'edit': if ( posts[n].matches_pattern ) { per_post_actions.edit.push( posts[n] ); per_post_text += post_text + posts[n].matches_text + '\n'; } break;
                        }

                    }

                    per_post_data.variables = (
                        per_post_text
                        ? function() { return { 'per-post actions': '[list]\n' + per_post_text + '[/list]' } }
                        : function() { return { 'per-post actions': '(no actions taken)\n' } }
                    );
                    per_post_data.titles =
                        per_post_actions.del .map(function(post) {
                            return 'Delete [post='+post.post_id+']post ' + post.post_id + '[/post]';
                        }).concat(
                        per_post_actions.edit.map(function(post) {
                            return 'Edit [post='+post.post_id+']post ' + post.post_id + '[/post]';
                        })).concat(
                        per_post_actions.attment.map(function(post) {
                            return (
                                'Remove ' +
                                post.attment.to_delete.map(function(attachment_id) { return '[ATTACH]'+attachment_id+'[/ATTACH]' }).join(', ') +
                                ' from [post='+post.post_id+']post ' + post.post_id + '[/post]'
                            );
                        }));

                    var per_post_messages = [];
                    if ( per_post_actions.del.length ) {
                        per_post_messages.push(
                            'delete ' + per_post_actions.del.length + ' post' + ( per_post_actions.del.length > 1 ? 's' : '' )
                        );
                    }
                    if ( per_post_actions.attment.length ) {
                        var length = per_post_actions.attment.reduce(function(prev, cur) { return prev + cur.attment.to_delete.length }, 0 );
                        per_post_messages.push(
                            'remove ' + length + ' attachment' + ( length > 1 ? 's' : '' )
                        );
                    }
                    if ( per_post_actions.edit.length ) {
                        per_post_messages.push(
                            'edit ' + per_post_actions.edit.length + ' post' + ( per_post_actions.edit.length > 1 ? 's' : '' )
                        );
                    }
                    per_post_data.description = per_post_messages.join(', ');
                    update_submit_message();

                    $('#total-processed').text(total_processed);
                    $('#total-edited').text(per_post_actions.edit.length);
                    $('#total-deleted').text(per_post_actions.del.length);

                    $('#apply-to-link-indirect').text( ' (' + links_to_processed_count + ')' );

                    $('.per-post').removeClass('ignore edit hand-edit delete').addClass( posts[current_post].action );

                    $('.per-post .vbcode').html(loading_html + '...');

                    $('input[name=action][value="'+(posts[current_post].per_post_action||'')+'"]').click();
                    $('input[name=action]').prop( 'disabled', posts[current_post].is_deleted );

                    refresh_post_contents();

                }
                function refresh_post_contents() {
                    return posts[current_post].vbcode_promise.done(function(info) {
                        $('#link-to-current-post')
                            .attr( 'href', '/showthread.php?p=' + posts[current_post].post_id + '#post' + posts[current_post].post_id )
                            .text( posts[current_post].title || 'Post ' + posts[current_post].post_id )
                        ;
                        $('#link-to-current-post-user').attr( 'href', '/member.php?u=' + posts[current_post].user_id ).text( posts[current_post].username );
                        $('.per-post textarea.vbcode').val ( posts[current_post].replaced_vbcode );
                        $('.per-post div.vbcode'     ).html( posts[current_post].replaced_html   );

                        if ( info.attachments ) {
                            if ( !posts[current_post].attment ) posts[current_post].attment = { all: {}, to_delete: [] };
                            info.attachments.forEach(function(attment) { posts[current_post].attment.all[attment.id] = attment });
                            var to_delete = posts[current_post].attment.to_delete;
                            $('.per-post .attments' ).html(
                                '<hr>Attachments without a matching [ATTACH] code will be shown at the bottom of the post - click to delete attachments altogether:<br>' +
                                    info.attachments.map(function(attachment) {
                                        return (
                                            '<a href="#delete" data-id="' + BabelExt.utils.escapeHTML(attachment.id) +
                                                ( to_delete.filter(function(id) { return id == attachment.id }).length ? '" class="deleted' : '' ) +
                                                '" style="display: inline-block; text-align: center; margin: 1em">' +
                                                '<span style="height: 50px; display: inline-block"></span>' +
                                                '<img style="margin-bottom: 0.5em" src="' + BabelExt.utils.escapeHTML(attachment.thumbnail) + '"><br>' +
                                                'Attachment ' + attachment.id + '<br>' +
                                                BabelExt.utils.escapeHTML(attachment.filename) +
                                            '</a>'
                                        );
                                    }).join('')
                            ).find('img').each(function() {
                                $(this).before( '<span style="width: ' + $(this).width() + 'px" class="denied"></span>' );
                            });
                        } else {
                            $( '.per-post .attments' ).html( '' );
                        }

                    });
                }
                $(document).on( 'click', '.per-post .attments a', function(event) {
                    var attment_id = $(this).data('id');
                    if ( $(this).hasClass('deleted') ) {
                        posts[current_post].attment.to_delete = posts[current_post].attment.to_delete.filter(function(id) { return id != attment_id });
                    } else {
                        posts[current_post].attment.to_delete.push(attment_id);
                    }
                    refresh_post_list();
                    event.preventDefault();
                });

                form.find('input[name=action]').change(function() {
                    posts[current_post].per_post_action = $('input[name=action]:checked').val();
                    refresh_post_list();
                });

                form.find('.per-post textarea').on( 'input', function() {
                    posts[current_post].replaced_vbcode = posts[current_post].edited_vbcode = $(this).val();
                });

                stash.review_post_promise.done(function(html) {
                    posts = bb.process_posts(html.find( '#posts').children()).filter(function(post) { return parseInt(this.post_id,10) >= parseInt(post_to_review_id,10); }).get();
                    posts[0].vbcode_promise = stash.review_post_contents_promise;
                    posts[0].is_reported_post = true;
                    var quotes_count = 0, links_count = 0;
                    bb.thread_posts( stash.thread_to_review_id, html ).done(function(more_posts) {
                        posts = posts.concat( more_posts.filter(function(post) { return parseInt(this.post_id,10) >= parseInt(post_to_review_id,10); }).get().slice(posts.length) );
                        $('#apply-to-after').text( ' (' + (posts.length-1) + ')' );
                        var re = new RegExp( 'showthread\.php(?:\\?|.*&)p=' + post_to_review_id + '($|&|#)' );
                        posts.forEach(function(post) {
                            post.after = post.post_id != post_to_review_id;
                            if ( post.message_element.find('.bbcode_postedby > a').filter(function() { return this.href.search(re) != -1 }).length ) {
                                post.quotes_target = true;
                                post.vbcode_promise = bb.post_info(post.post_id);
                                ++quotes_count;
                            }
                            if ( post.message_element.find('a').filter(function() { return !$(this.parentNode).hasClass('bbcode_postedby') && this.href.search(re) != -1 }).length ) {
                                post.links_to_target = true;
                                post.vbcode_promise = bb.post_info(post.post_id);
                                ++links_count;
                            }
                        });
                    });
                    $('#apply-to-quotes').text( ' (' + quotes_count + ')' );
                    $('#apply-to-link-direct').text( ' (' + links_count + ')' );
                    refresh_post_list_and_searches();
                });

                // Firefox collapses whitespace in selections - seems to be a known bug: https://bugzilla.mozilla.org/show_bug.cgi?id=601586
                selectionchange.start(document);
                var needs_mouseup = true, target_search = form.find('.search-for');
                document.addEventListener('selectionchange', function () {
                    var selection = window.getSelection();
                    if ( $(selection.anchorNode).closest('.vbcode').closest('.per-post').length == 0 || $(selection.focusNode).closest('.vbcode').closest('.per-post').length == 0 ) return;
                    target_search.val( selection.toString() );
                    if ( selection.toString() != '' && needs_mouseup ) {
                        $(window).one( 'mouseup', function() {
                            target_search.next().blur();
                            needs_mouseup = true;
                        });
                        needs_mouseup = false;
                    }
                });

                $('.per-post .switch-mode-preview').click(function() {
                    $('.per-post .preview').html(loading_html + '...');
                    refresh_post_contents().done(function() {
                        bb.bbcode_html( stash.thread_to_review_id, posts[current_post].replaced_vbcode )
                            .done(function(html) {
                                $('.per-post .preview').html(html);
                            })
                        ;
                    });
                });

                $('#goto-prev,#goto-next').click(function() {
                    current_post = $(this).data('post');
                    refresh_post_list();
                    $('.per-post .switch-mode-vbcode:visible').click();
                });

                /*
                 * DEFAULT ACTIONS
                 */

                var refresh_timeout = null;
                form
                    .on( 'focus blur', '.search-replace-block', function() {
                        $(this).siblings().filter(function() {
                            return $(this).find('.search-for').val() == '' && $(this).find('.replace-with').val() == '';
                        }).remove();
                        if ( $('.search-for',this).val() == '' && $('.replace-with',this).val() == '' ) {
                            target_search = $(this).find('.search-for');
                        } else {
                            target_search = $(search_replace_html).appendTo( this.parentNode ).find('.search-for');
                        }
                        refresh_post_list_and_searches();
                    })
                    .on( 'input', '.search-replace-block', function() {
                        if ( refresh_timeout ) clearTimeout(refresh_timeout);
                        refresh_timeout = setTimeout( refresh_post_list_and_searches, 500 );
                    })
                    .on( 'focus', '.replace-with', function() {
                        var replace_with = this;
                        $(this.nextSibling) // suggestion box
                            .find('ul')
                            .empty()
                            .append(
                                v.resolve('report process', [ 'replacement', $(this.previousSibling).val() ], {}, 'array of items' )
                                    .map(function(suggestion) {
                                        return $( '<li style="width: 100%">' )
                                            .append(
                                                $('<a href="#suggestion" style="box-sizing: border-box"></a>').text( suggestion.value )
                                                    .mousedown(function(event) { // the 'click' event doesn't work for some reason - maybe trapped by page code?
                                                        $(replace_with).val( $(this).text() );
                                                    })
                                            );
                                    })
                            )
                            .show();
                    })
                    .on( 'blur', '.replace-with', function() { $(this.nextSibling).find('ul').hide() } )
                ;

                $('#delete-posts').change(function() {
                    $('#link-to-deleted').prop( 'disabled', !$(this).prop('checked') );
                    refresh_post_list();
                });

                $('.common-actions input[name="apply-to"]').change(refresh_post_list);

                /*
                 * SEE ALSO
                 */
                stash.review_post_promise.done(function(html) { // grey/bold the forum rules
                    $('.forum-rules')
                        .addClass('shade')
                        .filter('[data-forum=' + html.find('.navbit.lastnavbit').prev().find('a').attr('href').substr(19) + ']' )
                        .removeClass('shade').css({ 'font-weight': 'bold' })
                        .after( ' (post was in this forum)' )
                    ;
                });

                /*
                 * USER ACTION
                 */

                form.find( 'input[name="allow-multiple"]' ).click(function() {
                    if ( $(this).prop('checked') ) {
                        form.find( 'input[name="issue-type"]' )
                            .attr( 'type', 'checkbox' )
                            .each(function() { if ( !$(this).prop('checked') ) $(this).prop('checked', $(this).data('was-checked') ); } )
                    } else {
                        form.find( 'input[name="issue-type"]' )
                            .each(function() { $(this).data( 'was-checked', $(this).prop('checked') ) } )
                            .attr( 'type', 'radio' )
                    }
                });

                function get_issues() {
                    return form.find( 'input[name="issue-type"]:checked' ).map(function() {
                        var issue_name = $.trim($(this.parentNode).text());
                        return {
                                         name:                                             issue_name,
                                    pm_worthy:         pm_worthy_violations.hasOwnProperty(issue_name.toLowerCase()),
                            infraction_worthy: infraction_worthy_violations.hasOwnProperty(issue_name.toLowerCase()) || infraction_count >= 3,
                                       points: parseInt( $(this).data('points'), 10 ),
                                           id:           $(this).val(),
                        }
                    });
                }

                form.find( 'input[name="issue-type"]' ).click(function() {

                    form.find( 'input[name="issue-type"]' ).data( 'was-checked', false );

                    var issues = get_issues();
                    var issue_name = issues.map(function() { return this.name }).get().join(', ');
                    var issue_count =
                        ( issues.length == 0 ) ?     'no issues' :
                        ( issues.length == 1 ) ? 'single issue'  :
                                               'multiple issues'
                    ;

                    // issue an infraction if there's at least one infraction-worthy issue, or a PM if all issues are PM-worthy:
                    var recommended_level = (
                        ( issues.filter(function() { return this.infraction_worthy }).length ) ? 5                    :
                        ( issues.filter(function() { return !this.pm_worthy        }).length ) ? 2 + infraction_count :
                                                                                                 1
                    );
                    form.find( '#useraction-level' )
                        .filter(function() { return automatic_useraction_level == -1 || automatic_useraction_level == this.value }) // ignore if changed by the user
                        .attr( 'value', recommended_level ).val( recommended_level )
                        .trigger('input');
                    automatic_useraction_level = recommended_level;

                    $('#issue-info').html( v.resolve('report process', [ 'information', issue_count, issue_name ], {}, 'string', forum_to_review_id, stash.thread_to_review_id) );
                    $('.issue-name').text(issue_name);
                    $('.issue-points').text(
                        [0].concat(issues.get()).reduce(function(a,b) { return a + b.points })
                    );

                    $('.useraction .switch-mode-vbcode:visible').click();
                });

                form.find('#useraction-level').on( 'input change', function() {
                    form.find('.useraction-level-text').hide().filter('#useraction-level-'+this.value).show();
                    this.setAttribute( 'data-value', this.value );
                });

                form.find('input[name="issue-type"],#useraction-level,#delete-posts,input[name="action"]').on( 'input change', function() {

                    $('.useraction .switch-mode-vbcode:visible').click();

                    stash.review_post_contents_promise.done(function(original_post_info) { stash.review_post_promise.done(function() {

                        var issues = get_issues();
                        var issue_name = issues.map(function() { return this.name }).get().join(', ');
                        var issue_count =
                            ( issues.length == 0 ) ?     'no issues' :
                            ( issues.length == 1 ) ? 'single issue'  :
                                                   'multiple issues'
                        ;

                        var variables = {
                            violation: issue_name.toLowerCase(),
                            'post id': post_to_review_id,
                            action: posts[0].action == 'delete' ? 'deleted' : 'edited',
                            'original post vbcode': original_post_info.bbcode,
                            'logged in user ID': $('.welcomelink a').attr( 'href' ).split( '?u=' )[1],
                            username: posts[0].username,
                            name: user_to_review.text()
                        };

                        $('.useraction').removeClass( 'none pm warn infract' );
                        var useraction_type = Math.min( parseInt( $('#useraction-level').val(), 10 ), 8 );
                        var is_warning = false;
                        switch ( useraction_type ) {
                        case 0:
                            useraction_data = {
                                get_promises: function() {},
                                titles:   [],
                                variables: function() { return variables },
                                description: '',
                                action_text: ''
                            };
                            $('.useraction').addClass( 'none' );
                            break;
                        case 1:
                            $('.useraction .pm input'   ).val( v.resolve('violation info', [ 'PM title', issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id ) );
                            $('.useraction .pm textarea').val( v.resolve('violation info', [ 'PM body' , issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id ) );
                            useraction_data = {
                                description: 'explanatory PM',
                                action_text: '[img]'+location.origin+'/images/buttons/add-infraction_sm.png[/img] explanatory PM',
                                get_promises: function() { return [bb.pm_send( user_to_review.text(), $('.useraction .pm input').val(), $('.useraction .pm textarea').val() )] },
                                titles: [ 'Send explanatory PM to [URL="'+location.origin+'/member.php?u=' + user_to_review_id + '"]' + user_to_review.text() + '[/URL]' ],
                                variables: function() {
                                    return $.extend( variables, {
                                        'notification message': $('.useraction .pm textarea').val()
                                    });
                                }
                            }
                            $('.useraction').addClass( 'pm' );
                            break;
                        case 2:
                        case 3:
                        case 4:
                            is_warning = true;
                            // FALL THROUGH
                        case 5:
                        case 6:
                        case 7:
                        case 8:
                            variables['infraction type'] = ( is_warning ? 'official warning' : 'infraction' );
                            var image = ( is_warning ? '/images/buttons/yellow-card_sm.png' : '/images/buttons/red-card_sm.png' );
                            var textarea = $('.useraction .' + (is_warning?'warn':'infract') + ' textarea');
                            var to_name = ' to [URL="'+location.origin+'/member.php?u=' + user_to_review_id + '"]' + user_to_review.text() + '[/URL]';
                            var titles = [ 'Give an ' + variables['infraction type'] + to_name + ' for [URL="'+location.origin+'/infraction.php?do=view&p=' + posts[0].post_id + '"]post #' + posts[0].post_id + '[/URL]' ];
                            var action_text = '[img]'+location.origin+image+'[/img] ' + variables['infraction type'];
                            var period, expires;
                            switch ( useraction_type ) {
                            case 5:                                                                              action_text += ' with automatic ban'; break;
                            case 6: period = 'D'; expires = 7; titles.push( "Give a seven-day ban " + to_name ); action_text += ' with seven-day ban'; break;
                            case 7: period = 'M'; expires = 1; titles.push( "Give a one-month ban " + to_name ); action_text += ' with one-month ban'; break;
                            case 8: period = 'PERMANENT'     ; titles.push( "Give a permanent ban " + to_name ); action_text += ' with permanent ban'; break;
                            }
                            textarea.val(
                                v.resolve('violation info', [ 'infraction', issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id )
                            );
                            useraction_data = {
                                description: variables['infraction type'],
                                action_text: action_text,
                                get_promises: function() {
                                    var issues = get_issues();
                                    var args = {
                                        administrative_note: 'See ' + document.location.toString(),
                                        reason             : v.resolve('report process', [ 'ban reason', issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id ),
                                        bbcode             : textarea.val(),
                                        user_id            : user_to_review_id,
                                        post_id            : post_to_review_id,
                                        is_warning         : is_warning
                                    };

                                    var ret = [];

                                    if ( issues.length == 1 ) {
                                        args.infraction_id = issues[0].id;
                                        ret.push(bb.infraction_give(args));
                                    } else if ( issues.length == 0 ) {
                                        alert("Please select an issue");
                                        throw "Pleaese select an issue";
                                    } else {
                                        args.reason  = issues.map(function() { return this.name }).get().join(', ');
                                        args.points  = [0].concat(issues.get()).reduce(function(a,b) { return a + b.points });
                                        args.period  = 'M';
                                        args.expires = 3;
                                        ret.push(bb.infraction_give_custom( args ));
                                    }

                                    if ( period ) {
                                        ret.push(promises.modcp.then(function() {
                                            return bb.user_ban({
                                                username: user_to_review.text(),
                                                reason  : resolution_variables.violation,
                                                group_id: is_spam ? 22 : 8,
                                                period  : period,
                                                expires : expires
                                            });
                                        }));
                                    }

                                    return ret;

                                },
                                titles: titles,
                                variables: function() {
                                    return $.extend( variables, {
                                        'notification message': textarea.val()
                                    });
                                }
                            };
                            $('.useraction').addClass( is_warning?'warn':'infract' );
                            break;
                        }

                        update_submit_message();

                    })});

                });

                $('.april-fools').click(function() {
                    // April fools button - pretend to ban each user starting from user ID == 1
                    var ban_messages = [
                        "banned", "banned", "banned", "banned", "banned", "double-banned", "banned", "definitely banned", "banned", "SO banned", "bannity-banned", "banned", "banned", "banned", "not banned... only joking!  BANNED!", "banned", "ray-banned", "banned", "Oh I've wanted to ban that one forever", "banhammered!", "banned", "banned", "banned", "banned", "banned", "banned", "banned", "banned", "banned", "banned.", "banned", "banned", "banned", "Rock Banned", "Guitar Heroed", "banned", "rubber banned", "banned", "banned", "banned", "banned", "banned", "banned", "banned", "banned", "banned", "blanned", "banned", "banned", "barred!", "banned", "banned", "mwuhahaha"
                    ];
                    var box = $('<div style="position: fixed; width: 50%; height: 50%; top: 25%; left: 25%; padding: 1em; background: white; border: 6px double red; border-radius: 8px; overflow: auto"><a style="position: absolute; top: 1em; right: 1em; display: none" href="#cancel">cancel</a></div>').appendTo(document.body);
                    box.find('a').click(function(event) {
                        if ( confirm(
                            "Some variables were not found.  Please add the following:\n\n" +
                            "Cannot download variables (account banned?)\n" +
                            "To fix these issues, paste the above notes into a text editor, go to the variables forum, find the relevant thread, and add or edit the relevant quotes.\n" +
                            "\n" +
                            "Would you like to go there now?"
                        ) ) {
                            alert("Well you can't, so there!");
                        }
                        event.preventDefault();
                    });
                    var user_id = 0;
                    setTimeout(function() { box.find('a').show(500) }, 4000 );
                    setInterval(function() {
                        ++user_id;
                        $.get('/member.php?u='+user_id+')').then(function(html) {
                            var name = $(html).find('#userinfo .member_username').text();
                            if ( !name ) return;
                            var ban = $('<div>' + BabelExt.utils.escapeHTML(name) + '... ' + loading_html + '</div>').prependTo( box );
                            setTimeout(function() {
                                ban.text( name + '... ' + ( ( user_id < ban_messages.length ) ? ban_messages[user_id] : 'banned' ) );
                            }, 500 );
                        });
                    }, 1500 );
                });

                $('.useraction .switch-mode-preview').click(function() {
                    var preview = $('.useraction div.preview:visible');
                    preview.html( loading_html );
                    bb.bbcode_html( stash.thread_to_review_id, preview.next().val() )
                        .done(function(html) {
                            preview.html(html);
                        })
                    ;
                });

                /*
                 * INITIALISATION
                 */

                if ( infraction_id )
                    $('input[name="issue-type"][value="' + infraction_id + '"]').click();
                else
                    $('input[name="issue-type"]').first().click();

                update_submit_message();

            }

        }

    }

)};
