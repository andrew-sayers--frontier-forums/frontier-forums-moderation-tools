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
                                user_id          : ( $('.username'   , this).attr('href') || '             guest' ).substr(13),
                                title            : $('.title'      , this).text().replace(/^\s*/, '').replace(/\s*$/, ''),
                                message          : $('.content'    , this).text().replace(/^\s*/, '').replace(/\s*$/, ''),
                                message_element  : $('.content'    , this),
                                linking          : $('.postlinking', this),
                                ip_element       : $('.ip'         , this),
                                report_element   : $('.report'     , this),
                                ip               : $('.ip'         , this).text().replace(/^\s*/, '').replace(/\s*$/, ''),
                                cleardiv         : $('.cleardiv'   , this),
                                is_deleted       : !!$('.deleted'  , this).length
                            };
                        })
                );
            }

            /*
             * Map vBCode for a post to a list of (non-nested) quotes
             */
            stash.process_quotes = function(text) {
                var ret = [], regex = /\[quote="?([^\n=;\]]+)(?:;([^\n=";\]]*))?"?\]|\[\/quote\]/gi, start=0, depth=0, author, post_id, result;
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

                var dfd = new jQuery.Deferred();

                data.parseurl = 1;
                //data.signature: 1; // signatures distract from the objectivity of the communication
                data.wysiwyg = 0;
                if ( !data.url ) {
                    data.url = 'images/misc/navbit-home.png'; // redirect POST requests to a quick-to-load page
                    data.ajax = 1; // some URLs will serve a lightweight page if passed this
                }

                data.securitytoken = $('input[name="securitytoken"]').val();
                if ( !data.security_token ) {
                    BabelExt.utils.runInEmbeddedPage( 'document.head.setAttribute("data-securitytoken", SECURITYTOKEN );' );
                    data.securitytoken = document.head.getAttribute('data-securitytoken');
                    document.head.removeAttribute('data-securitytoken');
                }

                if ( data.securitytoken ) {
                    dfd.resolve(data);
                } else {
                    $(function() {
                        data.securitytoken = $('input[name="securitytoken"]').val();
                        if ( data.securitytoken ) {
                            dfd.resolve(data);
                        } else {
                            dfd.reject();
                        }
                    });
                }

                return dfd.promise();
            }

            /*
             * Send a message to the server as an AJAX request
             */
            stash.post_message = function(url, data) {

                var dfd = new jQuery.Deferred();
                _add_standard_data(data).then(function(data) {
                    $.ajax({
                        type: "POST",
                        url: url,
                        success: function(reply) {
                            if ( reply.getElementsByTagName && reply.getElementsByTagName('error').length ) { // XML response
                                alert( "Couldn't load page " + url + "\nError:" + reply.getElementsByTagName('error')[0].textContent );
                                dfd.reject();
                            } else {
                                dfd.resolve(reply);
                            }
                        },
                        error: function() {
                            dfd.reject();
                        },
                        data: data
                    });
                }, function() {
                    dfd.reject();
                });

                return dfd.promise();

            }

            /*
             * Send a message to the server as a form submission (so the page is reloaded afterwards)
             */
            stash.submit_form = function(url, data) {

                return _add_standard_data(data).then(function(data) {

                    var form = $('<form method="post"></form>')
                        .appendTo('body')
                        .attr( 'action', url );
                    Object.keys(data).forEach(function(key) {
                        if ( typeof(data[key]) != 'undefined' )
                            $('<input type="hidden">').appendTo(form).attr( 'name', key ).val( data[key] );
                    });

                    return form.submit();

                });

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
                        dfd.reject('no posts found');
                        return dfd.promise();
                    }

                    var more_pages = [];
                    ( html.find('.pagination a').first().text() || '' ).replace( /Page ([0-9]+) of ([0-9]+)/, function(match, current, total) {
                        for ( var n=current+1; n<=total; ++n )
                            more_pages.push(
                                $.get('/showthread.php?t=' + thread_id + '&page=' + n)
                                    .then(function(html) {
                                        return stash.process_posts($(html).find('#posts').children());
                                    })
                            );
                    });

                    if ( more_pages.length ) {
                        return stash.when(more_pages).then(
                            function(more_posts) { more_posts.forEach(function(more) { posts = posts.add(more); }); return posts },
                            function(          ) { return 'Failed to load some later pages in /showthread.php?t=' + thread_id }
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
                            function(arg  ) { dfd.reject (arg  ) }
                        );
                    },
                    error: function() {
                        dfd.reject('Failed to load thread /showthread.php?t=' + thread_id);
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
            stash.get_vbcode_html_newthread = function( forum_id, vbCode ) {
                return stash.post_message(
                    '/newthread.php?do=postthread&f=' + forum_id,
                    {
                        'do': 'postthread',
                        subject: 'Test converting vbCode to HTML',
                        message_backup: vbCode,
                        message: vbCode,
                        f: forum_id,
                        preview: 'Preview Post',
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
            stash.thread_edit = function( thread_id, title, notes, prefix, close_thread, unapprove_thread ) {
                var data = {
                    'do': 'updatethread',
                    title: title || document.title,
                    notes: notes,
                    prefixid: prefix,
                    visible: unapprove_thread ? 'no' : 'yes',
                };
                if ( typeof(close_thread) !== 'undefined' )
                    data.open = close_thread ? '' : 'yes';

                return stash.post_message( '/postings.php?do=updatethread&t=' + thread_id, data );
            }

            stash.thread_openclose = function( thread_id, open ) {
                return stash.post_message( '/ajax.php?do=updatethreadopen&t=' + thread_id, {
                    'do': 'updatethreadopen',
                    t: thread_id,
                    open: open ? 'true' : 'false'
                });
            }

            /*
             * Create a new reply in a thread (AJAX)
             */
            stash.thread_reply = function( thread_id, title, message, flip_thread_openness ) {
                return stash.post_message(
                    '/newreply.php?do=postreply&t=' + thread_id,
                    {
                        'do': 'postreply',
                        title: title,
                        message: message,
                        message_backup: message,
                        subscribe: 1,
                        openclose: flip_thread_openness ? 1 : 0, // if true, switch the thread state (open->closed, closed->open)
                        sbutton: 'Submit Reply',
                    }
                );
            };

            /*
             * Create a new reply in a thread, then go to the new location
             */
            stash.thread_reply_and_go = function( new_location, thread_id, title, message, flip_thread_openness ) {
                return stash.submit_form(
                    '/newreply.php?do=postreply&t=' + thread_id,
                    {
                        'do': 'postreply',
                        title: title,
                        message: message,
                        message_backup: message,
                        subscribe: 1,
                        openclose: flip_thread_openness ? 1 : 0, // if true, switch the thread state (open->closed, closed->open)
                        sbutton: 'Submit Reply',
                        url: new_location
                    }
                );
            }

            /*
             * Take a thread, then go to that thread
             */
            stash.take_thread_and_go = function( url, thread_id, flip_thread_openness ) {
                return stash.thread_reply_and_go(
                    url,
                    thread_id,
                    stash.parse_variable('report process', 'post title: take report', {}, 'string', undefined, thread_id ),
                    stash.parse_variable('report process', 'post body: take report' , {}, 'string', undefined, thread_id ),
                    flip_thread_openness
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

            stash.thread_bump = function(thread_id) {
                return stash.post_message(
                    '/postings.php',
                    {
                        do: 'vsa_makenewer',
                        t: thread_id
                    }
                );
            }

            /*
             * Get the contents of a post (even if it's been deleted)
             */
            stash.post_retrieve = function( post_id ) {
                return stash.post_message(
                    '/showpost.php?p=' + post_id,
                    {
                          ajax: 1,
                        postid: post_id
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

            /* This would save us some page requests, but sometimes forces us to log in again which negates any time benefit:
            stash.multi_delete = function( post_ids, reason ) {
                return stash.post_message(
                    '/inlinemod.php?postids=' + post_ids.join(),
                    {
                        'do': 'dodeleteposts',
                        postids: post_ids.join(),
                        deletereason: reason,
                        deletepost: 'delete',
                        deletetype: 1,
                        p: 0,
                        postid: 0
                    }

                );
            }
            */

            /*
             * Ban a spambot and delete all their posts as spam
             */
            stash.spammer_delete = function( user_id, post_id ) {
                return stash.post_message(
                    '/inlinemod.php?do=dodeletespam',
                    {
                        'do': 'dodeletespam',
	                'userid[]': user_id,
	                usergroupid: 22,
	                period: 'PERMANENT',
	                reason: 'Spambot',
	                sbutton: 'Ban User',
	                p: post_id,
	                postids: post_id,
	                useraction: 'ban',
	                deleteother: 1,
	                deletetype: 1,
	                deletereason: 'Spambot',
	                keepattachments: 0,
	                report: 1,
	                type: 'post'
                    }
                );
            }

            // HTML to display when dynamically loading content
            stash.loading_html = '<img src="images/misc/progress.gif" alt="loading, please wait"> Loading';

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

            var get_user_ips_data;
            stash.get_user_ips = function(username, get_overlapping) {
                if ( !get_user_ips_data )
                    return $.get( '/modcp/user.php?do=doips').then(function(html) {
                        html = $(html);
                        get_user_ips_data = {
                            'do': 'doips',
                            adminhash:     html.find('input[name="adminhash"]'    ).val(),
                            securitytoken: html.find('input[name="securitytoken"]').val()
                        };
                        return stash.get_user_ips(username, get_overlapping);
                    });

                return $.post( '/modcp/user.php?do=doips', $.extend( get_user_ips_data, { username: username, depth: get_overlapping ? 2 : 1 } ) ).then(function(html) {
                    html = $(html);
                    var ret = {
                        registration_ip: html.find('#cpform_table .alt1').eq(1).text(),
                        used_ips: html.find( '#cpform_table td > ul > li' ).map(function() { var ip = $(this).children('a').first().text(); if ( ip != '127.0.0.1' ) return ip }),
                        overlapping_users: {},
                    }
                    ret.unique_ip_count = ret.used_ip_count = ret.used_ips.length;
                    var overlapping_ips = {};
                    html.find( '#cpform_table ul ul > li' ).each(function() {
                        var elements = $(this).children('a');
                        var name     = elements.eq(0).text(),
                            user_id  = elements.eq(0).attr('href').split('&u=')[1],
                            address  = elements.eq(1).text()
                        ;
                        if ( address === '127.0.0.1' ) return; // ignore localhost
                        if ( !overlapping_ips[address]++ ) --ret.unique_ip_count;
                        if ( ret.overlapping_users[name] ) {
                            ret.overlapping_users[name].addresses.push( address );
                        } else {
                            ret.overlapping_users[name] = {
                                user_id: user_id,
                                addresses: [ address ]
                            };
                        }
                    });
                    return ret;
                });
            }

            stash.get_ip_data = function(ip) {
                if ( !get_user_ips_data )
                    return $.get( '/modcp/user.php?do=doips').then(function(html) {
                        html = $(html);
                        get_user_ips_data = {
                            'do': 'doips',
                            adminhash:     html.find('input[name="adminhash"]'    ).val(),
                            securitytoken: html.find('input[name="securitytoken"]').val()
                        };
                        return stash.get_ip_users(ip);
                    });

                return $.post( '/modcp/user.php?do=doips', $.extend( get_user_ips_data, { ipaddress: ip, depth: 1 } ) ).then(function(html) {
                    html = $(html);
                    var domain_name = html.find('#cpform_table .alt1 b').first().text();
                    if ( domain_name == 'Could Not Resolve Hostname' ) domain_name = ip;
                    var previous_users = {};
                    return {
                        ip: ip,
                        domain_name: domain_name,
                        users: html.find('#cpform_table li a b').parent().map(function() {
                            var user_id = $(this).attr('href').split('&u=')[1];
                            if ( !previous_users.hasOwnProperty(user_id) ) {
                                previous_users[user_id] = 1;
                                return {
                                    name: $(this).text(),
                                    user_id: user_id
                                }
                            }
                        }).get()
                    };
                });
            }


            stash.get_member_info = function(user_id) {
                return $.get('/member.php?u='+user_id+'&tab=infractions&pp=50').then(function(html) {
                    html = $(html);
                    var ret = {
                        stats : html.find('#view-stats_mini'),
                        joined: $.trim(html.find( '.userinfo dd' ).first().text()),
                        title : $.trim(html.find('#userinfo .usertitle').text()),

                        infraction_count  : 0,
                        warning_count     : 0,
                        infraction_summary: ''
                    };
                    if ( html.find('.infractions_block').length ) {
                        var infractions = html.find('#infractionslist .inflistexpires').filter(function() { return $(this).text().search('Expired') == -1 }).closest('li');
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
                                            '" title="'    + BabelExt.utils.escapeHTML($.trim(date.text()) + ': ' + info.find('em').text()) +
                                            '"><img src="' + BabelExt.utils.escapeHTML(info.find('img').attr('src')) +
                                            '"></a>'
                                    );
                                } else {
                                    return (
                                        '<span title="'    + BabelExt.utils.escapeHTML($.trim(date.text()) + ': ' + info.find('em').text()) +
                                            '"><img src="' + BabelExt.utils.escapeHTML(info.find('img').attr('src')) +
                                            '"></span>'
                                    );
                                }
                            }).get().reverse().join('')
                        );
                    }
                    if ( html.find('#usermenu a[href^="modcp/banning.php?do=liftban"]').length ) {
                        return $.get( '/modcp/banning.php?do=editreason&userid=' + user_id ).then(function(html) {
                            ret.infraction_summary = '<span style="color: red">BANNED: ' + BabelExt.utils.escapeHTML($.trim($(html).find( '#it_reason_1' ).val())) + '</span>'
                            return ret;
                        });
                    } else {
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
                        '<div id="user-info">'+ stash.loading_html + ' information about ' + username_html + '</div>' +
                        '<div id="duplicate-account-info" style="clear: both">' + stash.loading_html + ' duplicate account report</div>' +
                    '</div>'
                );

                // Log in to ModCP and get the user's info page
                var modcp_dfd = new jQuery.Deferred();
                var title = document.title;
                var iframe = $('<iframe src="/modcp/user.php?do=viewuser&u='+user_id+'" style="overflow: hidden; display: none"></iframe>').insertBefore(container.find('.postcontent'));
                iframe.one( 'load', function() {
                    document.title = title;
                    if ( $('#vb_login_username', iframe[0].contentDocument.body ).length ) {
                        $(iframe[0].contentDocument.body).css({ overflow: 'hidden' }).find('p').remove();
                        iframe.css({ display: 'block', width: '450px', height: '200px' });
                        var form = $(iframe[0].contentDocument.body).find('form');
                        iframe.css({ width: form.outerWidth() + 'px', height: form.outerHeight() + 'px' });
                        var has_progressed = false;
                        var interval = setInterval(function() {
                            if ( $('#vb_login_username', iframe[0].contentDocument.body ).length ) {
                                // still on the login page
                            } else if ( $('#redirect_button,#vb_login_username,.standard_error', iframe[0].contentDocument.body).length && !has_progressed ) {
                                // on the redirect page
                                has_progressed = true;
                                iframe.hide();
                                modcp_dfd.notify();
                            } else if ( $( '#cpform', iframe[0].contentDocument.body ).length ) {
                                // on the user page
                                iframe.hide();
                                clearInterval(interval);
                                if ( !has_progressed ) modcp_dfd.notify();
                                document.title = title;
                                modcp_dfd.resolve(iframe[0]);
                            } // else page is loading
                        }, 50);
                    } else { // already logged in
                        modcp_dfd.notify();
                        document.title = title;
                        modcp_dfd.resolve(iframe[0]);
                        return;
                    }
                });

                var modcp_promise = modcp_dfd.promise();

                /*
                 * Build the duplicate account report
                 */
                modcp_promise.progress(function() {
                    // fired as soon as we've logged in
                    stash.get_user_ips(username_text, true).then(function(user_data) {
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
                                return stash.get_user_ips(user, false).done(function(user_data) {
                                    overlapping_user_ips[user] = user_data;
                                });
                            })).concat(
                            Object.keys(user_data.overlapping_users).map(function(user) {
                                return $.get( '/modcp/user.php?do=viewuser&u=' + user_data.overlapping_users[user].user_id).done(function(html) {
                                    overlapping_user_emails[user] = $(html).find('input[name="user\\[email\\]"]').val();
                                })
                            }))
                        ).then(function() {
                            var email = BabelExt.utils.escapeHTML( $(iframe[0].contentDocument.body).find('input[name="user\\[email\\]"]').val() );
                            var email_parts = email.split('@');
                            stash.parse_variable('internal extension data', 'common e-mail domains', {}, 'array of items').forEach(function(domain) { if ( email_parts[1] == domain.value ) email_parts[1] = 'example.com'; });
                            email_parts = [
                                new RegExp( '^(' + email_parts[0].replace( /([.*+?^${}()|\[\]\/\\])/g, "\\$1" ) + ')@' ),
                                new RegExp( '@(' + email_parts[1].replace( /([.*+?^${}()|\[\]\/\\])/g, "\\$1" ) + ')$' )
                            ];
                            container.find('#duplicate-account-info').html(
                                '<div style="font-size: larger; font-weight: bold; clear: both; margin-top: 0.5em">Possible duplicate accounts</div>' +
                                '<div style="margin: 0.5em 0" >The following users have used the same IP address as <i>' + username_html + '</i>.  That might just mean they\'re friends that have checked the forums from each others\' houses, but it can be a useful lead when looking for duplicate accounts.  If they have any active infractions, you can hover over the icons to see the date and reason.</div>' +
                                '<ul style="margin-left: 1em"><li style="list-style:disc">' + member_info.infraction_summary + ' <a href="/member.php?u=' + user_id + '">' + username_html + '</a>' +
                                ' &lt;<a href="mailto:' + email + '">' + email + '</a>&gt;' +
                                ' has used ' + user_data.used_ip_count + ' IP address(es) ' +
                                ' - joined ' + BabelExt.utils.escapeHTML(member_info.joined) + ', ' + BabelExt.utils.escapeHTML(member_info.title) +
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
                                    return '<li style="list-style:disc">' + member_info.infraction_summary + ' <a href="/member.php?u=' + overlap_data.user_id + '">' + BabelExt.utils.escapeHTML(name) + '</a>' +
                                        ' &lt;<a href="mailto:' + email + '">' + email + '</a>&gt;' +
                                        ' has shared ' + overlap_data.addresses.length + '/' + ip_data.used_ip_count + ' address(es)' + registration_message +
                                        ' - joined ' + BabelExt.utils.escapeHTML(member_info.joined) + ', ' + BabelExt.utils.escapeHTML(member_info.title) +
                                        ' - <a href="#more-info" class="more-info" data-name="' + BabelExt.utils.escapeHTML(name) + '">more info</a>' +
                                        '</li>';
                                }).join('') + '</ul></li></ul>');
                            container.find('#duplicate-account-info .more-info').one( 'click', function(event) {
                                var table_container = $('<div>' + stash.loading_html + '</div>').insertAfter(this);
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

                                stash.when(Object.keys(scored_addresses).map(function(address) { return stash.get_ip_data(address) })).done(function(addresses) {

                                    addresses.sort(function(a,b) { return scored_addresses[b.ip] - scored_addresses[a.ip] || a.domain_name.localeCompare(b.domain_name) });

                                    table_container.html(
                                            '<table style="text-align: center">' +
                                            '<thead><th>Address<th style="padding:0 1em">' + username_html + '<th style="padding:0 1em">' + BabelExt.utils.escapeHTML(name) + '<th style="padding:0 1em">Search on...<th style="padding:0 1em">Also used by</tr></thead><tbody>' +
                                            addresses.map(function(address) {
                                                var ret = '<tr><th style="text-align: right">' + address.domain_name;
                                                if ( scored_addresses[address.ip] & 8 ) ret += '<td style="padding:0 1em">registered';
                                                else if ( scored_addresses[address.ip] & 4 ) ret += '<td style="padding:0 1em">yes';
                                                else ret += '<td style="padding:0 1em">';
                                                if ( scored_addresses[address.ip] & 2 ) ret += '<td style="padding:0 1em">registered';
                                                else if ( scored_addresses[address.ip] & 1 ) ret += '<td style="padding:0 1em">yes';
                                                else ret += '<td style="padding:0 1em">';
                                                ret += '<td style="padding:0 1em"><a class="stopforumspam" href="//api.stopforumspam.org/api?ip=' + encodeURIComponent(address.ip) + '&amp;f=json">StopForumSpam</a>';
                                                ret += '&nbsp;';
                                                ret += '<a href="http://multirbl.valli.org/lookup/' + encodeURIComponent(address.ip) + '.html">MultiRBL</a>';
                                                ret += '&nbsp;';
                                                ret += '<a href="https://www.projecthoneypot.org/ip_' + encodeURIComponent(address.ip) + '">Project&nbsp;Honeypot</a>';
                                                ret += '<td style="padding:0 1em">' +
                                                    address.users
                                                    .filter(function(user) { return user.name != username_text && user.name != name })
                                                    .map(function(user) { return '<a href="/member.php?u=' + user.user_id + '">' + BabelExt.utils.escapeHTML(user.name) + '</a>' }).join(', ');
                                                return ret;
                                            }).join('') +
                                            '</tbody></table>'
                                    );
                                    table_container.find('.stopforumspam').click(function(event) {
                                        stash.check_on_stopforumspam( this.href );
                                        event.preventDefault();
                                    });

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
                        var infractions = $('#infractionslist').find('.inflistexpires').filter(function() { return $(this).text().search('Expired') == -1 }).closest('li');
                        infraction_count = infractions.length;
                        warning_count    = infractions.has('img.inlineimg[src="images/misc/yellowcard_small.gif"]').length;
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
                        mod_cp_iframe.src = '/modcp/user.php?do=viewuser&'+new Date().getTime();
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
     * VARIABLES
     *
     * To make the extension easier for ordinary moderators to configure,
     * many variables are stored on the site: /forumdisplay.php?f=<variable_forum_id>
     *
     * Note: this forum is only readable/writable by forum moderators,
     * so the content is considered trustworthy.
     */
    {
        pass_storage: ['variables','variables_origin','variables_timestamp'],
        pass_preferences: [ 'language', 'reload_interval' ],
        callback: function( stash, pathname, params, variables, variables_origin, variables_timestamp, user_language, reload_interval ) {

            /*
             * PART ONE: download the list of variables
             */
            variables = JSON.parse(variables||'[]');
            if ( !variables_origin ) variables_origin = location.origin; // detect switches between live and testing sites
            if ( !$.isArray(variables) ) { // reset variables loaded from the old implementation
                variables = [];
                variables_timestamp = '0';
            }

            var variable_thread_map = {};
            variables.forEach(function(datum) { if ( datum.type == 'variables' ) variable_thread_map[datum.thread_id] = datum });

            function get_variables_forum() { // Download the variables forum, convert it to metadata
                return $.get('/forumdisplay.php?f=70&pp=50').then(function(html) {
                    html = $(html);
                    var namespaces = {}, promises = [];
                    var new_variables = html.find('#threads > li').map(function() { // Convert HTML to hashes
                        var $this = $(this), $title = $this.find('.title'), thread_data = undefined, thread_id = $title.attr('href').split('?t=')[1];
                        $title.text().replace( /^([^ :]*):\s*([^:]*)$/, function( text, language, namespace ) {

                            if ( !namespaces.hasOwnProperty(thread_id) ) namespaces[thread_id] = [];

                            if ( $this.hasClass('moved') ) {
                                namespaces[thread_id].push( namespace + ': ' + language ) + '-'; // slightly reduce the match quality for redirects
                                return;
                            } else {
                                namespaces[thread_id].push( namespace + ': ' + language );
                            }

                            var reply_count = parseInt( $this.find('.threadstats a').text(), 10 );
                            if ( !reply_count ) return;

                            var today = new Date(), yesterday = new Date();
                            yesterday.setDate(yesterday.getDate()-1);
                            today     = [ today    .getDate().toString().replace(/^(.)$/,"0$1"), (today    .getMonth()+1).toString().replace(/^(.)$/,"0$1"), today    .getYear()+1900 ].join( '/' );
                            yesterday = [ yesterday.getDate().toString().replace(/^(.)$/,"0$1"), (yesterday.getMonth()+1).toString().replace(/^(.)$/,"0$1"), yesterday.getYear()+1900 ].join( '/' );
                            var last_modified = $.trim($this.find('a.lastpostdate').parent().text().replace('Today',today).replace('Yesterday',yesterday));

                            if ( !variable_thread_map.hasOwnProperty(thread_id) )
                                variable_thread_map[thread_id] = { thread_id: thread_id, last_modified: 'new', replies: [] };
                            thread_data = variable_thread_map[thread_id];
                            thread_data.namespaces = namespaces[thread_id];

                            if ( last_modified != thread_data.last_modified ) {
                                thread_data.last_modified = last_modified;
                                switch ( reply_count - thread_data.replies.length ) {
                                case 0: break; // no new replies
                                case 1: thread_data.replies.push($this.find('a.lastpostdate').attr('href').split('#post')[1]); break; // one new reply
                                default: delete thread_data.replies; break; // many new replies
                                }
                                promises.push(get_variables_thread(thread_data));
                            }

                        });
                        return thread_data;
                    });
                    return stash.when(promises).done(function() { update_variables(new_variables.get()) });
                });
            }

            function get_variables_thread( thread_datum, first_page ) {
                function convert_replies() {
                    return stash.when( thread_datum.replies.map(function(post_id) { return stash.get_post_vbcode(post_id) }) ).then(function(posts) {
                        thread_datum.variables = {};
                        posts.forEach(function(post) {
                            stash.process_quotes(post).forEach(function(variable) {
                                thread_datum.variables[variable.author.toLowerCase()] = variable.text;
                            })
                        });
                    });
                }
                if ( thread_datum.hasOwnProperty('replies') && !first_page )
                    return convert_replies();
                else
                    return stash.get_thread_posts( thread_datum.thread_id, first_page ).then(function (posts) {
                        thread_datum.replies = posts.map(function() { return this.post_id }).get();
                        thread_datum.replies.shift(); // ignore the first post
                        return convert_replies();
                    });
            }

            function update_variables(new_variables) { // Download variables from metadata
                if ( new_variables.length ) {
                    variables = new_variables;
                    variables.sort(function(a,b) { return parseInt(a.thread_id,10) - parseInt(b.thread_id,10) });
                    BabelExt.storage.set( 'variables', JSON.stringify( variables ) );
                    BabelExt.storage.set( 'variables_origin', location.origin );
                    BabelExt.storage.set( 'variables_timestamp', new Date().getTime() );
                }
            }

            if ( variables_origin != location.origin || parseInt(variables_timestamp||'0',10)+reload_interval*1000 < new Date().getTime() ) {
                stash.variables_promise = get_variables_forum();
            } else {
                var dfd = new jQuery.Deferred();
                stash.variables_promise = dfd.promise();
                dfd.resolve();
            }

            var thread_datum = variables.filter(function(datum) { return datum.thread_id == params.t })[0];
            if ( pathname == '/showthread.php' && params.t && thread_datum ) $(function() { // Update this thread
                function update_thread() {
                    get_variables_thread( thread_datum, document.body ).then(function() {
                        update_variables(variables);
                        alert("Variables updated - refresh any open pages to get the new values.");
                    });
                }

                function observe_mutation(mutations) {
                    var has_new_blockquotes = 0;
                    mutations.forEach(function(mutation) {
                        has_new_blockquotes += $(mutation.target).find('blockquote').length;
                    });
                    if ( has_new_blockquotes ) update_thread();
                }
                var observer;
                if      ( typeof(      MutationObserver) != 'undefined' ) observer = new       MutationObserver(observe_mutation);
                else if ( typeof(WebKitMutationObserver) != 'undefined' ) observer = new WebKitMutationObserver(observe_mutation);
                $('#posts').each(function() { observer.observe(this, { childList: true, subtree: true }) });
                update_thread();
            });

            /*
             * PART TWO: parse variables
             */
            var thread_languages = {}, forum_languages = {}, unfound_variables = {}, unfound_variables_timeout = null; // initialised immediately below parse_variable()
            stash.parse_variable = function( namespace, names, keys, parser, forum_id, thread_id ) {

                var root_name;
                if ( typeof(names) == 'string' ) {
                    root_name = names;
                    names = [];
                } else { // array of possible names
                    root_name = names.shift();
                }

                /*
                 * STEP ONE: get the target language
                 * Rules: thread language overrides forum language overrides user language,
                 * EXCEPT when the user language is a specialism of the other language.
                 * So a user language 'en-GB' overrides a thread language 'en',
                 * but a user language 'en-GB' is overridden by a thread language 'fr'.
                 */
                var target_namespace = user_language;
                if      ( thread_id && thread_languages.hasOwnProperty(thread_id) && target_namespace.search(thread_languages[thread_id]+'-')!=0 ) target_namespace = thread_languages[thread_id];
                else if (  forum_id &&  forum_languages.hasOwnProperty( forum_id) && target_namespace.search( forum_languages[ forum_id]+'-')!=0 ) target_namespace =  forum_languages[ forum_id];
                target_namespace = namespace + ': ' + target_namespace;

                // STEP TWO: get the best matching variable given the target language
                var variable = null, old_match_quality = 0;
                variables.forEach(function(thread) {
                    var match_quality = Math.max.apply( Math, thread.namespaces.map(function(namespace) {
                        return (
                            ( target_namespace == namespace )                     ? 2 // exact match
                                : ( target_namespace.search( namespace + '-' ) == 0 ) ? 1 // want 'en-GB', have 'en'
                                : ( namespace.search( target_namespace + '-' ) == 0 ) ? 1 // want 'en', have 'en-GB'
                                : 0
                        );
                    }));
                    if ( old_match_quality < match_quality ) {
                        old_match_quality = match_quality;
                        var name = root_name;
                        for ( var n=1; n<Math.pow(2,names.length); ++n ) {
                            var new_name = root_name + ': ' + names.filter(function(value,index) { return n & (1<<index) }).join(': ');
                            if ( thread.variables.hasOwnProperty(new_name.toLowerCase()) ) name = new_name;
                        }
                        if ( thread.variables.hasOwnProperty(name.toLowerCase()) ) variable = thread.variables[name.toLowerCase()];
                    }
                });

                if ( variable == null ) {
                    var message = '* "' + [ root_name ].concat(names).join(': ') + '" in namespace "' + target_namespace + '"\n';
                    if ( !unfound_variables.hasOwnProperty(message) ) {
                        unfound_variables[message] = 1;
                        if ( unfound_variables_timeout != null ) clearTimeout(unfound_variables_timeout);
                        // Avoid spamming the user with error messages:
                        unfound_variables_timeout = setTimeout(function() {
                            var variable_text = Object.keys(unfound_variables);
                            variable_text.sort();
                            unfound_variables_timeout = null;
                            if ( confirm(
                                "Some variables were not found.  Please add the following:\n\n" +
                                variable_text.join("") +
                                "To fix these issues, paste the above notes into a text editor, go to the variables forum, find the relevant thread, and add or edit the relevant quotes.\n" +
                                "\n" +
                                "Would you like to go there now?"
                            )) {
                                location = '/forumdisplay.php?f=70';
                            }
                        }, 100 );
                    }
                    throw 'variable not found: ' + [ namespace, root_name ].concat(names).join(': ');
                }

                // STEP THREE: resolve {{keys}}
                if ( !keys ) keys = {};

                keys['origin'] = location.origin;
                keys['next week'] = new Date();
                keys['next week'].setDate(keys['next week'].getDate()+7);
                keys['next week'] = keys['next week'].toUTCString().replace(/:[0-9][0-9] /, ' ' );

                var has_changed = false;
                do {
                    has_changed = false;
                    variable = variable.replace( /{{([^{}\n]+)}}/g, function(match, key) {
                        key = key.toLowerCase();
                        if ( keys.hasOwnProperty(key) ) {
                            has_changed = true;
                            return keys[key];
                        } else if ( key.search(':') != -1 ) {
                            try {
                                var names = key.split(/:\s*/);
                                var ret = stash.parse_variable( names.shift(), names, keys, 'string', forum_id, thread_id );
                                has_changed = true;
                                return ret;
                            } catch (e) {};
                        }
                        return match;
                    })
                } while ( has_changed );

                // STEP FOUR: parse
                function parse_array() {
                    var array = [];
                    variable.replace( /\[list\]\s*\[\*\]\s*((?:.|\n)*?)\s*\[\/list\]/i, function(text, list) {
                        array = list.split( /\s*\[\*\]\s*/);
                    });
                    return array;
                }

                function parse_item(item) {
                    var ret = { type: 'text', value: item };
                    item
                        .replace( /^\[thread=([0-9]+)](.*)\[\/thread\]$/i, function(text, thread_id, value) {
                            ret = { type: 'thread', value: value, thread_id: parseInt( thread_id, 10 ) };
                            return '';
                        }).replace(/^\[post=([0-9]+)](.*)\[\/post\]$/i, function(text, thread_id, value) {
                            ret = { type: 'post', value: value, post_id: parseInt( thread_id, 10 ) };
                            return '';
                        }).replace(/^\[URL=\"[^"]*\/forumdisplay.php\?f=([0-9]+)"\](.*)\[\/URL\]$/i, function(text, forum_id, value) {
                            ret = { type: 'forum', value: value, forum_id: parseInt( forum_id, 10 ) };
                            return '';
                        }).replace(/^\[URL=\"(.+)"\](.*)\[\/URL\]$/i, function(text, url, value) {
                            ret = { type: 'url', value: value, url: url };
                            return '';
                        });
                    return ret;
                }

                switch ( parser || 'string' ) {
                case 'string': return variable;
                case 'array of items':
                    return parse_array().map(parse_item);
                case 'hash of arrays':
                    var ret = {};
                    parse_array().forEach(function(item) {
                        item.replace( /^\s*(.*?):\s*(.*?)\s*$/, function( text, key, values ) {
                            if ( !ret.hasOwnProperty(key) ) ret[key] = [];
                            ret[key] = ret[key].concat( values.split(/\s*,\s*/).map(parse_item) );
                        });
                    });
                    return ret;
                default:
                    throw "Please pass a known parser, not '" + parser + '"';
                }

            }

            function fix_languages() {
                var tl = stash.parse_variable( 'policy', 'thread languages', {}, 'hash of arrays' );
                var fl = stash.parse_variable( 'policy',  'forum languages', {}, 'hash of arrays' );
                Object.keys(tl).forEach(function(language) { tl[language].forEach(function(thread) { if ( thread.type == 'thread' ) thread_languages[thread.thread_id] = language; }); });
                Object.keys(fl).forEach(function(language) { fl[language].forEach(function(forum ) { if (  forum.type == 'forum'  )  forum_languages[ forum. forum_id] = language; }); });
            }
            if ( variables.length == 0 )
                stash.variables_promise.done(fix_languages);
            else
                fix_languages();

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
                stash.variables_promise.done(function() {
                    $.ajax({
                        url: '/infraction.php?do=report&u=123', // get any old infraction page to find the infractions list
                        dataType: 'html',
                        success: function(html) {
                            var infraction_map = {};
                            var infractions = $(html).find('input[name="infractionlevelid"]').map(function() {
                                if ( $(this).val() != '0' ) {
                                    var name = $.trim($(this).parent().text());
                                    infraction_map[ name.toLowerCase() ] = true;
                                    return {
                                        name: name,
                                        id: $(this).val(),
                                        points: $(this).closest('td').next().text()
                                    }
                                }
                            }).get();
                            if ( !infractions.length ) {
                                alert( "Could not refresh the list of infractions - some moderator actions may not work until you refresh the page" );
                                return;
                            }

                            var bad_infractions = stash.parse_variable('policy', 'infraction-worthy violations', {}, 'array of items').filter(function(violation) { return !infraction_map.hasOwnProperty(violation.value) });
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

                            var bad_pms = stash.parse_variable('policy', 'PM-worthy violations', {}, 'array of items').filter(function(violation) { return !infraction_map.hasOwnProperty(violation.value) });
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
                        error: function() {
                            alert( "Could not refresh the list of infractions - some moderator actions may not work until you refresh the page" );
                        }
                    });
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

            stash.send_pm = function( username, title, message, request_receipt ) {
                return stash.post_message(
                    '/private.php?do=insertpm',
                    {
                        'do': 'insertpm',
                        title: title,
                        message: message,
                        message_backup: message,
                        recipients: username,
                        savecopy: 1,
                        sbutton: 'Submit Message',
                        receipt: request_receipt ? 1 : undefined
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

            stash.give_infraction = function( note, ban_reason, message, user_id, post_id, is_warning, infraction_id ) {
                var data = {
                    'do': 'update',
                    note: note,
                    banreason: ban_reason,
                    message: message,
                    message_backup: message,
                    infractionlevelid: infraction_id,
                    savecopy: 1,
                    sbutton: 'Give Infraction',
                    p: post_id,
                    u: user_id,
                };
                if ( is_warning ) data['warning['+infraction_id+']'] = 1;
                return stash.post_message( '/infraction.php?do=update', data ).then(function(html) {
                    var errors = $(html).find( '.blockrow.error' );
                    if ( errors.length && errors.text().length ) {
                        alert("Could not give infraction:\n" + errors.text());
                        var dfd = new jQuery.Deferred();
                        dfd.reject();
                        return dfd.promise();
                    }
                });
            }

            stash.give_custom_infraction = function( note, ban_reason, message, user_id, post_id, is_warning, reason, points ) {
                if ( is_warning ) points = 0;
                var data = {
                    'do': 'update',
                    note: note,
                    banreason: ban_reason,
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

            stash.ban_user = function( user, message, is_spam, period, expires ) {
                return stash.post_message( '/modcp/banning.php?do=dobanuser', {
                    'do': 'dobanuser',
                    username: user,
                    usergroupid: is_spam ? 22 : 8,
                    period: ( period == 'PERMANENT' ? period : period + '_' + expires ),
                    reason: message
                });
            }

            stash.find_user_ban = function( username ) {
                return $.get( '/modcp/banning.php?do=modify' ).then(function(html) {
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
                                    page      : '/modcp/banning.php?do=modify&page=' + current
                                };
                            } else {
                                return; // user has not been banned
                            }
                        };
                        current = Math.floor( ( first + last + 1 ) / 2 );
                        return $.get( '/modcp/banning.php?do=modify&page=' + current ).then(check);
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
            stash.redirect_duration.period = 'PERMANENT'; // trick the "redirect duration" code into setting the correct duration
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


    { // retrieve the list of posts awaitng moderation
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
                    url: '/modcp/moderate.php?do=posts',
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

                $('<a class="stopforumspam" href="//api.stopforumspam.org/api?username=' + encodeURIComponent($(this).text()) + '&amp;f=json">search on StopForumSpam.com</a>')
                    .insertAfter( ignore_button )
                    .data( 'user-page', this.href )
                    .before(' - ')
                ;

                $('<label><input type="radio" tabindex="1" value="0">Spambot</label>')
                    .insertAfter(ignore_button)
                    .before(' ')
                    .children()
                    .attr( 'name', ignore_button.children().attr('name') )
                    .addClass( 'spambot' )
                ;

                var user_id = this.href.split('&u=')[1];
                ignore_button.closest('td').data( 'user_id', user_id ).addClass( 'user-'+user_id );


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
            $('input[value="1"][name^="threadaction"]').each(function() {
                $('<label>Validate and bump&nbsp;</label>').insertBefore(this.parentNode).prepend($(this).clone().removeAttr('id').addClass('bump'));
            });

            $('<a style="margin-left:1em" href="#update-notes">update</a>')
                .insertAfter('input[id^="it_threadnotes"]')
                .click(function(event) {
                    var input = this.previousElementSibling;
                    input.id.replace(/^it_threadnotes\[([0-9]*)\]_[0-9]*$/, function( match, thread_id ) {
                        stash.thread_edit( thread_id, $('input[name="threadtitle\\['+thread_id+'\\]"]').val(), $(input).val(), undefined, undefined, true );
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
                        console.log(this.value);
                        $('.user-'+$(this).closest('td').data('user_id') + ' .spambot:checked').closest('td').find( 'input[value=0]').not('.spambot').prop( 'checked', true ).each(radio_change);
                    }
                });
            $('a[href^="user.php"]').each(function() {
                var user_id = this.href.split('&u=')[1];
                $(this).after(' - <a href="/member.php?u=' + user_id + '">member page</a> - <a href="/private.php?do=newpm&u=' + user_id + '">send PM</a>');
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
                        $(preview).show().html(stash.loading_html);
                        stash.get_vbcode_html_newthread( $(this).closest('tr').prev().prev().find('a').attr('href').split('?f=')[1], $(vbcode).val() )
                            .done(function(html) {
                                $(preview).html(html);
                            });
                    }
                });
            $('#submit0,#submit1').click(function(event) {
                var promises = [], known_users = {}, form = $(this).closest('form'), table = $( this.id == 'submit0' ? '#threads_table' : '#posts_table' );
                table.find('input.bump:checked').each(function() {
                    $(this).attr('name').replace( /^threadaction\[([0-9]*)\]$/, function( match, thread_id ) {
                        promises.push( stash.thread_bump(thread_id) );
                    });
                });
                table.find('input.spambot:checked').each(function() {
                    var user_id = $(this).closest('td').data('user_id');
                    if ( known_users.hasOwnProperty(user_id) ) return;
                    known_users[user_id] = true;
                    $(this).attr('name').replace( /^(post|thread)action\[([0-9]*)\]$/, function( match, type, id ) {
                        promises.push(
                            ( type == 'post' )
                            ?                                                            stash.spammer_delete( user_id, id               )
                            : stash.get_thread_posts( id ).then(function(posts) { return stash.spammer_delete( user_id, posts[0].post_id ) })
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
                        $this.html( stash.loading_html );
                        stash.thread_reply(
                            $this.siblings('.title').attr('id').substr(13), // thread_title_12345
                            stash.parse_variable('other templates', 'post title: welcome', { 'thread starter': thread_starter }, 'string', 16),
                            stash.parse_variable('other templates',  'post body: welcome', { 'thread starter': thread_starter }, 'string', 16)
                        )
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
        pass_storage: [ 'newbies', 'max_newbie_id' ],
        callback: function(stash, pathname, params, newbies, max_newbie_id) {

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
                            '<h4 class="collapse blockhead options_correct">Most recent post in <a href="/showthread.php?t=' + stash.parse_variable('policy', 'mod log thread id') + '&goto=newpost">the moderation thread</a></h4>' +
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
                        stash.thread_openclose( threadbit.attr('id').substr(7), $(this).closest('.threadbit').hasClass('lock') )
                            .done(function() { threadbit.toggleClass('lock') });
                });
                var title_suffix =
                    stash.parse_variable('report process', 'report title suffix', { moderator: 'ANY_MODERATOR' })
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
            stash.report_block.find('#last_post_container').load( '/showthread.php?t=' + stash.parse_variable('policy', 'mod log thread id') + '&goto=newpost .postcontainer:last', function() {
                stash.report_block.find('.posthead,.postfoot,.after_content').remove();
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
                        .html( '<div>' + newbies.join(', ') + '</div><input style="width: 100%; padding: 0.5em; margin-top: 0.5em" type="button" value="mark read">' )
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
                var dfd = new jQuery.Deferred();
                stash.thread_edit( current_thread, title, 'Closing in preparation for merge', undefined, true ) // close thread
                    .done(function(html) { // Get information from the closed thread
                        html = $(html);
                        var current_forum = html.find( '#breadcrumb .navbit a').last().attr('href').split( '?f=' )[1];
                        var current_title = html.find( '#breadcrumb .navbit.lastnavbit' ).text().replace( /^\s*|\s*$/g, '' );
                        stash.get_thread_posts( current_thread, html ).done(function (posts) {
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
                            stash.thread_reply( // Notify/save all posts in thread
                                stash.parse_variable('policy', 'merge log thread id'),
                                stash.parse_variable('report process', 'merge title', variable_data),
                                stash.parse_variable('report process', 'merge body' , variable_data)
                            ).done(function(html) {
                                dfd.resolve();
                            });
                        })
                    });
                return dfd.promise();
            }

            stash.merge_destinations = stash.parse_variable('policy', 'frequent merge destinations', {}, 'array of items');

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
                            location = '/showthread.php?' + variable_thread_id;
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
                            $(this).html(stash.loading_html);
                            $.get( '/showthread.php?t=' + destination.thread_id, function(html) {
                                html = $(html);
                                var forum_id = html.find( '#breadcrumb .navbit a').last().attr('href').split( '?f=' )[1];
                                var title = $.trim($('.lastnavbit').text());
                                stash.report_merge( params.t, title, forum_id, destination.thread_id, destination.value).done(function() {
                                    stash.thread_merge_and_go( '/showthread.php?goto=newpost&t='+stash.parse_variable('policy', 'mod log thread id'), forum_id, [ destination.thread_id, params.t ] );
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

                var report_element = this.report_element.wrap('<div class="mod-tools-menu"></div>').parent();

                stash.convert_link_to_menu( report_element.find('a'), 'the report page' );

                report_element.append(
                    '<ul class="popupbody memberaction_body">' + infractions + '</ul>'
                ).find('li a').attr( 'href', 'report.php?p=' + this.post_id ).click(function(event) {
                    var post_id = $(this).attr('href').substr(13);
                    $(this).before(stash.loading_html);
                    stash.report_post(
                        post_id,
                        $(this).text().replace( /^.Take report: /, '' ).replace( /\xA0$/, '' )
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
                                var report_owner = stash.process_posts( $(html).find('.flare_Moderator').closest('li') )[0].username
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
                        '<li><a class="stopforumspam" href="//api.stopforumspam.org/api?ip=' + encodeURIComponent(this.ip) + '&username=' + encodeURIComponent(this.username) + '&f=json">Check on StopForumSpam.com</a>' +
                        '<li><a href="http://multirbl.valli.org/lookup/' + encodeURIComponent(this.ip) + '.html">Check on MultiRBL.valli.org</a>' +
                        '<li><a href="https://www.projecthoneypot.org/ip_' + encodeURIComponent(this.ip) + '">Check on ProjectHoneypot.org</a>' +
                    '</ul>'
                ).appendTo(ip_element)
                    .find('.stopforumspam')
                    .click(function(event) {
                        stash.check_on_stopforumspam( $(this).attr('href') );
                        event.preventDefault();
                    });

            });

            // link from moderated posts to moderation page
            $('img.moderated').parent().wrap('<a></a>').parent().attr( 'href', '/modcp/moderate.php?do=posts' );

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

            stash.when( $('#destthread option').map(function() { return $.get( '/showthread.php?t='+this.value ) }).get() ).done(function(threads) {
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

                $('input[type="submit"]').before(stash.loading_html);

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
            var merge_log = stash.parse_variable('policy', 'merge log thread id');
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
                                stash.thread_create( data.forum_id, data.title, stash.parse_variable('report process', 'unmerge notification body', variable_data) ).done(function(html) {
                                    var new_thread_id = $(html).find( 'input[name="t"]' ).val();
                                    if  ( typeof(new_thread_id) == 'undefined' ) {
                                        alert("Failed to create unmerge thread - please try again later");
                                    } else {
                                        variable_data['destination thread id'] = new_thread_id;
                                        stash.post_move( new_thread_id, data.posts ).done(function() {
                                            stash.thread_reply_and_go(
                                                '/showthread.php?goto=newpost&t='+merge_log,
                                                merge_log,
                                                stash.parse_variable('report process', 'unmerge title', variable_data), stash.parse_variable('report process', 'unmerge body', variable_data)
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

                var forum = $('#breadcrumb .navbit a[href^="forumdisplay.php"]').last().attr('href');
                var thread = $('#breadcrumb .navbit a[href^="showthread.php"]').last().attr('href');

                $('#note').val( ( is_warning ? 'Official warning for ' : 'Infraction for ' ) + infraction.toLowerCase() );
                BabelExt.utils.runInEmbeddedPage(
                    "vB_Editor['vB_Editor_001'].write_editor_contents(" + JSON.stringify(
                        stash.parse_variable(
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
            stash.parse_variable('policy', 'pm-worthy violations', {}, 'array of items').forEach(function(violation) { pm_worthy_violations[violation.value] = true });
            var infraction_worthy_violations = {};
            stash.parse_variable('policy', 'infraction-worthy violations', {}, 'array of items').forEach(function(violation) { infraction_worthy_violations[violation.value] = true });

            var first_post = stash.process_posts()[0],
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
                var expected_title_suffix = stash.parse_variable('report process', 'report title suffix', { moderator: $('.welcomelink a').text() });
                if ( document.title.search( expected_title_suffix.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1") ) == -1 )
                    stash.thread_edit(
                        params.t,
                        document.title.replace(
                            new RegExp(
                                stash.parse_variable('report process', 'report title suffix', { moderator: "\uE000" })
                                    .replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1") // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
                                    .replace( "\uE000", '.*?' )
                                    + '$'
                            )
                        ) + expected_title_suffix,
                        'appending username',
                        undefined,
                        thread_closed
                    );
                handle_thread();
                break;
            case 'taken':
                var report_owner_id = mod_posts.filter(function() { return this.username == report_owner })[0].user_id;
                common_actions.find('.postcontent').html(
                    '<ul style="margin: 1em; padding-left: 1em">' +
                        '<li><a href="/private.php?do=newpm&u=' + report_owner_id + '">PM the report owner (' + report_owner +')</a>' +
                        '<li><a href="/newreply.php?t=' + stash.parse_variable('policy', 'mod log thread id') + '">Copy an appeal to the moderation log</a>' +
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
                        '<li><a href="/newreply.php?t=' + stash.parse_variable('policy', 'mod log thread id') + '">Copy an appeal to the moderation log</a>' +
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
                          '<br>Total processed posts: <em id="total-processed"></em>' +
                          '<br>Total edited posts: <em id="total-edited"></em>' +
                          '<br>Total deleted posts: <em id="total-deleted"></em>' +
                        '</fieldset>' +

                      '</div>' +

                      '<div class="column2">' +
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
                            stash.parse_variable( 'report process',    'warning message', violation_variable_data, 'string', forum_to_review_id, stash.thread_to_review_id ) +
                          '</div>' +
                          '<div class="infract">' +
                            '<div style="text-align:center;font-size:larger" id="need-modcp-login"><b>Note:</b> you must log in to ModCP (above) before you can issue a ban.</div>' +
                            stash.parse_variable( 'report process', 'infraction message', violation_variable_data, 'string', forum_to_review_id, stash.thread_to_review_id ) +
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
                var resolution_data = [], commands_in_the_air = 0, resolution_variables = {};
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
                            per_post_actions.del .map(function(post) {
                                return post.vbcode_promise.then(function() {
                                    return stash.post_delete(
                                        post.post_id,
                                        stash.parse_variable('report process', [ 'deletion reason', post.is_reported_post ? 'reported post' : 'later post', resolution_variables.violation ], resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id)
                                    );
                                });
                            }).concat(
                                per_post_actions.edit.map(function(post) {
                                return post.vbcode_promise.then(function() {
                                    return stash.post_edit(
                                        post.post_id,
                                        post.replaced_vbcode,
                                        stash.parse_variable('report process', [ 'edit reason', post.is_reported_post ? 'reported post' : 'later post', resolution_variables.violation ], resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id)
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
                        stash.thread_reply_and_go(
                            location.toString(),
                            params.t,
                            stash.parse_variable('report process', 'post title: close report', resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id),
                            stash.parse_variable('report process', 'post body: close report' , resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id),
                            !thread_closed
                        );
                    }
                }
                $('#submit-resolution').click(function(event) {
                    resolution_variables = $.extend( resolution_variables, useraction_data.variables(), per_post_data.variables() );
                    resolution_variables['extra notes'] = $('#extra-notes').val();
                    resolution_data.push(
                        {
                            get_promises: function() { return [
                                stash.add_user_note(
                                    user_to_review_id,
                                    stash.parse_variable('report process', 'user notes title: report', resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id ),
                                    stash.parse_variable('report process', 'user notes body: report' , resolution_variables, 'string', forum_to_review_id, stash.thread_to_review_id )
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

                    if ( useraction_data.titles.length ) {
                        resolution_data.push( useraction_data );
                        actions.push( 'Give [i]' + user_to_review.text() + '[/i] an ' + useraction_data.action_text );
                        resolution_variables['notification type'] = useraction_data.description;
                    }
                    if ( per_post_data.titles.length ) {
                        resolution_data.push( per_post_data );
                        actions.push( per_post_data.description );
                    }

                    resolution_variables.overview = actions.join(', ').replace(/^(.)/, function(_,letter) { return letter.toUpperCase() } ) + ', update user notes and close the report'

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

                    $('input[name=action][value="'+(posts[current_post].per_post_action||'')+'"]').click();
                    $('input[name=action]').prop( 'disabled', posts[current_post].is_deleted );

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
                        $('#apply-to-after').text( ' (' + (posts.length-1) + ')' );
                        var re = new RegExp( 'showthread\.php(?:\\?|.*&)p=' + post_to_review_id + '($|&|#)' );
                        posts.forEach(function(post) {
                            post.after = post.post_id != post_to_review_id;
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

                // Firefox collapses whitespace in selections - seems to be a known bug: https://bugzilla.mozilla.org/show_bug.cgi?id=601586
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
                                stash.parse_variable('report process', [ 'replacement', $(this.previousSibling).val() ], {}, 'array of items' )
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

                    $('#issue-info').html( stash.parse_variable('report process', [ 'information', issue_count, issue_name ], {}, 'string', forum_to_review_id, stash.thread_to_review_id) );
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

                    stash.review_post_contents_promise.done(function(original_post_vbcode) { stash.review_post_promise.done(function() {

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
                            'original post vbcode': original_post_vbcode,
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
                            $('.useraction .pm input'   ).val( stash.parse_variable('violation info', [ 'PM title', issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id ) );
                            $('.useraction .pm textarea').val( stash.parse_variable('violation info', [ 'PM body' , issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id ) );
                            useraction_data = {
                                description: 'explanatory PM',
                                action_text: '[img]'+location.origin+'/images/buttons/add-infraction_sm.png[/img] explanatory PM',
                                get_promises: function() { return [stash.send_pm( user_to_review.text(), $('.useraction .pm input').val(), $('.useraction .pm textarea').val() )] },
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
                                stash.parse_variable('violation info', [ 'infraction', issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id )
                            );
                            useraction_data = {
                                description: variables['infraction type'],
                                action_text: action_text,
                                get_promises: function() {
                                    var issues = get_issues();
                                    var args = [
                                        'See ' + document.location.toString(), // administrative note
                                        stash.parse_variable('report process', [ 'ban reason', issue_count, issue_name ], variables, 'string', forum_to_review_id, stash.thread_to_review_id ),
                                        textarea.val(),
                                        user_to_review_id,
                                        post_to_review_id,
                                        is_warning,
                                    ];

                                    var ret = [];

                                    if ( issues.length == 1 ) {
                                        args.push( issues[0].id );
                                        ret.push(stash.give_infraction.apply( stash, args ));
                                    } else if ( issues.length == 0 ) {
                                        alert("Please select an issue");
                                        throw "Pleaese select an issue";
                                    } else {
                                        args.push(
                                            issues.map(function() { return this.name }).get().join(', '),
                                            [0].concat(issues.get()).reduce(function(a,b) { return a + b.points })
                                        );
                                        ret.push(stash.give_custom_infraction.apply( stash, args ));
                                    }

                                    if ( period ) {
                                        ret.push(promises.modcp.then(function() {
                                            return stash.ban_user(
                                                user_to_review.text(),
                                                resolution_variables.violation,
                                                false, // spam isn't handled through the reporting system
                                                period,
                                                expires
                                            );
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

                $('.useraction .switch-mode-preview').click(function() {
                    var preview = $('.useraction div.preview:visible');
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
