/**
 * @file Bulletin Board API
 * @author Andrew Sayers
 */

/**
 * @summary Generic class for any type of bulletin board
 * @constructor
 * @abstract
 */
function BulletinBoard() {}
BulletinBoard.prototype = Object.create(null, {

    url_for: { // construct product-specific URLs
        writable: false,
        configurable: false,
        value: {
            // concrete implementations should add functions here to build URLs
        }
    }

});

/*
 * GENERIC UTILITY FUNCTIONS
 */

/**
 * @summary Convenience function to construct a URL
 *
 * @example
 * // returns "/example.html?f=qux&b=default+value"
 * bb.build_url(
 *     '/example.html',
 *     [
 *         { key: 'foo', param: 'f' },
 *         { key: 'bar', param: 'b', default: 'default value' },
 *         { key: 'baz', param: 'bb' },
 *     ],
 *     { foo: 'qux' }
 * );
 *
 * @param {string}                 url base URL (e.g. "http://www.example.com/example.html")
 * @param {Array.<Object>}         valid_args arguments that could be added to this URL
 * @param {Object.<string,string>} args arguments to add to the URL
 * @param {string=}                hash string added after the '#'
 * @protected
 */
BulletinBoard.prototype.build_url = function( url, valid_args, args, hash ) {
    var connector = '?';
    if ( valid_args ) {
        if ( !args ) args = {};
        valid_args.forEach(function(arg) {
            if ( args.hasOwnProperty(arg.key) || arg.hasOwnProperty('default') ) {
                var value = args.hasOwnProperty(arg.key) ? args[arg.key] : arg['default'];
                if ( arg.map ) value = arg.map[value] || value;
                url += connector + encodeURIComponent(arg.param) + '=' + encodeURIComponent(value);
                connector = '&';
            }
        });
    }
    if ( hash ) url += '#' + hash;
    return url;
}

/**
 * @summary Sane wrapper around $.when()
 *
 * @description $.when() wants a variadic list of arguments and has
 * a different return syntax when passed a single item than many.
 * This makes it hard to use when you want to pass a variable number
 * of Deferreds.
 *
 * @param {Array.<jQuery.Promise>} promises array of promises to wait for
 * @return {jQuery.Promise} return values from each promise
 */
