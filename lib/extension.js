BabelExt.utils.dispatch(

    /*
     * GENERAL UTILITIY FUNCTIONS
     */
    {
        pass_storage: ['infractions'],
        callback: function( stash, pathname, params, infractions ) {

            /*
             * Link to Moderated Posts page from moderation links
             */
            $(function(){$('img[src="images/misc/moderated.gif"],img[src="images/misc/moderated_small.gif"]').wrap('<a href="/modcp/moderate.php?do=posts"></a>')});

            /*
             * Sane wrapper around $.when()
             */
            stash.when = function(promises) {
                return $.when.apply( // $.when() wants a variadic list of arguments - allow an array instead
                    $,
                    promises
                ).then(
                    function() {
                        // $.when() behaves differently for 1 vs. many arguments - normalise that behaviour:
                        if ( promises.length == 1 ) {
                            return [ arguments[0] ];
                        } else {
                            return Array.prototype.slice.call( arguments, 0 );
                        }
                    }
                );
            }

            /*
             * Check whether a username/IP address appears on StopForumSpam.com
             */
            var callback_created = 0;
            stash.check_on_stopforumspam = function(url) {
                if ( !callback_created++ )
                    BabelExt.utils.runInEmbeddedPage(
                        'window.stop_forum_spam_callback = ' +
                            function stop_forum_spam_callback(data) {
                                var response = [];
                                if ( data.success ) {
                                    switch ( data.username.frequency ) {
                                    case 0: response.push('username does not appear in the list'); break;
                                    case 1: response.push('username appears once in the list'); break;
                                    default: response.push('username appears ' + data.username.frequency + ' times in the list'); break;
                                    }
                                    switch ( data.ip.frequency ) {
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
                $.ajax({ url: url, dataType: "jsonp", jsonpCallback: 'stop_forum_spam_callback' });
            }

            /*
             * Map a list of <li> elements to data about the posts they represent
             */
            stash.process_posts = function(posts) {
                if ( !posts ) posts = $(document).find('#posts').children();
                return (
                    posts
                        .map(function() {
                            return {
                                container_element: this,
                                post_id          : this.id.substr(5),
                                date             : $('.date'       , this).text(),
                                username         : $('.username'   , this).text(),
                                user_id          : $('.username'   , this).attr('href').substr(13),
                                title            : $('.title'      , this).text().replace(/^\s*/, '').replace(/\s*$/, ''),
                                message          : $('.content'    , this).text().replace(/^\s*/, '').replace(/\s*$/, ''),
                                message_element  : $('.content'    , this),
                                linking          : $('.postlinking', this),
                                ip_element       : $('.ip'         , this),
                                report_element   : $('.report'     , this),
                                ip               : $('.ip'         , this).text().replace(/^\s*/, '').replace(/\s*$/, ''),
                                cleardiv         : $('.cleardiv'   , this),
                            };
                        })
                );
            }

            /*
             * Map vBCode for a post to a list of (non-nested) quotes
             */
            stash.process_quotes = function(text) {
                var ret = [], regex = /\[quote="?([^\n=;\]]+)(?:;([0-9]*))?"?\]|\[\/quote\]/gi, start=0, depth=0, author, post_id, result;
                while ( (result = regex.exec(text)) ) {
                    if ( result[0].toLowerCase() == '[/quote]' ) {
                        if ( !--depth ) ret.push( { author: author, post_id: post_id, text: text.substr( start, result.index - start ) } );
                    } else {
                        if ( !depth++ ) {
                            start = result.index + result[0].length;
                            author = result[1];
                            post_id = result[2];
                        }
                    }
                }
                return ret;
            }

            function _add_standard_data(data) {
                data.securitytoken = $('input[name="securitytoken"]').val();
                if ( !data.security_token ) {
                    BabelExt.utils.runInEmbeddedPage( 'document.head.setAttribute("data-securitytoken", SECURITYTOKEN );' );
                    data.securitytoken = document.head.getAttribute('data-securitytoken');
                    document.head.removeAttribute('data-securitytoken');
                }
                data.parseurl = 1;
                //data.signature: 1; // signatures distract from the objectivity of the communication
                data.wysiwyg = 0;
                if ( !data.url ) {
                    data.url = 'images/misc/navbit-home.png'; // redirect POST requests to a quick-to-load page
                    data.ajax = 1; // some URLs will serve a lightweight page if passed this
                }
                return data;
            }

            /*
             * Send a message to the server as an AJAX request
             */
            stash.post_message = function(url, data) {

                var dfd = new jQuery.Deferred();
                $.ajax({
                    type: "POST",
                    url: url,
                    success: function(reply) {
                        if ( reply.getElementsByTagName && reply.getElementsByTagName('error').length ) { // XML response
                            alert( reply.getElementsByTagName('error')[0].textContent );
                            dfd.reject();
                        } else {
                            dfd.resolve(reply);
                        }
                    },
                    error: function() {
                        dfd.reject();
                    },
                    data: _add_standard_data(data)
                });
                return dfd.promise();

            }

            /*
             * Send a message to the server as a form submission (so the page is reloaded afterwards)
             */
            stash.submit_form = function(url, data) {

                _add_standard_data(data);

                var form = $('<form method="post"></form>')
                    .appendTo('body')
                    .attr( 'action', url );
                Object.keys(data).forEach(function(key) {
                    if ( typeof(data[key]) != 'undefined' )
                        $('<input type="hidden">').appendTo(form).attr( 'name', key ).val( data[key] );
                });

                return form.submit();

            }

            /*
             * Get information about posts from many pages in a thread
             * We need to get a single page first, to work out the number of pages in the thread.
             * Passing in that first page will make the function return faster,
             * and will cause only pages after that one to be loaded.
             */
            stash.get_thread_posts = function( thread_id, first_page ) {

                function get_later_pages(html) {
                    html = $(html);

                    var posts = stash.process_posts(html.find('#posts').children());

                    if ( !posts.length ) {
                        var dfd = new jQuery.Deferred();
                        dfd.reject();
                        return dfd.promise();
                    }

                    var more_pages = [];
                    ( html.find('.pagination a').first().text() || '' ).replace( /Page ([0-9]+) of ([0-9]+)/, function(match, current, total) {
                        for ( var n=current+1; n<=total; ++n )
                            more_pages.push(
                                $.get('/showthread.php?t=' + thread_id + '&page=' + n)
                                    .then(function(data) {
                                        return stash.process_posts(html.find('#posts').children());
                                    })
                            );
                    });

                    if ( more_pages.length ) {
                        return stash.when(more_pages).then(
                            function(more_posts) { posts = posts.concat(more_posts) }
                        );
                    } else {
                        var dfd = new jQuery.Deferred();
                        dfd.resolve( posts );
                        return dfd.promise();
                    }
                }

                if ( first_page )
                    return get_later_pages(first_page);

                var dfd = new jQuery.Deferred();
                $.ajax({
                    url: '/showthread.php?t=' + thread_id,
                    dataType: 'html',
                    success: function(html) {
                        get_later_pages(html).then(
                            function(posts) { dfd.resolve(posts) },
                            function(     ) { dfd.reject (     ) }
                        );
                    },
                    error: function() {
                        dfd.reject();
                    }
                });

                return dfd.promise();

            }

            /*
             * Get the vBCode for a post
             */
            stash.get_post_vbcode = function( post_id ) { // get a single post
                return stash.post_message('/ajax.php?do=quickedit&p=' + post_id, {
                    'do': 'quickedit',
                    p: post_id
                }).then(function(xml) {
                    return $(xml.getElementsByTagName('editor')[0].textContent).find('#vB_Editor_QE_editor').text();
                });
            }

            /*
             * Get the HTML for some vBCode
             */
            stash.get_vbcode_html = function( thread_id, vbCode ) {
                return stash.post_message(
                    '/newreply.php?do=postreply&t=' + thread_id,
                    {
                        message_backup: vbCode,
                        message       : vbCode,
                        'do'          : 'postreply',
                        t             : thread_id,
                        preview       : 'Preview Post',
                    }
                ).then(
                    function(html) {
                        return $(html).find('.postcontent').html();
                    }
                );
            }

            /*
             * Change thread metadata
             */
            stash.thread_edit = function( thread_id, title, notes, prefix, close_thread ) {
                var data = {
                    'do': 'updatethread',
                    title: title || document.title,
                    notes: notes,
                    prefixid: prefix,
                    visible: 'yes',
                };
                if ( typeof(close_thread) !== 'undefined' )
                    data.open = close_thread ? '' : 'yes';

                return stash.post_message( '/postings.php?do=updatethread&t=' + thread_id, data );
            }

            /*
             * Create a new reply in a thread (AJAX)
             */
            stash.thread_reply = function( thread_id, title, message, close_thread ) {
                return stash.post_message(
                    '/newreply.php?do=postreply&t=' + thread_id,
                    {
                        'do': 'postreply',
                        title: title,
                        message: message,
                        message_backup: message,
                        subscribe: 1,
                        openclose: close_thread ? 1 : 0,
                        sbutton: 'Submit Reply',
                    }
                );
            };

            /*
             * Create a new reply in a thread, then go to the new location
             */
            stash.thread_reply_and_go = function( new_location, thread_id, title, message, close_thread ) {
                return stash.submit_form(
                    '/newreply.php?do=postreply&t=' + thread_id,
                    {
                        'do': 'postreply',
                        title: title,
                        message: message,
                        message_backup: message,
                        subscribe: 1,
                        openclose: close_thread ? 1 : 0,
                        sbutton: 'Submit Reply',
                        url: new_location
                    }
                );
            }

            stash.redirect_duration = {
                period: 1,
                frame: 'w',
            };

            stash.thread_merge = function( destination_forum_id, thread_ids ) {
                return stash.post_message(
                    '/inlinemod.php?do=domergethreads&threadids=' + thread_ids,
                    {
                        'do': 'domergethreads',
                        destthreadid: thread_ids.sort( function(a, b) { return a-b } )[0],
                        threadids:    thread_ids.join(),
                        destforumid:  destination_forum_id,
                        skipclearlist: 1,

                        // add a redirect that expires after five days:
                        redir: 1,
                        redirect: 'expires',
                        period: stash.redirect_duration.period,
                        frame : stash.redirect_duration.frame,
                    }
                );
            }

            stash.thread_merge_and_go = function( new_location, destination_forum_id, thread_ids ) {
                return stash.submit_form(
                    '/inlinemod.php?do=domergethreads&threadids=' + thread_ids,
                    {
                        'do': 'domergethreads',
                        destthreadid: thread_ids.sort( function(a, b) { return a-b } )[0],
                        threadids:    thread_ids.join(),
                        destforumid:  destination_forum_id,
                        skipclearlist: 1,

                        // add a redirect that expires after five days:
                        redir: 1,
                        redirect: 'expires',
                        period: stash.redirect_duration.period,
                        frame : stash.redirect_duration.frame,

                        url: new_location
                    }
                );
            }

            stash.thread_create = function(forum_id, title, message) {
                return stash.post_message(
                    '/newthread.php?do=postthread&f=' + forum_id,
                    {
                        do: 'postthread',
                        subject: title,
                        message_backup: message,
                        message: message,
                        f: forum_id,
                        sbutton: 'Submit New Thread',
                    }
                );
            }

            stash.post_move = function( destination_thread, post_ids ) {
                return stash.post_message(
                    '/inlinemod.php?do=domoveposts&t=' + destination_thread + '&postids=' + post_ids,
                    {
                        'do': 'domoveposts',
                        type: 1,
                        mergethreadurl: '/showthread.php?t=' + destination_thread,
                        t: destination_thread,
                        postids: post_ids.join()
                    }
                );
            }

            /*
             * Change the contents of a post
             */
            stash.post_edit = function( post_id, message, reason ) {
                return stash.post_message(
                    '/editpost.php?do=updatepost&postid=' + post_id,
                    {
                        'do': 'updatepost',
                        postid: post_id,
                        reason: reason,
                        message: message,
                    }
                );
            }

            /*
             * Soft-delete a post
             */
            stash.post_delete = function( post_id, reason ) {
                return stash.post_message(
                    '/editpost.php',
                    {
                        'do': 'deletepost',
                        postid: post_id,
                        reason: reason,
                        deletepost: 'delete',
                    }
                );
            }

            // HTML to display when dynamically loading content
            stash.loading_html = '<img src="images/misc/progress.gif" alt="loading, please wait"> Loading';

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
                $.ajax({
                    url: '/infraction.php?do=report&u=123', // get any old infraction page to find the infractions list
                    dataType: 'html',
                    success: function(html) {
                        var missing_infraction_text = '';
                        var infractions = $(html).find('input[name="infractionlevelid"]').map(function() {
                            if ( $(this).val() != '0' ) {
                                var name = $.trim($(this).parent().text());
                                if ( !stash.get_variable('violation in sentence: ' + name) ) missing_infraction_text += '* No "in a sentence" text for ' + name + "\n";
                                if ( !stash.get_variable('rules: '                 + name) ) missing_infraction_text += '* No "rules" text for '         + name + "\n";
                                return {
                                    name: name,
                                    id: $(this).val(),
                                    points: $(this).closest('td').next().text()
                                }
                            }
                        }).get();
                        if ( missing_infraction_text.length && confirm(
                            "Some rule violations don't have all the text necessary to build a template.  Please fix the following issues:\n\n" +
                                missing_infraction_text + "\n" +
                                "To fix these issues, copy/paste the above notes then go to the variables thread and change the \"Sections of the forum rules\" and \"Violations in a sentence\" sections.\n" +
                                "\n" +
                                "Would you like to go there now?"
                        ))
                            location = '/showthread.php?' + variable_thread_id;
                        if ( infractions.length ) {
                            stash.infractions = infractions;
                            BabelExt.storage.set( 'infractions', JSON.stringify( infractions ) );
                            BabelExt.storage.set( 'infractions_timestamp', new Date().getTime() );
                        } else {
                            alert( "Could not refresh the list of infractions - some moderator actions may not work until you refresh the page" );
                        }
                    },
                    error: function() {
                        alert( "Could not refresh the list of infractions - some moderator actions may not work until you refresh the page" );
                    }
                });
            }

            stash.report_post = function( post_id, reason ) {
                return stash.post_message(
                    '/report.php?do=sendemail',
                    {
                        'do': 'sendemail',
                        postid: post_id,
                        reason: reason,
                        url: '/forumdisplay.php?f=48' // reported posts forum, because we usually want to find our report and go there
                    }
                );
            }

            stash.send_pm = function( username, title, message ) {
                return stash.post_message(
                    '/private.php?do=insertpm',
                    {
                        'do': 'insertpm',
                        title: title,
                        message: message,
                        message_backup: message,
                        recipients: username,
                        savecopy: 1,
                        sbutton: 'Submit Message'
                    }
                );
            }

            stash.add_user_note = function( user_id, title, message ) {
                return stash.post_message(
                    '/usernote.php?do=donote&u=' + user_id,
                    {
                        'do': 'donote',
                        title: title,
                        message: message,
                        message_backup: message,
                    }
                );
            }

            stash.give_infraction = function( note, message, user_id, post_id, is_warning, infraction_id ) {
                var data = {
                    'do': 'update',
                    note: note,
                    message: message,
                    message_backup: message,
                    infractionlevelid: infraction_id,
                    savecopy: 1,
                    sbutton: 'Give Infraction',
                    p: post_id,
                    u: user_id,
                };
                if ( is_warning ) data['warning['+infraction_id+']'] = 1;
                return stash.post_message( '/infraction.php?do=update', data );
            }

            stash.give_custom_infraction = function( note, message, user_id, post_id, is_warning, reason, points ) {
                if ( is_warning ) points = 0;
                    var data = {
                        'do': 'update',
                        note: note,
                        message: message,
                        message_backup: message,
                        savecopy: 1,
                        sbutton: 'Give Infraction',
                        p: post_id,
                        u: user_id,

                        infractionlevelid: 0,
                        customreason: reason,
                        points: points,
                        expires: 3,
                        period: 'M',
                    };
                return stash.post_message( '/infraction.php?do=update', data );
            }

        }
    },

    /*
     * VARIABLES
     *
     * To make the extension easier for ordinary moderators to configure,
     * many variables are stored on the site: /showthread.php?t=<variable_thread_id>
     *
     * Note: this thread is only readable/writable by forum moderators,
     * so the content is considered trustworthy.
     */
    {
        pass_storage: ['variables','variables_origin','variables_timestamp'],
        pass_preferences: [ 'variable_thread_id', 'reload_interval' ],
        callback: function( stash, pathname, params, variables, variables_origin, variables_timestamp, variable_thread_id, reload_interval ) {

            variables = JSON.parse(variables||'{}');
            if ( !variables_origin ) variables_origin = location.origin; // detect switches between live and testing sites

            function update_variables(posts) {
                if (posts[0].message.search('THIS IS A VARIABLES THREAD') == -1 ) {
                    alert(
                        "The moderators' extension has been set to read variables from thread #"+variable_thread_id +",\n" +
                            "but this doesn't appear to be a variables thread.\n\n" +
                            "Please update your preferences."
                    );
                }
                return $.when.apply(
                    $,
                    posts.map(function() { return stash.get_post_vbcode(this.post_id); })
                ).then(function() {
                    // $.when() behaves differently for 1 vs. many arguments - normalise that behaviour:
                    var posts;
                    if ( arguments.length == 1 ) {
                        posts = [ arguments[0] ];
                    } else {
                        posts = Array.prototype.slice.call( arguments, 0 );
                    }
                    variables = {};
                    posts.forEach(function(post) {
                        stash.process_quotes(post).forEach(function(variable) {
                            variables[variable.author.toLowerCase()] = variable.text;
                        })
                    });
                    BabelExt.storage.set( 'variables', JSON.stringify( variables ) );
                    BabelExt.storage.set( 'variables_origin', location.origin );
                    BabelExt.storage.set( 'variables_timestamp', new Date().getTime() );
                });
            }

            if ( pathname == '/showthread.php' && params.t == variable_thread_id && !params.page ) {
                $(function() {
                    function observe_mutation(mutations) {
                        var has_new_blockquotes = 0;
                        mutations.forEach(function(mutation) {
                            has_new_blockquotes += $(mutation.target).find('blockquote').length;
                        });
                        if ( has_new_blockquotes )
                            stash.get_thread_posts( variable_thread_id, document.body ).then(function (posts) {
                                update_variables(posts).then(function() {
                                    alert("Variables updated - refresh any open pages to get the new values.");
                                });
                            });
                    }
                    var observer;
                    if      ( typeof(      MutationObserver) != 'undefined' ) observer = new       MutationObserver(observe_mutation);
                    else if ( typeof(WebKitMutationObserver) != 'undefined' ) observer = new WebKitMutationObserver(observe_mutation);
                    $('#posts').each(function() { observer.observe(this, { childList: true, subtree: true }) });

                    stash.get_thread_posts( variable_thread_id, document.body )
                        .then( update_variables );
                });
            } else if ( variables_origin != location.origin || parseInt(variables_timestamp||'0',10)+reload_interval*1000 < new Date().getTime() ) {
                stash.get_thread_posts( variable_thread_id ).then(
                    update_variables,
                    function() {
                        alert( "Could not refresh the list of variables - some moderator actions won't work until you refresh the page" );
                    }
                );
            }

            stash.get_variable = function( names, keys ) {

                var name;

                if ( typeof(names) == 'string' ) {
                    name = names;
                } else { // array of possible names
                    var root_name = name = names.shift();
                    for ( var n=1; n<Math.pow(2,names.length); ++n ) {
                        var new_name = root_name + ': ' + names.filter(function(value,index) { return n & (1<<index) }).join(': ');
                        if ( variables.hasOwnProperty(new_name.toLowerCase()) ) name = new_name;
                    }
                }

                if ( !variables.hasOwnProperty(name.toLowerCase()) ) return;
                if ( !keys ) keys = {};

                keys['origin'] = location.origin;
                keys['next week'] = new Date();
                keys['next week'].setDate(keys['next week'].getDate()+7);
                keys['next week'] = keys['next week'].toGMTString().replace(/:[0-9][0-9] /, ' ' );

                var variable = variables[name.toLowerCase()], has_changed = false;
                do {
                    has_changed = false;
                    variable = variable.replace( /{{([^{}\n]+)}}/g, function(match, key) {
                        key = key.toLowerCase();
                        if ( keys     .hasOwnProperty(key) ) { has_changed = true; return keys     [key]; }
                        if ( variables.hasOwnProperty(key) ) { has_changed = true; return variables[key]; }
                        return match;
                    })
                } while ( has_changed );

                return variable;

            }

            stash.get_array_variable = function( names, keys ) {
                return stash.get_variable(names, keys).replace( /^\s*|\s*$/g, '' ).split( /\s*\n+\s*/ );
            }

        }

    },

    { // retrieve the wathchlist
        match_pathname: '/showthread.php',
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


    /*
     * MODERATION QUEUE PAGE
     */
    {
        match_pathname: '/modcp/moderate.php',
        match_elements: '.copyright',
        callback: function(stash) {
            $('a[href^="user.php"]').each(function() {
                $('<a class="stopforumspam" href="//api.stopforumspam.org/api?username=' + encodeURIComponent($(this).text()) + '&amp;f=json">search on StopForumSpam.com</a>')
                    .insertAfter( $(this).closest('tr').next().next().next().next().next().find('label').last() )
                    .data( 'user-page', this.href )
                    .before(' - ')
                ;
            });
            $('.stopforumspam').click(function(event) {
                var href = this.href;
                $.ajax({
                    type: "GET",
                    url: $(this).data('user-page'),
                    success: function(html) {
                        stash.check_on_stopforumspam( href + '&ip=' + $(html).find('#it_user\\[ipaddress\\]_18').val() );
                    }
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
            $('input[type="radio"]').change(function() {
                var siblings = $(this).closest('table').closest('tr').prevUntil(':has(.thead)').addBack();
                switch ( $(this).closest('td').find('input[type="radio"]:checked').val() ) {
                case "-1": // delete
                    siblings.find('.alt1').css({ 'background-color': '#cc4949' });
                    siblings.find('.alt2').css({ 'background-color': '#da5353' });
                    break;
                case "0": // ignore
                    siblings.find('.alt1').css({ 'background-color': '#cc9800' });
                    siblings.find('.alt2').css({ 'background-color': '#daa600' });
                    break;
                case "1": // validate
                    siblings.find('.alt1').css({ 'background-color': '#39bb39' });
                    siblings.find('.alt2').css({ 'background-color': '#43ca43' });
                    break;
                }
                var counts = {}, count_str = [];
                $(this).parent().closest('[id]').find('input[type="radio"]:checked').each(function() {
                    if ( counts[this.value] )
                        ++counts[this.value];
                    else
                        counts[this.value] = 1;
                });
                if ( counts[ 1] ) count_str.push( counts[ 1] + ' validated' );
                if ( counts[ 0] ) count_str.push( counts[ 0] + ' ignored'   );
                if ( counts[-1] ) count_str.push( counts[-1] + ' deleted'   );
                if ( $(this).parent().closest('[id]').attr( 'id' ) == 'threads_table' ) {
                    if ( counts[1] || counts[-1] )
                        $('#posts_table').not($(this).parent().closest('[id]')).hide();
                    else
                        $('#posts_table').not($(this).parent().closest('[id]')).show();
                }
                $(this).parent().closest('[id]').find('.counts').text( count_str.join(', ') );
            });
            $('a[href^="user.php"]').each(function() {
                var user_id = this.href.substr(23);
                $(this).after(' - <a href="/member.php?u=' + user_id + '">member page</a> - <a href="/private.php?do=newpm&u=' + user_id + '">send PM</a>');
            });
        }
    },

    /*
     * MODERATION TOOLS SECTION ON THREAD PAGES
     */
    {
        match_pathname: '/showthread.php',
        callback: function(stash, pathname, params) {

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
                            '<h4 class="collapse blockhead options_correct">Most recent post in <a href="/showthread.php?t=' + stash.get_variable('mod log thread id') + '&goto=newpost">the moderation thread</a></h4>' +
                            '<table id="last_post_container" style="width: 100%"></table>' +
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
            stash.report_block.find('#threadbits_forum_48_container').load( '/forumdisplay.php?f=48 #threads', function() {
                var recently_reported_posts = {};
                stash.report_block.find('#threadbits_forum_48_container a.title').each(function() {
                    var href = this.href;
                    $(this).text().replace( /\[PID: ([0-9]*)\]/, function(match, pid) {
                        recently_reported_posts['#post_'+pid] = href;
                    });
                });
                stash.report_block.find('.prefix_closed,.prefix_deleted').closest('li').remove();
                stash.report_block.find('.prefix.understate').filter(function() { return $(this).text().search(/^\s*Closed:\s*$/) != -1 }).closest('li').remove();
                dfd.resolve(recently_reported_posts);
            });
            stash.report_block.find('#last_post_container').load( '/showthread.php?t=' + stash.get_variable('mod log thread id') + '&goto=newpost .postcontainer:last', function() {
                stash.report_block.find('.posthead,.postfoot,.after_content').remove();
            });
            $.get( '/memberlist.php?order=desc&sort=joindate&pp=50', function(html) {
                stash.report_block.find('#memberlist')
                    .append(
                        $(html).find('#memberlist_table td')
                            .filter(function() { return $(this).text().search( /^(?:Today|Yesterday)$/ ) != -1 })
                            .closest('tr')
                            .find('a.username')
                    );
                stash.report_block.find('#memberlist a').slice(1).before(', ');
            });
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
                $.get( '/showthread.php?t='+thread_id+'&p='+post_id, function(html) {
                    var html = $(html);
                    dfd.resolve( html, html.find( '#post_' + post_id ) );
                });
                stash.review_post_contents_promise = stash.get_post_vbcode( post_id );
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
                .attr( 'href', stylesheet.href.replace( /([?&]sheet)=[^&]*/, '$1=threadlist.css' + (stash.post_to_review_id?',member.css':'') ))
                .insertBefore(stylesheet)
            ;
        }
    },

    { // prepare to merge threads
        match_pathname: [ '/showthread.php', '/postings.php', '/inlinemod.php' ],
        pass_storage: [ 'merge_data' ],
        pass_preferences: [ 'reload_interval' ],
        callback: function(stash, pathname, params, merge_data, reload_interval) {

            merge_data = JSON.parse( merge_data || '{}' );

            stash.merge_destinations = [];

            // close the current thread and report the merge you're about to do in the mod log
            stash.report_merge = function( current_thread, destination_forum,  destination_thread,  destination_title ) {
                var dfd = new jQuery.Deferred();
                stash.thread_edit( current_thread, undefined, 'Closing in preparation for merge', undefined, true ) // close thread
                    .done(function(html) { // Get information from the closed thread
                        html = $(html);
                        var current_forum = html.find( '#breadcrumb .navbit a').last().attr('href').split( '?f=' )[1];
                        var current_title = html.find( '#breadcrumb .navbit.lastnavbit' ).text().replace( /^\s*|\s*$/g, '' );
                        stash.get_thread_posts( current_thread, html ).done(function (posts) {
                            var variable_data = {
                                'current thread id': current_thread,
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
                            stash.thread_reply( // Notify/save all posts in thread
                                stash.get_variable('mod log thread id'),
                                stash.get_variable('merge title', variable_data),
                                stash.get_variable('merge body' , variable_data)
                            ).done(function(html) {
                                dfd.resolve();
                            });
                        })
                    });
                return dfd.promise();
            }

            var get_requests = [];
            var failed_gets = '';
            stash.get_variable('frequent merge destinations').replace(/[0-9]+/g, function(thread_id) {

                var dfd = new jQuery.Deferred();
                var promise = dfd.promise();

                if ( merge_data.hasOwnProperty(thread_id) && parseInt(merge_data[thread_id].timestamp,10)+reload_interval*1000 < new Date().getTime() ) {
                    dfd.resolve( merge_data[thread_id].forum_id, merge_data[thread_id].title );
                } else {
                    get_requests.push(
                        $.get( '/showthread.php?t=' + thread_id, function(html) {
                            html = $(html);
                            var title = $.trim(html.find( '#breadcrumb .navbit.lastnavbit' ).text());
                            var real_thread_id = html.find('input[name="t"]').val();
                            if ( !real_thread_id ) {
                                failed_gets += '* Thread ' + thread_id;
                                if ( merge_data[thread_id] ) failed_gets += ' (' + merge_data[thread_id].title + ')';
                                failed_gets += ' has been hard-deleted or merged without a redirect.\n'
                                dfd.reject();
                            } else if ( real_thread_id != thread_id ) {
                                failed_gets += '* Thread ' + thread_id
                                if ( merge_data[thread_id] ) failed_gets += ' (' + merge_data[thread_id].title + ')';
                                failed_gets += ' has been merged into thread ' + real_thread_id + ' (' + title + ')\n';
                                dfd.reject();
                            } else {
                                merge_data[thread_id] = {
                                    timestamp: new Date(),
                                    forum_id: html.find( '#breadcrumb .navbit a').last().attr('href').split( '?f=' )[1],
                                    title: title,
                                };
                                dfd.resolve( merge_data[thread_id].forum_id, merge_data[thread_id].title );
                            }
                        })
                    );
                }

                stash.merge_destinations.push({ thread_id: thread_id, promise: promise });

            });
            if ( get_requests.length )
                $.when.apply( $, get_requests ).done(function() {
                    BabelExt.storage.set( 'merge_data', JSON.stringify(merge_data) );
                    if ( failed_gets.length && confirm(
                        'Some frequent merge destinations have changed recently.  Please fix the following issues:\n\n' +
                            failed_gets + "\n" +
                            "To fix these issues, copy/paste the above notes then go to the variables thread and change the \"frequent merge destinations\" block.\n" +
                            "\n" +
                            "Would you like to go there now?"
                    ))
                        location = '/showthread.php?' + variable_thread_id;
                });

        }
    },

    { // start downloading some data if this looks like it's going to be a report thread
        match_pathname: '/showthread.php',
        match_elements: '#threadtools',
        pass_storage: [ 'merge_data' ],
        pass_preferences: [ 'reload_interval' ],
        callback: function(stash, pathname, params, threadtools, merge_data, reload_interval) {

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
                    link.html('<a class="merge-title" rel="nofollow" href="showthread.php?t='+destination.thread_id+'">thread #' + destination.thread_id + '</a>')
                        .click(function(event) {
                            $(this).html(stash.loading_html);
                            destination.promise.done(function(destination_forum, destination_title) {
                                stash.report_merge( params.t, destination_forum, destination.thread_id, destination_title).done(function() {
                                    stash.thread_merge_and_go( '/showthread.php?goto=newpost&t='+stash.get_variable('mod log thread id'), destination_forum, [ destination.thread_id, params.t ] );
                                });
                            });
                            event.preventDefault();
                        });
                } else if ( destination.thread_id > params.t ) {
                    link.html('<span class="merge-title" title="can\'t merge earlier threads into later ones\nIf you really want to do this, please merge from that thread into this one.">thread #' + destination.thread_id + '</span>');
                } else { // equal
                    link.html('<span class="merge-title" title="can\'t merge a thread with itself.">thread #' + destination.thread_id + '</span>')
                }

                destination.promise.done(function( forum_id, title ) { link.find('.merge-title').text(title); });

            });

        }
    },

    {
        match_pathname: '/showthread.php',
        match_elements: ['#below_postlist'],
        callback: function( stash, pathname, params, below_postlist) {
            stash.report_block.insertAfter( below_postlist );
            stash.recently_reported_posts_promise.done(function(recently_reported_posts) {
                $(Object.keys(recently_reported_posts).join()).each(function() {
                    $(this).find('.report')
                        .attr( 'href', recently_reported_posts['#'+this.id] )
                        .attr( 'title', 'Go to report thread')
                        .text('Already reported');
                });
            });

            $("head").append(
                "<style type='text/css'>" +
                    '.report-menu { display: inline-block }' +
                    '.report-menu ul.popupbody.memberaction_body { left: inherit; top: inherit; width: inherit }' +
                    '.report-menu ul.popupbody.memberaction_body li { width: inherit }' +
                    '.report-menu ul.popupbody.memberaction_body li a { padding: 4px 0; display: inline-block; width: 100%; margin: 0 }' +
                "</style>"
            );

            var infractions = stash.infractions.map(function(infraction) { return '<li><a href="">&nbsp;Take report: ' + infraction.name + '&nbsp;' }).join('');

            stash.process_posts().each(function() {
                this.linking.append(
                    '<a href="/usernote.php?u=' + this.user_id + '" style="background: none; padding: 0"><span style="font-size: 120%">&#x266b;</span> User Notes</a>' +
                        (
                            stash.watched_users.hasOwnProperty(this.user_id)
                                ? stash.watchlist_html
                                : ''
                        )
                );

                var report_element = this.report_element.wrap('<div class="report-menu"></div>').parent();

                report_element
                    .find('a')
                    .attr( 'title', 'click for menu, double-click to go to the report page' )
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

                report_element.append(
                    '<ul class="popupbody memberaction_body">' + infractions + '</ul>'
                ).find('li a').attr( 'href', 'report.php?p=' + this.post_id ).click(function(event) {
                    var post_id = $(this).attr('href').substr(13);
                    $(this).before(stash.loading_html);
                    stash.report_post(
                        post_id,
                        $(this).text().replace( /^.Take report: /, '' )
                    ).done(function(html) {
                        var re = new RegExp( "\\[PID: " + post_id + "\\]" );
                        var report_thread = $(html).find('a.title').filter(function() { return $(this).text().search(re) != -1 }),
                        report_thread_href = report_thread.attr('href'),
                        report_thread_id = report_thread_href.substr(17),
                        report_thread_text = report_thread.text()
                        ;
                        function take_thread_and_go() {
                            stash.thread_reply_and_go( report_thread_href, report_thread_id, stash.get_variable('post title: take report'), stash.get_variable('post body: take report') );
                        }
                        if ( report_thread.closest('li').find('a[href^="misc.php?do=whoposted&t="]').text() == '0' )
                            take_thread_and_go();
                        else
                            $.get( report_thread_href, function( html ) {
                                var report_owner = stash.process_posts( $(html).find('.flare_Moderator').closest('li') )[0].username
                                if ( report_owner == $('.welcomelink a').text() ) {
                                    take_thread_and_go();
                                } else {
                                    if ( confirm( "Ninja'd by " + report_owner + "\nView anyway?" ) ) location = report_thread_href;
                                }
                            });
                    });
                    event.preventDefault();
                });
                $('<a class="ip">StopForumSpam.com</a>')
                    .attr( 'href', '//api.stopforumspam.org/api?ip=' + this.ip + '&username=' + encodeURIComponent(this.username) + '&f=json' )
                    .insertAfter( this.ip_element )
                    .click(function(event) {
                        stash.check_on_stopforumspam( $(this).attr('href') );
                        event.preventDefault();
                    });

            });

        }

    },

    { // set redirect duration
        match_pathname: [ '/postings.php', '/inlinemod.php' ],
        match_elements: [ '#footer' ],
        callback: function(stash, pathname, params, expires, period, frame) {
            $('#rb_redirect_expires').click();
            $('select[name="period"]').val( stash.redirect_duration.period );
            $('select[name="frame"]' ).val( stash.redirect_duration.frame  );
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
                        var option = $('<option>').attr( 'value', '/showthread.php?t=' + destination.thread_id );
                        destination.promise.done(function( forum_id, title ) { option.attr( 'label', title ) });
                        return option;
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
    {
        match_pathname: '/inlinemod.php',
        // match_params: { 'do': 'mergethreadcompat' }, // not present when merging more than two threads at once
        match_elements: [ 'select[name="frame"]', 'input[name="do"][value="domergethreads"]' ],
        callback: function(stash, pathname, params) {

            var submit_state = 'start';

            $('form[name="vbform"]').submit(function(event) {

                if ( submit_state != 'done' ) event.preventDefault();
                if ( submit_state == 'start' )
                    submit_state = 'progress';
                else
                    return;

                $('input[type="submit"]').before(stash.loading_html);

                var destination_forum  = $('#destforum').val();
                var destination_thread = $('#destthread option:selected').val();
                var destination_title  = $('#destthread option:selected').text().replace(/^\s*\[[0-9]+\]\s*|\s*$/g, '');

                $.when.apply(
                    $,
                    $('#destthread option:not(:selected)').map(function() {
                        return stash.report_merge( this.value, destination_forum, destination_thread, destination_title )
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
            var mod_log = stash.get_variable('mod log thread id');
            if ( params.t == mod_log ) {
                // Unmerge data in the mod log
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
                                stash.thread_create( data.forum_id, data.title, stash.get_variable('unmerge notification body', variable_data) ).done(function(html) {
                                    var new_thread_id = $(html).find( 'input[name="t"]' ).val();
                                    if  ( typeof(new_thread_id) == 'undefined' ) {
                                        alert("Failed to create unmerge thread - please try again later");
                                    } else {
                                        variable_data['destination thread id'] = new_thread_id;
                                        stash.post_move( new_thread_id, data.posts ).done(function() {
                                            stash.thread_reply_and_go(
                                                '/showthread.php?goto=newpost&t='+mod_log,
                                                mod_log,
                                            stash.get_variable('unmerge title', variable_data), stash.get_variable('unmerge body', variable_data)
                                            );
                                        });
                                    }
                                });
                            });
                    });
                });
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

            var pm_worthy_violations = {};
            stash.get_array_variable('pm-worthy violations').forEach(function(violation) { pm_worthy_violations[violation] = true });

            var infraction_worthy_violations = {};
            stash.get_array_variable('infraction-worthy violations').forEach(function(violation) { infraction_worthy_violations[violation] = true });

            var first_post = stash.process_posts()[0],
                user_to_review = first_post.message_element.find('a').filter(function() { return this.href.search(/member.php\?/) > -1 && !$(this).closest('bbcode_container').length }).eq(1),
                user_to_review_id = user_to_review.attr( 'href' ).split( '?u=' )[1],
                post_to_review_id = stash.post_to_review_id
            ;

            user_to_review.next('br').before('&nbsp; <a href="/search.php?do=finduser&u='+user_to_review_id+'">(find all items from '+user_to_review.html()+')</a>');

            $("head").append(
                "<style type='text/css'>" +
                    '#reviewed-user-info ul, #reviewed-user-info ol, #reviewed-user-info dl { margin: 0 }' +
                "</style>"
            );
            var reviewed_user_info = $(
                '<li id="reviewed-user-info" class="postbitlegacy postbitim postcontainer new">' +
                  '<div class="posthead"><span class="postdate new"><span class="date">User information</span></span></div>' +
                  '<div class="postdetails">' +
                    '<div class="userinfo">' +
                      '<div class="username_container"><a class="username"><strong>Moderator tools</strong></a></div>' +
                      '<hr>' +
                      '<span class="usertitle">Browser extension</span>' +
                    '</div>' +
                    '<div class="postbody">' +
                      '<div class="postrow">' +
                        '<div class="content">' +
                          '<blockquote class="postcontent">' + stash.loading_html + ' information about ' + user_to_review.html() + '</blockquote>' +
                        '</div>' +
                      '</div>' +
                      '<div class="cleardiv"></div>' +
                    '</div>' +
                  '</div>' +
                '</li>'
            ).appendTo( '#posts' );

            stash.review_post_promise.done(function(html) {
                if ( html.find( '#newreplylink_top' ).text() == 'Closed Thread' )
                    first_post.message_element.find('a[href^="' + location.origin + '/showthread.php?t="]').first().after( ' <em>(this thread has now been closed)</em>' );
            });

            var infraction_count = 0;

            /*
             * Gather information about the user from various pages,
             * and show it all in a "reviewed user info" block
             */
            $.when(
                $.get('usernote.php?u=' + user_to_review_id),
                $.get('/modcp/user.php?do=viewuser&u=' + user_to_review_id),
                $.get(user_to_review.attr('href').replace(/^[a-z]+:\/{2,}/,'//')), // ensure the correct protocol is used
                stash.review_post_promise
            ).done(function( user_notes, mod_cp, member, review_thread_page ) {

                // later we'll scroll the page so this marker appears to have stayed still in the viewport:
                var old_marker_pos = first_post.cleardiv.offset().top;

                // create the block (and add easy-to-add info):
                reviewed_user_info.find('blockquote').html(
                    ( stash.watched_users.hasOwnProperty(user_to_review_id) ? stash.watchlist_html : '' ) +
                    '<div id="view-stats_mini"></div>' +
                    '<div>Reported post was created ' + review_thread_page[1].find('.date').html() + '</div>' +
                    ( review_thread_page[1].find('.lastedited').length ? review_thread_page[1].find('.lastedited').html() : '' ) +
                    '<div><a id="browsing_options" href="/modcp/user.php?do=viewuser&u='+user_to_review_id+'#ctrl_options[receivepm]"><b>Browsing options</b></a></div>' +
                    '<div class="profile_content"><div id="infractions_block"><b>Infractions</b>: none</div></div>' +
                    '<ol id="user_notes"><li><b>User notes</b>: none</ol>'
                );

                // Populate the block with information from the member page:
                member = $(member[0]);
                $('#view-stats_mini').replaceWith( member.find('#view-stats_mini') );
                $('#view-stats_mini')
                    .find('.blockbody').removeClass('blockbody')
                    .find('.userinfo').css({ width: 'inherit', 'padding-left': 0 });
                if ( member.find('.infractions_block').length ) {
                    $('#infractions_block').replaceWith( member.find('.infractions_block').css({ clear: 'both' }) );
                    $('.infractions_block').prepend( '<h2 style="text-align: center; font-weight: bold; padding-top: 1em">Infractions</h2>' );
                    infraction_count = $('#infractionslist').find('.inflistexpires').filter(function() { return $(this).text().search('Expired') == -1 }).length;
                }

                // Populate the block with information from the user notes page
                var notes = $(user_notes[0]).find('#posts');
                if ( notes.length ) {
                    $('#user_notes').replaceWith( notes.attr( 'id', 'user_notes' ) );
                    $('#user_notes').before( '<h2 style="text-align: center; font-weight: bold; padding-top: 1em; clear: both">User notes</h2>' );

                    // Do not PM for issues mentioned in the title:
                    var pm_worthy_re = new RegExp( '(?:' + Object.keys(pm_worthy_violations).join('|') + ')', 'gi' );
                    $('#user_notes').find('h2.title').each(function() {
                        $(this).text().replace( pm_worthy_re, function(match) {
                            delete pm_worthy_violations[ match.toLowerCase() ];
                        });
                    });
                    $('#user_notes').children().each(function() {
                        var summary = $(
                            '<li style="clear:both; border-bottom: 1px solid grey" class="userprof_content">' +
                              '<div class="infractionbit">' +
                                '<div class="inflistinfo">' +
                                  '<div class="infraction_reason"><span class="shade">Title:</span> <em><a href="/usernote.php?do=viewuser&u='+user_to_review_id+'#' + this.id + '"></a></em></div>' +
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
                mod_cp = $(mod_cp[0]);
                if ( mod_cp.find('#cpform').length ) { // not redirected to a login page
                    var message;
                    if ( mod_cp.find('#rb_1_options\\[receivepm\\]_37').is(':checked') ) { // receive PMs
                        if ( mod_cp.find('#rb_1_options\\[emailonpm\\]_39').is(':checked') ) { // notification e-mail
                            if ( mod_cp.find('#rb_1_user\\[pmpopup\\]_40').is(':checked') ) // notification popup
                                message = ': will be notified of private messages by popup and e-mail';
                            else
                                message = ': will be notified of private messages by e-mail';
                        } else { // no notification e-mail
                            if ( mod_cp.find('#rb_1_user\\[pmpopup\\]_40').is(':checked') ) // notification popup
                                message = ': will be notified of private messages by popup';
                            else
                                message = ": will receive private messages, but won't be notified so probably won't see them";
                        }
                    } else { // won't receive PMs
                        message = ': will not receive private messages';
                    }
                    $('#browsing_options').after(message);
                } else {
                    $('#browsing_options').text('Log in to ModCP to check browsing options');
                }

                // scroll down by the new box height, so the user doesn't see any difference
                if ( reviewed_user_info[0].getBoundingClientRect().top < 0 )
                    window.scrollBy( 0, Math.floor( first_post.cleardiv.offset().top - old_marker_pos ) );

            });


            var thread_status = ( $( '#newreplylink_top' ).text() == 'Closed Thread' ) ? 'closed' : 'open';
            var mod_posts = stash.process_posts( $('.flare_Moderator').closest('li') );

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
                var infraction_name = this.message_element.find('.quote_container').first().text().replace(/^\s*|\s*$/g,'') || '';
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

            $('<a title="Click to take this thread" class="newcontent_textcontrol" rel="nofollow" href="newreply.php?t='+params.t+'&noquote=1" style="margin-left:10px;">' + take_thread_text + '</a>')
                .insertAfter('#newreplylink_top,#newreplylink_bottom')
                .click(function(event) {
                    stash.thread_reply_and_go( location.toString(), params.t, stash.get_variable('post title: take report'), stash.get_variable('post body: take report') );
                    event.preventDefault();
                })
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
                var expected_title_suffix = ' - ' + $('.welcomelink a').text() + ' on it';
                if ( document.title.search( expected_title_suffix ) == -1 )
                    stash.thread_edit( params.t, document.title.replace(/ - .*? on it$/) + expected_title_suffix, 'appending username' );
                handle_thread();
                break;
            case 'taken':
                var report_owner_id = mod_posts.filter(function() { return this.username == report_owner })[0].user_id;
                common_actions.find('.postcontent').html(
                    '<ul style="margin: 1em; padding-left: 1em">' +
                        '<li><a href="/private.php?do=newpm&u=' + report_owner_id + '">PM the report owner (' + report_owner +')</a>' +
                        '<li><a href="/newreply.php?t=' + stash.get_variable('mod log thread id') + '">Copy an appeal to the moderation log</a>' +
                        '<li><a href="/showgroups.php">Find an administrator</a> and PM them the post and user name if you want an infraction revoked' +
                        '<li><a href="#handle">Handle it anyway</a>' +
                    '</ul>'
                )
                    .find('a[href="#handle"]').click(function(event) {
                        handle_thread();
                        event.preventDefault();
                    });
                break;
            default:
                common_actions.find('.postcontent').html(
                    '<ul style="margin: 1em; padding-left: 1em">' +
                        '<li><a href="/usernote.php?do=newnote&u=' + user_to_review_id + '">Post a new user note</a> for the reported user' +
                        '<li><a href="/forumdisplay.php?f=47">Check the infractions/warnings forum</a>' +
                        '<li><a href="/newreply.php?t=' + stash.get_variable('mod log thread id') + '">Copy an appeal to the moderation log</a>' +
                        '<li><a href="/showgroups.php">Find an administrator</a> and PM them the post and user name if you want an infraction revoked' +
                    '</ul>'
                );
            }

            function handle_thread() {

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

                        '.common-actions .link-to-post-info { border-bottom: 1px solid black; padding-bottom: 0.5em; margin-bottom: 0.5em }' +

                        '.common-actions .notification div.none, .common-actions .notification div.pm, .common-actions .notification div.warn, .common-actions .notification div.infract { display: none }' +
                        '.common-actions .notification.none .none,.common-actions .notification.pm .pm,.common-actions .notification.warn .warn,.common-actions .notification.infract .infract { clear: both; display: inherit }' +

                        '.common-actions .per-post.vbcode-mode.hand-edit div.vbcode,.common-actions .per-post.vbcode-mode textarea.vbcode { display: none }' +
                        '.common-actions .per-post.vbcode-mode.hand-edit textarea.vbcode { display: block }' +
                        '.common-actions .preview-mode .vbcode,.common-actions .preview-mode .switch-mode-preview, .common-actions .vbcode-mode .preview,.common-actions .vbcode-mode .switch-mode-vbcode { display: none }' +

                        '.common-actions .switch-mode-preview, .common-actions .switch-mode-vbcode { width: 14em; margin: 0 0.25em }' +

                        '.common-actions del { text-decoration: line-through; color: red }' +
                        '.common-actions ins { color: green }' +

                        '.common-actions fieldset { border: 1px solid black; padding: 1em }' +
                        '.common-actions legend, .common-actions h1 { font-size: larger; font-weight: bold; margin-bottom: 0.25em }' +

                        '.common-actions textarea { width: 100%; height: 20em }' +
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

                var form = $(
                    '<div class="row">' +
                      '<div class="column1" id="issues">' +

                        '<fieldset>' +
                          '<legend>Type of issue</legend>' +
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
                          '<br>Total processed posts: <em id="total-processed"></em>' +
                          '<br>Total edited posts: <em id="total-edited"></em>' +
                          '<br>Total deleted posts: <em id="total-deleted"></em>' +
                        '</fieldset>' +

                      '</div>' +

                      '<div class="column2">' +
                        '<fieldset class="notification none vbcode-mode">' +
                          '<legend>Notification message</legend>' +
                          '<div style="text-align: center; margin-bottom: 1em" class="posthead">' +
                            make_input('radio', 'notification-type', '', 'No notification' ) + ' ' +
                            make_input('radio', 'notification-type', 'pm', '<img src="images/buttons/add-infraction_sm.png">Send private message' ) + ' ' +
                            '<input type="button" class="switch-mode-preview" value="switch to preview mode">' +
                            '<input type="button" class="switch-mode-vbcode" value="switch to vB Code mode"> ' +
                            make_input('radio', 'notification-type', 'warn', '<img src="images/buttons/yellow-card_sm.png">Give official warning' ) + ' ' +
                            make_input('radio', 'notification-type', 'infract', '<img src="images/buttons/red-card_sm.png">Give infraction' ) + ' ' +
                          '</div>' +
                          '<div class="none">' +
                            '(no notification will be sent)' +
                          '</div>' +
                          '<div class="pm">' +
                            '<input type="text" placeholder="title" style="width: 30em; margin-bottom: 1em"><br>' +
                            '<div class="preview"></div>' + '<textarea class="vbcode" placeholder="notification message"></textarea>' +
                          '</div>' +
                          '<div class="warn">' +
                            stash.get_variable(    'warning message', violation_variable_data ) +
                          '</div>' +
                          '<div class="infract">' +
                            stash.get_variable( 'infraction message', violation_variable_data ) +
                          '</div>' +
                        '</fieldset>' +

                        '<fieldset class="per-post vbcode-mode">' +
                          '<legend>Per-post actions</legend>' +
                          '<div style="text-align: center; margin-bottom: 1em; float: none" class="posthead">' +
                            '<input type="button" id="goto-prev" value="&laquo; prev"> ' +
                             make_input('radio', 'action', '', 'default', true ) + ' ' +
                             make_input('radio', 'action', 'ignore', 'ignore' ) + ' ' +
                             '<input type="button" class="switch-mode-preview" value="switch to preview mode">' +
                             '<input type="button" class="switch-mode-vbcode" value="switch to vB Code mode"> ' +
                             make_input('radio', 'action', 'hand-edit', 'edit by hand' ) + ' ' +
                             make_input('radio', 'action', 'delete', 'delete' ) + ' ' +
                             '<input type="button" id="goto-next" value="next &raquo;">' +
                          '</div>' +
                          '<div class="link-to-post-info"><a id="link-to-current-post"></a> by <a id="link-to-current-post-user"></a></div>' +
                          '<textarea class="vbcode"></textarea>' +
                          '<div class="vbcode" style="white-space: pre-wrap"></div>' +
                          '<div class="preview"></div>' +
                        '</fieldset>' +

                        '<fieldset>' +
                          '<legend>Extra notes</legend>' +
                            '<textarea id="extra-notes" placeholder="Information that would be useful for future moderators (optional)"></textarea>' +
                          '</fieldset>' +

                      '</div>' +

                    '</div>'

                ).appendTo( common_actions.find('.postcontent').empty() );

                common_actions.find('.postcontrols').html('<a id="submit-resolution" class="report" href="#submit-resolution"></a>');

                /*
                 * POST CONTROLS
                 */
                var resolution_data = [], commands_in_the_air = 0, resolution_variables = {};
                var notification_data = {
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
                            per_post_actions.del .map(function(post) {
                                return post.vbcode_promise.then(function() {
                                    return stash.post_delete(
                                        post.post_id,
                                        stash.get_variable([ 'deletion reason', post.is_reported_post ? 'reported post' : 'later post', resolution_variables.violation ], resolution_variables)
                                    );
                                });
                            }).concat(
                                per_post_actions.edit.map(function(post) {
                                return post.vbcode_promise.then(function() {
                                    return stash.post_edit(
                                        post.post_id,
                                        post.replaced_vbcode,
                                        stash.get_variable([ 'edit reason', post.is_reported_post ? 'reported post' : 'later post', resolution_variables.violation ], resolution_variables)
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
                        stash.thread_reply_and_go(
                            location.toString(),
                            params.t,
                            stash.get_variable('post title: close report', resolution_variables),
                            stash.get_variable('post body: close report' , resolution_variables),
                            true
                        );
                    }
                }
                $('#submit-resolution').click(function(event) {
                    resolution_variables = $.extend( resolution_variables, notification_data.variables(), per_post_data.variables() );
                    resolution_variables['extra notes'] = $('#extra-notes').val();
                    resolution_data.push(
                        {
                            get_promises: function() { return [
                                stash.add_user_note(
                                    user_to_review_id,
                                    stash.get_variable('user notes title: report', resolution_variables ),
                                    stash.get_variable('user notes body: report' , resolution_variables )
                                )
                            ]},
                            titles: [ 'Update [URL="'+location.origin+'/usernote.php?u='+user_to_review_id+'"]user notes[/URL]' ],
                        }
                    );
                    run_resolution_command();
                    $(this).html(stash.loading_html + '...');
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

                    if ( notification_data.titles.length ) {
                        resolution_data.push( notification_data );
                        actions.push( 'Give [i]' + user_to_review.text() + '[/i] an ' + notification_data.description );
                        resolution_variables['notification type'] = notification_data.description;
                    }
                    if ( per_post_data.titles.length ) {
                        resolution_data.push( per_post_data );
                        actions.push( per_post_data.description );
                    }

                    resolution_variables.overview = actions.join(', ').replace(/^(.)/, function(_,letter) { return letter.toUpperCase() } ) + ', update user notes and close the report'

                    $('#submit-resolution').html( resolution_variables.overview.replace( /\[(\/?i)\]/g,'<$1>') );

                };


                $('.switch-mode-vbcode' ).click(function() { $(this).closest('.preview-mode').removeClass('preview-mode').addClass('vbcode-mode'); });
                $('.switch-mode-preview').click(function() { $(this).closest( '.vbcode-mode').removeClass('vbcode-mode').addClass('preview-mode'); });

                /*
                 * PER-POST ACTIONS
                 */

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

                    per_post_actions = {
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
                            if ( !posts[n].vbcode_promise ) posts[n].vbcode_promise = stash.get_post_vbcode(posts[n].post_id);
                            if ( n < current_post )
                                $('#goto-prev').prop( 'disabled', false ).data( 'post', n );
                            else if ( n > current_post && !next_enabled++ )
                                $('#goto-next').prop( 'disabled', false ).data( 'post', n );
                            posts[n].action = posts[n].per_post_action || default_action;
                            if ( posts[n].action == 'edit' ) {
                                (function (post) {
                                    post.vbcode_promise.done(function(text) {
                                        replacements.forEach(function(replacement) { text = text.replace( replacement.from, function(match) {
                                            return '\uE001' + match + '\uE002' + replacement.to + '\uE003'; // characters from Unicode's private use area
                                        })});
                                        post.replaced_vbcode = text.replace(/\uE001(?:.|\n)*?\uE002((?:.|\n)*?)\uE003/g, '$1' );
                                        post.replaced_html   = BabelExt.utils.escapeHTML(text).replace(/\uE001/g,'<del>').replace(/\uE002/g,'</del><ins>').replace(/\uE003/g,'</ins>')
                                    });
                                })(posts[n]);
                            } else if ( posts[n].action == 'hand-edit' && posts[n].hasOwnProperty('edited_vbcode') ) {
                                posts[n].replaced_vbcode = posts[n].edited_vbcode;
                                posts[n].replaced_html   = BabelExt.utils.escapeHTML(posts[n].edited_vbcode);
                            } else {
                                (function (post) { post.vbcode_promise.done(function(text) {
                                    post.replaced_vbcode = text;
                                    post.replaced_html   = BabelExt.utils.escapeHTML(text);
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
                        case    'delete':                                   per_post_actions.del .push( posts[n] ); per_post_text += post_text + 'deleted\n'; break;
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
                        }));

                    var per_post_messages = [];
                    if ( per_post_actions.del.length ) {
                        per_post_messages.push(
                            'delete ' + per_post_actions.del.length + ' post' + ( per_post_actions.del.length > 1 ? 's' : '' )
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

                    $('.per-post .vbcode').html(stash.loading_html + '...');
                    refresh_post_contents();

                }
                function refresh_post_contents() {
                    return posts[current_post].vbcode_promise.done(function(text) {
                        $('#link-to-current-post')
                            .attr( 'href', '/showthread.php?p=' + posts[current_post].post_id + '#post' + posts[current_post].post_id )
                            .text( posts[current_post].title || 'Post ' + posts[current_post].post_id )
                        ;
                        $('#link-to-current-post-user').attr( 'href', '/member.php?u=' + posts[current_post].user_id ).text( posts[current_post].username );
                        $('.per-post textarea.vbcode').val ( posts[current_post].replaced_vbcode );
                        $('.per-post div.vbcode'     ).html( posts[current_post].replaced_html   );
                    });
                }

                form.find('input[name=action]').change(function() {
                    posts[current_post].per_post_action = $('input[name=action]:checked').val();
                    refresh_post_list();
                });

                form.find('.per-post textarea').on( 'input', function() {
                    posts[current_post].replaced_vbcode = posts[current_post].edited_vbcode = $(this).val();
                });

                stash.review_post_promise.done(function(html) {
                    posts = stash.process_posts(html.find( '#posts').children()).filter(function(post) { return parseInt(this.post_id,10) >= parseInt(post_to_review_id,10); }).get();
                    posts[0].vbcode_promise = stash.review_post_contents_promise;
                    posts[0].is_reported_post = true;
                    var quotes_count = 0, links_count = 0;
                    stash.get_thread_posts( stash.thread_to_review_id, html ).done(function(more_posts) {
                        posts = posts.concat( more_posts.filter(function(post) { return parseInt(this.post_id,10) >= parseInt(post_to_review_id,10); }).get().slice(posts.length) );
                        var re = new RegExp( 'showthread\.php(?:\\?|.*&)p=' + post_to_review_id + '($|&|#)' );
                        posts.forEach(function(post) {
                            if ( post.message_element.find('.bbcode_postedby > a').filter(function() { return this.href.search(re) != -1 }).length ) {
                                post.quotes_target = true;
                                post.vbcode_promise = stash.get_post_vbcode(post.post_id);
                                ++quotes_count;
                            }
                            if ( post.message_element.find('a').filter(function() { return !$(this.parentNode).hasClass('bbcode_postedby') && this.href.search(re) != -1 }).length ) {
                                post.links_to_target = true;
                                post.vbcode_promise = stash.get_post_vbcode(post.post_id);
                                ++links_count;
                            }
                        });
                    });
                    $('#apply-to-quotes').text( ' (' + quotes_count + ')' );
                    $('#apply-to-link-direct').text( ' (' + links_count + ')' );
                    refresh_post_list_and_searches();
                });

                selectionchange.start(document);
                var needs_mouseup = true, target_search = form.find('.search-for');
                document.addEventListener('selectionchange', function () {
                    var selection = window.getSelection();
                    if ( $(selection.anchorNode).closest('.vbcode').closest('.per-post').length == 0 || $(selection.focusNode).closest('.vbcode').closest('.per-post').length == 0 ) return;
                    target_search.val( selection.toString() );
                    if ( selection.toString() != '' && needs_mouseup ) {
                        $(window).one( 'mouseup', function() {
                            target_search.next().focus();
                            needs_mouseup = true;
                        });
                        needs_mouseup = false;
                    }
                });

                $('.per-post .switch-mode-preview').click(function() {
                    $('.per-post .preview').html(stash.loading_html + '...');
                    refresh_post_contents().done(function() {
                        stash.get_vbcode_html( stash.thread_to_review_id, posts[current_post].replaced_vbcode )
                            .done(function(html) {
                                $('.per-post .preview').html(html);
                            })
                        ;
                    });
                });

                $('#goto-prev,#goto-next').click(function() {
                    current_post = $(this).data('post');
                    $('input[name=action][value="'+(posts[current_post].per_post_action||'')+'"]').click();
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
                                stash.get_array_variable([ 'replacement', $(this.previousSibling).val() ])
                                    .map(function(suggestion) {
                                        return $( '<li style="width: 100%">' )
                                            .append(
                                                $('<a href="#suggestion" style="box-sizing: border-box"></a>').text( suggestion )
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
                stash.review_post_promise.done(function(html, post) { // grey/bold the forum rules
                    $('.forum-rules')
                        .addClass('shade')
                        .filter('[data-forum=' + html.find('.navbit.lastnavbit').prev().find('a').attr('href').substr(19) + ']' )
                        .removeClass('shade').css({ 'font-weight': 'bold' })
                        .after( ' (post was in this forum)' )
                    ;
                });

                /*
                 * NOTIFICATION MESSAGE
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
                    if ( issues.filter(function() { return this.infraction_worthy }).length )
                        form.find( 'input[name="notification-type"][value="infract"]' ).click();
                    else if ( issues.filter(function() { return !this.pm_worthy }).length )
                        form.find( 'input[name="notification-type"][value="warn"]' ).click();
                    else
                        form.find( 'input[name="notification-type"][value="pm"]' ).click();

                    $('#issue-info').html( stash.get_variable([ 'information', issue_count, issue_name ]) );
                    $('.issue-name').text(issue_name);
                    $('.issue-points').text(
                        [0].concat(issues.get()).reduce(function(a,b) { return a + b.points })
                    );

                    $('.notification .switch-mode-vbcode:visible').click();
                });

                form.find( 'input[name="notification-type"]' ).click(function() {
                    update_submit_message();
                });

                form.find('input[name="issue-type"],input[name="notification-type"],#delete-posts,input[name="action"]').change(function() {

                    $('.notification .switch-mode-vbcode:visible').click();

                    stash.review_post_promise.done(function() {

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
                            name: user_to_review.text()
                        };

                        $('.notification').removeClass( 'none pm warn infract' );
                        var notification_type = $('.common-actions input[name="notification-type"]:checked').val();
                        var is_warning = false;
                        switch ( notification_type ) {
                        case '':
                            notification_data = {
                                get_promises: function() {},
                                titles:   [],
                                variables: function() { return variables },
                                description: ''
                            };
                            $('.notification').addClass( 'none' );
                            break;
                        case 'pm':
                            $('.notification .pm input'   ).val( stash.get_variable([ 'PM title', issue_count, issue_name ], variables ) );
                            $('.notification .pm textarea').val( stash.get_variable([ 'PM body' , issue_count, issue_name ], variables ) );
                            notification_data = {
                                description: 'explanatory PM',
                                get_promises: function() { return [stash.send_pm( user_to_review.text(), $('.notification .pm input').val(), $('.notification .pm textarea').val() )] },
                                titles: [ 'Send explanatory PM to [URL="'+location.origin+'/member.php?u=' + user_to_review_id + '"]' + user_to_review.text() + '[/URL]' ],
                                variables: function() {
                                    return $.extend( variables, {
                                        'notification message': $('.notification .pm textarea').val()
                                    });
                                }
                            }
                            $('.notification').addClass( 'pm' );
                            break;
                        case 'warn':
                            is_warning = true;
                            // FALL THROUGH
                        case 'infract':
                            variables['infraction type'] = ( is_warning ? 'official warning' : 'infraction' );
                            $('.notification .' + notification_type + ' textarea').val(
                                stash.get_variable([ 'infraction', issue_count, issue_name ], variables )
                            );
                            notification_data = {
                                description: variables['infraction type'],
                                get_promises: function() {
                                    var issues = get_issues();
                                    var args = [
                                        'See ' + document.location.toString(), // administrative note
                                        $('.notification .' + notification_type + ' textarea').val(),
                                        user_to_review_id,
                                        post_to_review_id,
                                        is_warning,
                                    ];

                                    if ( issues.length == 1 ) {
                                        args.push( issues[0].id );
                                        return [stash.give_infraction.apply( stash, args )];
                                    } else if ( issues.length == 0 ) {
                                        alert("Please select an issue");
                                        throw "Pleaese select an issue";
                                    } else {
                                        args.push(
                                            issues.map(function() { return this.name }).get().join(', '),
                                            [0].concat(issues.get()).reduce(function(a,b) { return a + b.points })
                                        );
                                        return [stash.give_custom_infraction.apply( stash, args )];
                                    }
                                },
                                titles: [ 'Give an ' + variables['infraction type'] + ' to [URL="'+location.origin+'/member.php?u=' + user_to_review_id + '"]' + user_to_review.text() + '[/URL]' ],
                                variables: function() {
                                    return $.extend( variables, {
                                        'notification message': $('.notification .' + notification_type + ' textarea').val()
                                    });
                                }
                            };
                            $('.notification').addClass( notification_type );
                            break;
                        }

                        update_submit_message();

                    });

                });

                $('.notification .switch-mode-preview').click(function() {
                    var preview = $('.notification div.preview:visible');
                    preview.html( stash.loading_html );
                    stash.get_vbcode_html( stash.thread_to_review_id, preview.next().val() )
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

);