BulletinBoard.prototype.when = function(promises) {
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
 * BULLETIN-BOARD-NEUTRAL UTILITY FUNCTIONS
 */

/**
 * @summary Send a message to the server as either an AJAX request or a form
 * @protected
 * @param {string}  url URL to send to
 * @param {Object}  data parameters to send
 * @param {boolean} use_form send a form requset instead of an AJAX request
 * @return {jQuery.Promise}
 */
BulletinBoard.prototype.post = function( url, data, use_form ) {

    var bb = this;

    return this._add_standard_data(data).then(function(data) {
        if ( use_form ) {
            var form = $('<form method="post"></form>')
                .appendTo('body')
                .attr( 'action', url );
            Object.keys(data).forEach(function(key) {
                if ( typeof(data[key]) != 'undefined' )
                    $('<input type="hidden">').appendTo(form).attr( 'name', key ).val( data[key] );
            });
            form.submit();
        } else {
            return $.ajax({
                type: "POST",
                url: url,
                data: data,
            }).then(function(reply) {
                var err = bb.detect_post_error( reply );
                if ( err !== null ) {
                    alert( "Couldn't load page " + url + "\n\nError:\n" + err );
                    var dfd = new jQuery.Deferred();
                    dfd.reject();
                    return dfd;
                } else {
                    return reply;
                }
            });
        }
    });

}

/**
 * @summary Add parameters required for standard POST requests
 * @protected
 * @abstract
 * @param {Object} data parameters passed to jQuery
 * @return {jQuery.Promise} deferred object that will return when all necessary parameters have been found
 */
BulletinBoard.prototype._add_standard_data = function(data) {}

/**
 * @summary Get the current and maximum page number
 * @abstract
 * @param {string|jQuery|HTMLDocument} doc document to get posts for
 * @return {Array.<number>} current and maximum page numbers
 */
BulletinBoard.prototype.get_pages = function(doc) {}

/**
 * @summary Get all documents on the specified page
 * @abstract
 * @param {string|jQuery|HTMLDocument} doc document to get posts for
 * @return {jQuery} list of posts
 */
BulletinBoard.prototype.get_posts = function(doc) {}

/**
 * @summary Map a list of elements returned by get_posts() to data about the posts they represent
 * @abstract
 * @param {jQuery} posts list of post elements
 * @return {jQuery} list of hashes describing each post
 */
BulletinBoard.prototype.process_posts = function(posts) {}

/**
 * @summary Return the error string contained in a reply to post(), or null on success
 * @protected
 * @abstract
 * @param {HTMLDocumentObject|XMLDocumentObject|string} reply
 * @param {string|null}
 */
BulletinBoard.prototype.detect_post_error = function(reply) {}

/*
 * FUNCTIONS DIRECTLY USEFUL TO CONSUMERS OF THIS API
 */

/**
 * @summary Map BBCode to a list of (non-nested) quotes
 * @param {string} text BBCode to parse
 * @return {Array.Object}
 *
 * @description Note: supports vBCode's [quote=author;post_id] syntax
 */
BulletinBoard.prototype.quotes_process = function(text) {
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

/**
 * @summary Get information about posts from many pages in a thread
 *
 * @description We need to get a single page first, to work out the
 * number of pages in the thread.  Passing in that first page will
 * make the function return faster, and will cause only pages after
 * that one to be loaded.
 *
 * @param {number} thread_id ID of thread to get posts for
 * @param {string|jQuery|HTMLDocument} doc document to get posts for
 * @return {jQuery.Promise} Deferred object that will return when all pages have loaded
 */
BulletinBoard.prototype.thread_posts = function( thread_id, first_page ) {

    var bb = this;

    function get_later_pages(html) {
        html = $(html);

        var posts = bb.process_posts(bb.get_posts(html));

        if ( !posts.length ) {
            var dfd = new jQuery.Deferred();
            dfd.reject('no posts found');
            return dfd.promise();
        }

        var more_pages = [];
        var pages = bb.get_pages(html);
        for ( var n=pages.current+1; n<=pages.total; ++n )
            more_pages.push(
                $.get(bb.url_for.thread_show({ thread_id: thread_id, page_no: n }))
                    .then(function(html) {
                        return bb.process_posts(bb.get_posts(html));
                    })
            );

        if ( more_pages.length ) {
            return bb.when(more_pages).then(
                function(more_posts) { more_posts.forEach(function(more) { posts = posts.add(more); }); return posts },
                function(          ) { return 'Failed to load some later pages in ' + bb.url_for.thread_show({ thread_id: thread_id }) }
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
        url: bb.url_for.thread_show({ thread_id: thread_id }),
        dataType: 'html',
        success: function(html) {
            get_later_pages(html).then(
                function(posts) { dfd.resolve(posts) },
                function(arg  ) { dfd.reject (arg  ) }
            );
        },
        error: function() {
            dfd.reject('Failed to load thread ' + bb.url_for.thread_show({ thread_id: thread_id }) );
        }
    });

    return dfd.promise();

}




/**
 * @summary vBulletin API
 * @extends BulletinBoard
 * @constructor
 */
function VBulletin() { BulletinBoard.call(this) }
VBulletin.prototype.constructor = VBulletin;
VBulletin.prototype = Object.create(BulletinBoard.prototype, {

    standard_post_data: {
        writable: false,
        configurable: false,
        value: {
            parseurl: 1,
            //signature: 1, // signatures distract from the objectivity of the communication
            wysiwyg: 0
        }
    },

    redirect_duration: { // redirects are shown for one week by default
        writable: false,
        configurable: false,
        value: { period: 1, frame: 'w' }
    },

    _forum_threads_callback_initialised: {
        writable: true,
        configurable: false,
        value: 0
    },

    _user_ips_data: {
        writable: true,
        configurable: false,
        value: 0
    },

    url_for: { // construct product-specific URLs
        writable: false,
        configurable: false,
        value: {
            forum_show: function(args) { return BulletinBoard.prototype.build_url(
                '/forumdisplay.php',
                [
                    { key: 'forum_id', param: 'f' }
                ],
                args
            )},

            moderation_inline: function() { return BulletinBoard.prototype.build_url( '/inlinemod.php' ) },
            moderation_posts : function() { return BulletinBoard.prototype.build_url( '/modcp/moderate.php?do=posts' ) },
            moderation_user  : function() { return BulletinBoard.prototype.build_url( '/modcp/user.php' ) },

            infraction_give: function(args) { return BulletinBoard.prototype.build_url(
                '/infraction.php',
                [
                    { key: 'user_id', param: 'u' },
                    { key: 'post_id', param: 'p' },
                    { key: 'action' , param: 'do', 'default': 'view' },
                ],
                args
            )},

            user_notes: function(args) { return BulletinBoard.prototype.build_url(
                '/usernote.php',
                [
                    { key: 'user_id', param: 'u' }
                ],
                args
            )},

            user_show: function(args) { return BulletinBoard.prototype.build_url(
                '/member.php',
                [
                    { key: 'user_id', param: 'u' }
                ],
                args
            )},

            users_show: function(args) { return BulletinBoard.prototype.build_url(
                '/memberlist.php',
                [
                    { key: 'order'   , param: 'order', 'default': 'desc' },
                    { key: 'sort'    , param: 'sort' , 'default': 'joindate' },
                    { key: 'per_page', param: 'pp'   , 'default': '100' },
                    { key: 'page_no' , param: 'page' }
                ],
                args
            )},

            search: function() { return BulletinBoard.prototype.build_url( '/search.php' ) },

            thread_edit: function(args) { return BulletinBoard.prototype.build_url(
                '/postings.php',
                [
                    { key: 'action'   , param: 'do' },
                    { key: 'thread_id', param: 't' }
                ],
                args
            )},
            thread_show: function(args) { return BulletinBoard.prototype.build_url(
                '/showthread.php',
                [
                    { key: 'thread_id'      , param: 't' },
                    { key: 'posts_per_page' , param: 'pp', default: 50 },
                    { key: 'post_id'        , param: 'p' },
                    { key: 'page_no'        , param: 'page' },
                    { key: 'show_if_deleted', param: 'viewfull', map: { true: 1, false: '' } },
                    { key: 'goto'           , param: 'goto' }, // usually 'newpost'
                ],
                args,
                args.post_id ? 'post' + args.post_id : undefined // hash
            )},

            post_edit: function() { return BulletinBoard.prototype.build_url( '/editpost.php' ) },
            post_show: function(args) { return BulletinBoard.prototype.build_url(
                '/showthread.php',
                [
                    { key: 'thread_id'      , param: 't' },
                    { key: 'post_id'        , param: 'p' },
                    { key: 'show_if_deleted', param: 'viewfull', map: { true: 1, false: '' } },
                ],
                args,
                args.post_id ? 'post' + args.post_id : undefined // hash
            )},

        }
    }

});

/*
 * UTILITY FUNCTIONS
 */

VBulletin.prototype.get_posts = function(doc) { return $( doc || document ).find('#posts').children() }

VBulletin.prototype.get_pages = function(doc) {
    var ret = { current: 1, total: 1 };
    ( $( doc || document ).find('.pagination a').first().text() || '' ).replace( /Page ([0-9]+) of ([0-9]+)/, function(match, current, total) {
        ret = { current: parseInt( current, 10 ), total: parseInt( total  , 10 ) };
    });
    return ret;
}

VBulletin.prototype.process_posts = function(posts) {
    if ( !posts ) posts = this.get_posts();
    return (
        posts
            .map(function() {
                return {
                    container_element: this,
                    post_id          : this.id.substr(5),
                    date             : $('.date'       , this).text(),
                    username         : $('.username'   , this).text(),
                    user_id          : ( $('.username' , this).attr('href') || '             guest' ).substr(13),
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

VBulletin.prototype._add_standard_data = function(data) {

    var dfd = new jQuery.Deferred();

    data = $.extend( data, this.standard_post_data );

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

VBulletin.prototype.detect_post_error = function(reply) {
    return (
        ( reply.getElementsByTagName && reply.getElementsByTagName('error').length ) // XML response
        ? reply.getElementsByTagName('error')[0].textContent
        : null
    );
}

/*
 * ATTACHMENT FUNCTIONS
 */

/**
 * @summary delete an array of attachments
 * @param {Array.<Object>} attachments attachment info, as returned from post_info()
 * @return {jQuery.Promise}
 */
VBulletin.prototype.attachments_delete = function( attachments ) {
    var info = {
        do               : 'manageattach',
        upload           : 0,
        s                : '',
        contenttypeid    : 1,
        MAX_FILE_SIZE    : 2097152,
        'attachmenturl[]': '',
        ajax             : '1'
    };
    var requests = {};
    attachments.forEach(function(attachment) {
        if ( !requests.hasOwnProperty(attachment.info.posthash) ) requests[attachment.info.posthash] = $.extend( info, attachment.info );
        requests[attachment.info.posthash][ 'delete['+attachment.id+']' ] = 1;
    });
    return this.when(Object.keys(requests).map(function(key) { return $.post( '/newattachment.php', requests[key] ) }));
}

/*
 * BBCODE FUNCTIONS
 */

/**
 * @summary Convert bbcode to HTML, for an existing thread
 * @param {Number} thread_id ID of thread to post in
 * @param {string} bbcode text to convert
 * @return {jQuery.Promise}
 */
VBulletin.prototype.bbcode_html = function( thread_id, bbcode ) {
    return this.post(
        '/newreply.php?do=postreply&t=' + thread_id,
        {
            message_backup: bbcode,
            message       : bbcode,
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

/**
 * @summary Convert bbcode to HTML, for a new thread in the specified forum
 * @param {Number} forum_id ID of forum to post in
 * @param {string} bbcode text to convert
 * @return {jQuery.Promise}
 */
VBulletin.prototype.bbcode_html_newthread = function( forum_id, bbcode ) {
    return this.post(
        '/newthread.php?do=postthread&f=' + forum_id,
        {
            'do': 'postthread',
            subject: 'Test converting bbcode to HTML',
            message_backup: bbcode,
            message: bbcode,
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
 * INFRACTION FUNCTIONS
 */

/**
 * @summary Give an infraction to a user
 * @param {Object} data infraction information
 * @return {jQuery.Promise}
 *
 * @example
 * bb.infraction_give({
 *     administrative_note: 'administrative note',
 *     reason             : 'ban reason to show the user',
 *     bbcode             : 'message body',
 *     user_id            : 1234, // must pass user_id or post_id
 *     post_id            : 2345,
 *     is_warning         : true,
 *     infraction_id      : 1
 * });
 */
VBulletin.prototype.infraction_give = function( data ) {
    var post_data = {
        do               : 'update',
        note             : data.administrative_note,
        banreason        : data.reason,
        message          : data.bbcode,
        message_backup   : data.bbcode,
        infractionlevelid: data.infraction_id,
        savecopy         : 1,
        sbutton          : 'Give Infraction',
        p                : data.post_id,
        u                : data.user_id,
    };
    if ( data.is_warning ) post_data['warning['+data.infraction_id+']'] = 1;
    return this.post( '/infraction.php?do=update', post_data ).then(function(html) {
        var errors = $(html).find( '.blockrow.error' );
        if ( errors.length && errors.text().length ) {
            alert("Could not give infraction:\n" + errors.text());
            var dfd = new jQuery.Deferred();
            dfd.reject();
            return dfd.promise();
        }
    });
}

/**
 * @summary Give an infraction to a user
 * @param {Object} data infraction information
 * @return {jQuery.Promise}
 *
 * @example
 * bb.infraction_give_custom({
 *     administrative_note: 'administrative note',
 *     reason             : 'ban reason to show the user',
 *     bbcode             : 'message body',
 *     user_id            : 1234, // must pass user_id or post_id
 *     post_id            : 2345,
 *     is_warning         : true,
 *     points             : 2, // number of infraction points to assign the user
 *     period             : 'M', // Months, Days etc.
 *     expires            : 3 // number of periods
 * });
 */
VBulletin.prototype.infraction_give_custom = function( data ) {
    if ( data.is_warning ) points = 0;
    return this.post( '/infraction.php?do=update', {
        do            : 'update',
        note          : data.administrative_note,
        banreason     : data.reason,
        message       : data.bbcode,
        message_backup: data.bbcode,
        savecopy      : 1,
        sbutton       : 'Give Infraction',
        p             : data.post_id,
        u             : data.user_id,

        infractionlevelid: 0,
        customreason     : data.reason,
        points           : data.points,
        expires          : data.expires,
        period           : data.period,
    });
}

/**
 * @summary get the valid infractions IDs for a user
 * @param {string=} user_id ID of user to get (default: 37)
 * @return {jQuery.Promise}
 *
 * @description
 *
 * All users should have the same infractions available, but there's
 * no API to retrieve infraction without a user ID.  User ID 37 is
 * high enough that it's unlikely to be a special un-infractable user,
 * but low enough it's likely to exist.  You should only need to pass
 * a different ID if the above isn't true of your user #37
 */
VBulletin.prototype.infraction_ids = function( user_id ) {

    return $.get( this.url_for.infraction_give({ action: 'report', user_id: user_id || 37 }) ).then(function(html) {
        return $(html).find('input[name="infractionlevelid"]').map(function() {
            if ( $(this).val() != '0' ) {
                var name = $.trim($(this).parent().text());
                return {
                    name  : name,
                    id    : $(this).val(),
                    points: $(this).closest('td').next().text()
                }
            }
        }).get();
    });

}

/*
 * POST FUNCTIONS
 */

/**
 * Monitor the list of posts
 * @param {function} callback function to call when a post is modified
 */
VBulletin.prototype.on_posts_modified = function( callback ) {

    function observe_mutation(mutations) {
        var modifications = {
            initialised: [],
            edited     : [],
        }, has_modifications = false;
        mutations.forEach(function(mutation) {
            var post_id = $(mutation.target).closest('li').attr('id').substr(5);
            if ( $(mutation.target).find('blockquote').length ) {
                has_modifications = true;
                modifications.initialised.push( post_id );
            } else if ( $(mutation.target).find('.texteditor').length ) {
                has_modifications = true;
                modifications.edited.push( post_id );
            }
        });
        if ( has_modifications ) callback( modifications );
    }
    var observer;
    if      ( typeof(      MutationObserver) != 'undefined' ) observer = new       MutationObserver(observe_mutation);
    else if ( typeof(WebKitMutationObserver) != 'undefined' ) observer = new WebKitMutationObserver(observe_mutation);
    $('#posts').each(function() { observer.observe(this, { childList: true, subtree: true }) });

}

/**
 * Create a new element that resembles a post
 * @param {string} date           text to show as the date
 * @param {string} username       text to show as the user's name
 * @param {string} user_title     text to show as the user's title (e.g. "moderator")
 * @param {string} post_title     text to show as the post title
 * @param {string} post_body_html HTML to show as the post body
 * @return {jQuery} new post element
 */
VBulletin.prototype.post_create = function( date, username, user_title, post_title, post_body_html ) {

    var post = $('#posts li').first().clone();

    post.find('[id]'               ).removeAttr( 'id' );
    post.find('.date'              ).text( date );
    post.find('.postdetails'       ).attr( 'class', 'postdetails' ); // remove flare etc.
    post.find('.iepostcounter'     ).text( '#0' );
    post.find('.username'          ).hide().attr( 'href', '' ).after( $('<b class="username"></b>').text( username ) );
    post.find('.memberaction_body' ).remove();
    post.find('.onlinestatus'      ).remove();
    post.find('.usertitle'         ).text(user_title);
    post.find('.postbit_reputation').remove();
    post.find('.postuseravatar'    ).remove();
    post.find('.userinfo_extra'    ).remove();
    post.find('.title'             ).text(post_title);
    post.find('.postrow'           ).removeClass('has_after_content');
    post.find('blockquote'         ).html(post_body_html);
    post.find('.after_content'     ).remove();
    post.find('.postfoot'          ).remove();

    return post;

}

/**
 * @summary Soft-delete a post
 * @param {Number} post_ID ID of post to retrieve
 * @param {string=} reason  deletion reason
 * @return {jQuery.Promise}
 */
VBulletin.prototype.post_delete = function( post_id, reason ) {
    return this.post(
        '/editpost.php',
        {
            do        : 'deletepost',
            postid    : post_id,
            reason    : reason,
            deletepost: 'delete',
        }
    );
}

/* This would save us some page requests, but sometimes forces us to log in again which negates any time benefit:
VBulletin.prototype.post_delete_multi = function( post_ids, reason ) {
    return this.post(
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

/**
 * @summary Change the contents of a post
 * @param {Number} post_ID ID of post to retrieve
 * @param {string} bbcode  bbcode of new post body
 * @param {reason=} reason edit reason
 * @return {jQuery.Promise}
 */
VBulletin.prototype.post_edit = function( post_id, bbcode, reason ) {
    return this.post(
        '/editpost.php?do=updatepost&postid=' + post_id,
        {
            'do': 'updatepost',
            postid: post_id,
            reason: reason,
            message: bbcode,
        }
    );
}

/**
 * @summary Get information about a post (vBCode and attachment info)
 * @param {Number} post_ID ID of post to retrieve
 * @return {jQuery.Promise}
 */
VBulletin.prototype.post_info = function( post_id ) {

    return this.post('/ajax.php?do=quickedit&p=' + post_id, {
        do: 'quickedit',
        p : post_id
    }).then(function(xml) {

        var post = $(xml.getElementsByTagName('editor')[0].textContent);
        var ret = {
            bbcode: post.find('#vB_Editor_QE_editor').text(),
        };

        // no attachments:
        if ( !post.find('input[id="cb_keepattachments"]').length ) return ret; // '#cb_keepattachments' doesn't work for some reason

        var ckeconfig = JSON.parse(xml.getElementsByTagName('ckeconfig')[0].textContent);
        var attachment_info = {
            securitytoken: ckeconfig.vbulletin.securitytoken,
            posthash     : ckeconfig.vbulletin.attachinfo.posthash,
            poststarttime: ckeconfig.vbulletin.attachinfo.poststarttime,
            'values[p]'            : post_id,
            'values[poststarttime]': ckeconfig.vbulletin.attachinfo.poststarttime,
            'values[posthash]'     : ckeconfig.vbulletin.attachinfo.posthash
        };

        return $.get( '/newattachment.php', {
            do           : 'assetmanager',
            'values[p]'  : post_id,
            editpost     : 1,
            contenttypeid: 1,
            insertinline : 1,
            posthash     : ckeconfig.vbulletin.attachinfo.posthash,
            poststarttime: ckeconfig.vbulletin.attachinfo.poststarttime,
        }).then(function(html) {
            ret.attachments = $(html).find('div.asset_div').map(function() {
                return {
                    // assets appear to have an asset ID and an attachment ID (in case they're e.g. attached to multiple posts)
                    // we only care about the attachment ID:
                    id       : $( '.asset_attachment_container', this ).attr('id').split('_')[2],
                    thumbnail: $('.asset_attachment,.asset_attachment_nothumb', this).attr( 'src' ),
                    filename : $('.filename', this).attr( 'title' ),
                    info     : attachment_info
                };
            }).get();
            return ret;
        });

    });
}

/**
 * @summary move an array of posts to the specified thread
 * @param {Number}         thread_id destination thread ID
 * @param {Array.<Number>} post_ids posts to move
 */
VBulletin.prototype.posts_move = function( thread_id, post_ids ) {
    return this.post(
        '/inlinemod.php?do=domoveposts&t=' + thread_id + '&postids=' + post_ids,
        {
            do            : 'domoveposts',
            type          : 1,
            mergethreadurl: '/showthread.php?t=' + thread_id,
            t             : thread_id,
            postids       : post_ids.join()
        }
    );
}

/**
 * @summary Report a post
 * @param {Number} post_id  ID of post to report
 * @param {string} bbcode   report body
 * @param {string} ajax_url URL to return from AJAX request
 * @return {jQuery.Promise}
 */
VBulletin.prototype.post_report = function( post_id, bbcode, ajax_url ) {
    return this.post(
        '/report.php?do=sendemail',
        {
            do    : 'sendemail',
            postid: post_id,
            reason: bbcode,
            url   : ajax_url
        }
    );
}

/**
 * @summary Send a private message
 * @param {string} to                username(s) to send to
 * @param {string} title             message title
 * @param {string} bbcode            message body
 * @param {boolean=} request_receipt whether to request a message receipt
 * @return {jQuery.Promise}
 */
VBulletin.prototype.pm_send = function( to, title, bbcode, request_receipt ) {
    return this.post(
        '/private.php?do=insertpm',
        {
            do            : 'insertpm',
            title         : title,
            message       : bbcode,
            message_backup: bbcode,
            recipients    : to,
            savecopy      : 1,
            sbutton       : 'Submit Message',
            receipt       : request_receipt ? 1 : undefined
        }
    );
}

/*
 * THREAD MANAGEMENT
 */

/**
 * @summary Bump a thread
 * @param {Number} thread_ID ID of thread to bump
 * @return {jQuery.Promise}
 */
VBulletin.prototype.thread_bump = function(thread_id) {
    return this.post(
        '/postings.php',
        {
            do: 'vsa_makenewer',
            t : thread_id
        }
    );
}

/**
 * @summary Create a new thread
 * @param {Number} forum_id ID of forum to create in
 * @param {string} title    thread title
 * @param {string} bbcode   bbcode of first post body
 * @return {jQuery.Promise}
 */
VBulletin.prototype.thread_create = function(forum_id, title, bbcode) {
    return this.post(
        '/newthread.php?do=postthread&f=' + forum_id,
        {
            do            : 'postthread',
            subject       : title,
            message_backup: bbcode,
            message       : bbcode,
            f             : forum_id,
            sbutton       : 'Submit New Thread',
        }
    );
}

/**
 * @summary Change thread metadata
 * @param {Object} data
 * @return {jQuery.Promise}
 * @example
 * bb.thread_edit({
 *     thread_id       : 123,
 *     title           : 'post title',
 *     notes           : 'edit notes'
 *     prefix_id       : 1, // optional: default: no prefix
 *     close_thread    : true, // optional, default: leave in current state
 *     unapprove_thread: true // optional, default: do not close
 * });
 */
VBulletin.prototype.thread_edit = function( data ) {
    return this.post( '/postings.php?do=updatethread&t=' + data.thread_id, {
        do      : 'updatethread',
        title   : data.title || document.title,
        notes   : data.notes,
        prefixid: data.prefix_id,
        visible : data.unapprove_thread ? 'no' : 'yes',
        open    : (
            ( typeof(data.close_thread) === 'undefined' ) ? undefined :
                     data.close_thread                    ? ''        :
                                                            'yes'
        )
    });
}

/**
 * @summary Merge a set of threads together
 * @param {Object} data
 * @return {jQuery.Promise}
 *
 * @example
 * bb.thread_merge({
 *     forum_id  : 12,
 *     thread_ids: [ 123, 234, 345 ],
 *     url       : '/foo.php' // optional, default: post with AJAX to avoid page load
 * });
 */
VBulletin.prototype.thread_merge = function( data ) {
    return this.post(
        '/inlinemod.php?do=domergethreads&threadids=' + data.thread_ids.join(),
        {
            do           : 'domergethreads',
            destthreadid : data.thread_ids.sort( function(a, b) { return a-b } )[0],
            threadids    : data.thread_ids.join(),
            destforumid  : data.forum_id,
            skipclearlist: 1,

            // add a redirect that expires after five days:
            redir: 1,
            redirect: 'expires',
            period: this.redirect_duration.period,
            frame : this.redirect_duration.frame,

            url: data.url
        },
        data.url
    );
}

/**
 * @summary Open or close a thread
 * @param {Number} thread_id ID of thread to open or close
 * @param {boolean} open whether the thread status should be set to "open" (instead of "closed")
 * @return {jQuery.Promise}
 *
 * @description
 * Note: this is guaranteed to perform the desired action,
 *       whereas thread_reply() suffers from race conditions
 */
VBulletin.prototype.thread_openclose = function( thread_id, open ) {
    return this.post( '/ajax.php?do=updatethreadopen&t=' + thread_id, {
        do  : 'updatethreadopen',
        t   : thread_id,
        open: open ? 'true' : 'false'
    });
}

/**
 * @summary Create a new reply in a thread (AJAX)
 * @param {Object} data
 * @return {jQuery.Promise}
 *
 * @example
 * bb.thread_reply({
 *     thread_id           : 123,
 *     title               : 'post title', // optional, default: no title
 *     bbcode              : 'post [i]body[/i]',
 *     flip_thread_openness: false,
 *     url                 : '/foo.php' // optional, default: post with AJAX to avoid page load
 * });
 *
 * @description
 * Note: 'flip_thread_openness' suffers from a race condition -
 *       when two people flip the state at the same time, it cancels out.
 *       See {@link thread_openclose} for a safer solution.
 */
VBulletin.prototype.thread_reply = function( data ) {
    return this.post(
        '/newreply.php?do=postreply&t=' + data.thread_id,
        {
            do            : 'postreply',
            title         : data.title,
            message       : data.bbcode,
            message_backup: data.bbcode,
            openclose     : data.flip_thread_openness ? 1 : 0,
            sbutton       : ( data.url ? undefined : 'Submit Reply' ),
            url           :   data.url,
            subscribe     : 1
        },
        data.url
    );
}

/**
 * @summary Get the list of posters in a thread
 * @param {Number} thread_id ID of thread to check
 * @return {jQuery.Promise}
 *
 * @description Note: this is quite inefficient for threads with over 2,500 posts
 */
VBulletin.prototype.thread_whoposted = function( thread_id ) {
    return $.get( '/misc.php?do=whoposted&t=' + thread_id ).then(function(html) {
        html = $(html);
        return {
            total: html.find('.stats.total dd').text(),
            users: html.find('.blockrow').map(function() {
                return {
                    user_id   : $('.username a', this).attr('href').split('?u=')[1],
                    username  : $('.username a', this).text(),
                    post_count: parseInt( $('.stats a', this).text(), 10 )
                }
            }).get()
        };
    });
}

/*
 * USER FUNCTIONS
 */

/**
 * @summary Ban a user
 * @param {string} user     name of user to ban
 * @param {string} reason   reason to show the user
 * @param {string} group_id set the user to this group
 * @return {jQuery.Promise}
 *
 * @example
 * bb.infraction_give({
 *     username: 'user name',
 *     group_id: 123, // set the user to this group
 *     reason  : 'reason to show user',
 *     period  : 'M', // Months, Days etc.
 *     expires : 3 // number of periods
 * });
 */
VBulletin.prototype.user_ban = function( data ) {
    return this.post( '/modcp/banning.php?do=dobanuser', {
        do         : 'dobanuser',
        username   : data.username,
        usergroupid: data.group_id,
        period     : ( data.period == 'PERMANENT' ? data.period : data.period + '_' + data.expires ),
        reason     : data.reason
    });
}

/**
 * @summary get parameters to pass to a "doips" request
 * @private
 * @return {jQuery.Promise}
 */
VBulletin.prototype._get_ips_data = function() {
    if ( ! this._ips_data )
        this._ips_data = $.get( '/modcp/user.php?do=doips' ).then(function(html) {
            html = $(html);
            return {
                do           : 'doips',
                adminhash    : html.find('input[name="adminhash"]'    ).val(),
                securitytoken: html.find('input[name="securitytoken"]').val()
            };
        });
    return this._ips_data
}

/**
 * @summary get IP addresses used by an account
 * @param {string} username user to check
 * @param {boolean} get_overlapping whether to also return the list of other accounts using those IPs
 * @return {jQuery.Promise}
 * @description
 * Note: "overlapping" users includes people that share the same
 * house, share an ISP which uses dynamic IP addresses, or just happen
 * to have used the same router one time.
 */
VBulletin.prototype.user_ips = function( username, get_overlapping ) {

    var bb = this;

    return this._get_ips_data().then(function(data) {
        return $.post( '/modcp/user.php?do=doips', $.extend( data, { username: username, depth: get_overlapping ? 2 : 1 } ) ).then(function(html) {
            html = $(html);
            var ret = {
                registration_ip: html.find('#cpform_table .alt1').eq(1).text(),
                used_ips       : html.find('#cpform_table td > ul > li' ).map(function() { var ip = $(this).children('a').first().text(); if ( ip != '127.0.0.1' ) return ip }),
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
    });

}

/**
 * @summary get accounts used by an IP address
 * @param {string} ip IP address to check
 * @return {jQuery.Promise}
 */
VBulletin.prototype.ip_users = function( ip ) {

    var bb = this;

    return this._get_ips_data().then(function(data) {

        return $.post( '/modcp/user.php?do=doips', $.extend( data, { ipaddress: ip, depth: 1 } ) ).then(function(html) {
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

    });

}


/**
 * @summary Add a note to a user's account
 * @param {string} user_id ID of note recepient
 * @param {string} title  message title
 * @param {string} bbcode message body
 * @return {jQuery.Promise}
 */
VBulletin.prototype.usernote_add = function( user_id, title, bbcode ) {
    return this.post(
        '/usernote.php?do=donote&u=' + user_id,
        {
            do            : 'donote',
            title         : title,
            message       : bbcode,
            message_backup: bbcode,
        }
    );
}

/**
 * @summary Get information about users from ModCP
 */
VBulletin.prototype.user_moderation_info = function(user_id) {

    return $.get( '/modcp/user.php?do=viewuser&u=' + user_id ).then(function(html) {
        html = $(html);

        var name = html.find( '[name="user\\[username\\]"]'  ).val();

        if ( !name.length ) return null; // user doesn't exist

        var image = html.find( 'img[src^="../image.php"]').attr( 'src' );

        return {
            name      : html.find( '[name="user\\[username\\]"]'  ).val(),
            user_id   : user_id,
            email     : html.find( '[name="user\\[email\\]"]'     ).val(),
            ip        : html.find( '[name="user\\[ipaddress\\]"]' ).val(),
            homepage  : html.find( '[name="user\\[homepage\\]"]'  ).val(),
            signature : html.find( '[name="signature"]'           ).val(),
            post_count: html.find( '[name="user\\[posts\\]"]'     ).val(),

            image     : ( image ? image.replace( /^\.\./, '' ) : null ),

            pm_notification: (
                ( html.find('input[id^="rb_1_options\\[receivepm\\]"]').is(':checked') ) // receive PMs
                ? (
                    ( html.find('input[id^="rb_1_options\\[emailonpm\\]"]').is(':checked') // notification e-mail
                    ? (
                        ( html.find('input[id^="rb_1_user\\[pmpopup\\]"]').is(':checked') ) // notification popup
                        ? [ 'popup', 'e-mail' ] // will receive a popup and an e-mail
                        : [          'e-mail' ] // will receive an e-mail
                    )
                    : ( html.find('input[id^="rb_1_user\\[pmpopup\\]"]').is(':checked') ) // notification popup
                        ? [ 'popup'           ] // will receive a popup
                        : [                   ] // will receive messages, but won't receive notification
                    )
                )
                :         null                  // cannot receive messages
            )
        };
    });

}

/**
 * @summary Get new users
 */
VBulletin.prototype.users_list_new = function() {

    return $.get( '/memberlist.php?order=desc&sort=joindate&pp=100' ).then(function(html) {
        return $(html).find('#memberlist_table tr:not(.columnsort) a.username').map(function() {
            var $this = $(this);
            return {
                name       : $this.text(),
                user_id    : parseInt( $this.attr('href').split('?u=')[1], 10 ),
                member_page: $this.attr('href')
            };
        }).get();
    });

}

/*
 * MISCELLANEOUS
 */

/**
 * @summary Ban a spambot and delete all their posts as spam
 * @param {Number} user_ID ID of the user to ban
 * @param {Number} post_ID ID of the post that made you realise this was a spambot
 * @return {jQuery.Promise}
 */
VBulletin.prototype.spammer_delete = function( user_id, post_id ) {
    return this.post(
        '/inlinemod.php?do=dodeletespam',
        {
            do             : 'dodeletespam',
	    'userid[]'     : user_id,
	    usergroupid    : 22,
	    period         : 'PERMANENT',
	    reason         : 'Spambot',
	    sbutton        : 'Ban User',
	    p              : post_id,
	    postids        : post_id,
	    useraction     : 'ban',
	    deleteother    : 1,
	    deletetype     : 1,
	    deletereason   : 'Spambot',
	    keepattachments: 0,
	    report         : 1,
	    type           : 'post'
        }
    );
}

/**
 * @summary Get information about threads from the first page of a forum
 * @see {thread_posts}
 *
 * @param {number} forum_id ID of forum to get threads for
 * @return {jQuery.Promise} Deferred object that will return when all pages have loaded
 */
VBulletin.prototype.forum_threads = function(forum_id) {

    var bb = this;

    return $.get( '/forumdisplay.php?f=' + forum_id ).then(function(html) {

        var is_moderator = html.search( '<script type="text/javascript" src="clientscript/vbulletin_inlinemod.js?' ) != -1;

        var today = new Date(), yesterday = new Date();
        yesterday.setDate(yesterday.getDate()-1);
        today     = [ today    .getDate().toString().replace(/^(.)$/,"0$1"), (today    .getMonth()+1).toString().replace(/^(.)$/,"0$1"), today    .getYear()+1900 ].join( '/' );
        yesterday = [ yesterday.getDate().toString().replace(/^(.)$/,"0$1"), (yesterday.getMonth()+1).toString().replace(/^(.)$/,"0$1"), yesterday.getYear()+1900 ].join( '/' );

        if ( is_moderator && !this._forum_threads_callback_initialised++ ) {
            $(document).on( 'dblclick', '.bb_api_threadstatus', function() {
                var threadbit = $(this).closest('.threadbit');
                bb.thread_openclose( $(this).data( 'thread_id' ), threadbit.hasClass('lock') )
                    .done(function() { threadbit.toggleClass('lock') });
            });
        }

        return $(html).find('li.threadbit').map(function() {
            var title = $('a.title', this);
            var thread_id = title.attr('href').split( '?t=' )[1];

            if ( is_moderator ) {
                $('.threadstatus', this)
                    .addClass( 'bb_api_threadstatus' )
                    .data( 'thread_id', thread_id )
                    .css({ cursor: 'pointer' })
                    .attr( 'title', 'double-click to close this thread' )
            }

            var understate_text = $.trim($('.prefix.understate', this).text());
            var status = 'open';
            if      ( understate_text.search( /^Closed:/ ) == 0 ) status = 'closed';
            else if ( understate_text.search( /^Moved:/  ) == 0 ) status = 'moved';
            else if ( $( '.prefix_closed' , this ).length ) status = 'closed'
            else if ( $( '.prefix_deleted', this ).length ) status = 'deleted'
            ;

            var ret = {
                container_element: this,
                forum_id         : forum_id,
                thread_id        : thread_id,
                orig_thread_id   : this.id.substr(7), // for moved threads
                title_element    : title,
                title            : title.text(),
                status           : status,
                is_sticky        : $('div.sticky', this).length ? true : false
            };
            if ( status != 'moved' ) {
                ret = $.extend( ret, {
                    last_post_id : parseInt( $( 'a.lastpostdate', this ).attr('href').split('#post')[1] ),
                    reply_count  : parseInt( $('.threadstats a', this).text(), 10 ),
                    last_modified: $.trim($('a.lastpostdate', this).parent().text().replace('Today',today).replace('Yesterday',yesterday))
                });
            }
            return ret;
        }).get();

    });

}

/**
 * @summary add CSS for different page types to the current page
 * @param {Array.<string>} page_types types of page to add CSS for
 *
 * @description Sometimes we want to insert content that resembles one
 * page on a different type of page (e.g the dashboard uses content
 * from several pages).  As vBulletin uses different CSS on different
 * pages, we need to include the extra files by hand.
 */
VBulletin.prototype.css_add = function(page_types) {

    var sheet_names = {
         forum_show: 'threadlist.css',
          user_show: 'member.css',
        thread_show: 'postbit.css'
    };

    var extra_types = [];
    page_types.forEach(function(page_type) {
        if ( sheet_names.hasOwnProperty(page_type) ) extra_types.push(sheet_names[page_type])
    });

    if ( extra_types.length ) {
        var stylesheet = $('link[rel="stylesheet"][type="text/css"]').first();
        stylesheet
            .clone()
            .attr( 'href', stylesheet.attr( 'href' ).replace( /([?&]sheet)=[^&]*/, '$1=' + extra_types.join() ) )
            .insertBefore(stylesheet)
        ;
        // Fix conflicts created by adding the above CSS:
        $("head").append(
            "<style type='text/css'>" +
                '#above_postlist { top: 0 }' +
                '.threadbit.attachments { padding: 0 }' +
            "</style>"
        );
    }

}

/**
 * @summary Get posts in the moderation queue
 * @return {jQuery.Promise}
 */
VBulletin.prototype.posts_moderated = function() {

    return $.get( '/modcp/moderate.php?do=posts' ).then(function(html) {
        html = $(html);
        var ret = {
            threads: [],
            posts  : [],
        };
        var current_block, current;
        function parse_row() {
            $( 'a[href^="user.php"]', this ).each(function() { // User who created a post (first row of a block)
                current_block.push(current = {
                    user_id  : this.href.split('&u=')[1],
                    user_name: $(this).text()
                });
            });
            $( 'a[href^="../showthread.php"]', this ).each(function() { // Thread (in post block)
                current.thread_id    = this.href.split('?t=')[1];
                current.thread_title = $(this).text();
            });
            $( 'a[href^="../forumdisplay.php"]', this ).each(function() { // Forum
                current.forum_id   = this.href.split('?f=')[1];
                current.forum_name = $(this).text();
            });
            $( '[name^="threadtitle"]', this ).each(function() { // Title (in thread block)
                current.thread_id    = this.name.split(/[\[\]]/)[1];
                current.thread_title = $(this).val();
            });
            $( '[name^="posttitle"]', this ).each(function() { // Title (in post block)
                current.post_id    = this.name.split(/[\[\]]/)[1];
                current.post_title = $(this).text();
            });
            $( '[name^="threadpagetext"],[name^="postpagetext"]', this ).each(function() { // Body
                current.bbcode = $(this).val();
            });
            $( '[name^="threadnotes"]', this ).each(function() { // Thread notes (in thread block)
                current.notes = $(this).val();
            });
        }
        current_block = ret.threads; html.find('#threads tr').each(parse_row);
        current_block = ret.posts  ; html.find('#posts tr'  ).each(parse_row);

        return ret;
    });

}

/**
 * @summary log in to ModCP and get a URL
 * @param {jQuery} iframe iframe element to use
 * @param {string} url URL to get
 * @param {string=} page_top_selector selector that indicates the top of the final page (default: '#cpform')
 * @param {string=} page_bottom_selector selector that indicates the bottom of the final page (default: '.copyright')
 * @param {jQuery.Promise}
 *
 * @description
 * ModCP authentication is unrelated to normal site authentication,
 * and it's easy to get logged out of one but stay in the other.
 * This function pops up an iframe with login details if necessary.
 */
VBulletin.prototype.moderation_page = function( iframe, url, page_top_selector, page_bottom_selector ) {

    var dfd = new jQuery.Deferred();
    var title = document.title; // iframes tend to overwrite the document title

    iframe
        .css({ overflow: 'hidden', display: 'none' })
        .attr( 'src', url )
        .one( 'load', function() {
            document.title = title;
            if ( $('#vb_login_username', iframe[0].contentDocument.body ).length ) { // need to log in
                $(iframe[0].contentDocument.body).css({ overflow: 'hidden' }).find('p').remove();
                iframe.css({ display: 'block', width: '450px', height: '200px' }); // set the desired size
                var form = $(iframe[0].contentDocument.body).find('form');
                iframe.css({ width: form.outerWidth() + 'px', height: form.outerHeight() + 'px' }); // fit based on the computed size
                var has_progressed = false;
                var interval = setInterval(function() {
                    if ( $('#vb_login_username', iframe[0].contentDocument.body ).length ) {
                        // still on the login page
                    } else if ( $('#redirect_button,#vb_login_username,.standard_error', iframe[0].contentDocument.body).length && !has_progressed ) {
                        // on the redirect page
                        has_progressed = true;
                        iframe.hide();
                        dfd.notify();
                    } else if ( $( page_top_selector || '#cpform', iframe[0].contentDocument.body ).length ) {
                        // on the user page
                        iframe.hide();
                        clearInterval(interval);
                        if ( !has_progressed ) dfd.notify();
                        document.title = title;
                        interval = setInterval(function() {
                            if ( $( page_bottom_selector || '.copyright', iframe[0].contentDocument.body ).length ) {
                                dfd.resolve(iframe[0]);
                                clearInterval(interval);
                            }
                        }, 50);
                    } // else page is loading
                }, 50);
            } else { // already logged in
                dfd.notify();
                document.title = title;
                dfd.resolve(iframe[0]);
                return;
            }
        });

    return dfd.promise();

}
