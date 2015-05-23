/**
 * @file Bulletin Board API
 * @author Andrew Sayers
 */

/**
 * @summary Generic class for any type of bulletin board
 * @constructor
 * @abstract
 *
 * @example
 * var bb = new ChildOfBulletinBoard({
 *     config: { ... },
 *     origin: 'http://www.example.com', // default: current site
 *     doc: my_document // default: document
 * });
 *
 * @description At the time of writing, the only configuration values are:
 * + "unPMable user groups" (an array like [ 'group name', ... ] defining groups that cannot accept PMs)
 * + "default user group" (a string defining the group most users belong to)
 */
function BulletinBoard(args) {
    this._config = $.extend( { 'unPMable user groups': [], 'default user group': '' }, args ? args.config : {} );
    this._origin = args ? args.origin : '';
    this.url_for = {};
    this.doc = $( ( args || {} ).doc || document );
}
BulletinBoard.prototype = Object.create(null, {

    _config: { writable: true, configurable: false },
    _origin: { writable: true, configurable: false },
    doc    : { writable: true, configurable: false },
    // construct product-specific URLs - concrete implementations should add functions here
    url_for: { writable: true, configurable: false },

    // number of replies per page (not counting the first post on forums that treat the first post specially):
    default_reply_count: { writable: false, configurable: false, value: 200 },

});

/*
 * GENERIC UTILITY FUNCTIONS
 */

/**
 * @summary convert a relative URL to use the correct origin
 * @param {string} url URL to translate
 * @return {string} absolute URL
 * @description BulletinBoards can have an origin other than the site we're currently on
 * (so we can e.g. browse as one user and post as another)
 */
BulletinBoard.prototype.fix_url = function(url) {
    if ( !this._origin ) return url;
    if ( url.search( /^[a-z]*:/ ) == 0 ) return                 url;   // http://www.example.com/foo.html
    if ( url.search( /^\// )      == 0 ) return this._origin +  url;   // /foo.html
    return this._origin + location.pathname.replace( /[^\/]*$/, url ); // foo.html
}

/**
 * @summary add or change configuration values
 * @param {Object} config new configuration values
 * @return (updated) configuration
 */
BulletinBoard.prototype.config = function( config ) {
    return $.extend( this._config, config );
}

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
    return this.fix_url(url);
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
 * @summary Connect to the server and get some very basic information
 * @protected
 * @param {...Object} var_args passed to $.get()
 * @return {jQuery.Promise}
 * @description the return value contains 'results ('success' or 'fail'),
 * 'duration' (milliseconds taken for the round trip), and 'offset'
 * (number of milliseconds the server is ahead of the client,
 * which can be negative)
 */
BulletinBoard.prototype.ping = function() {

    var start_time = new Date();

    function success(html, status, jqXHR) {
        var end_time = new Date().getTime();
        return {
            result  : 'success',
            duration:                                                                       end_time - start_time.getTime(),
            // calculate the time offset between us and the server, assuming the server time was generated exactly halfway through the request:
            offset  : new Date( jqXHR.getResponseHeader('Date') ).getTime() - Math.floor( ( end_time + start_time.getTime() ) / 2 )
        };
    }

    // the actual page isn't important, but robots.txt seems like an innocuous enough choice:
    return $.ajax({
        url : this.fix_url( '/robots.txt' ),
        xhr : function() { return new BabelExt.XMLHttpRequest() },
        type: 'OPTIONS'
    }).then( success, function(jqXHR) {
        var dfd = jQuery.Deferred();
        if ( jqXHR.statusCode() == 404 ) {
            dfd.resolve(success(null,null,jqXHR));
        } else {
            dfd.resolve({ result: 'fail', duration: new Date().getTime() - start_time.getTime() });
        }
        return dfd.promise();
    });

}

/**
 * @summary Send a message to the server as an AJAX request
 * @protected
 * @param {string} url  URL to get
 * @param {Object} data parameters
 * @return {jQuery.Promise}
 */
BulletinBoard.prototype.get = function( url, data ) {

    var bb = this;

    return $.ajax({
        url : this.fix_url(url),
        xhr : function() { return new BabelExt.XMLHttpRequest() },
        type: 'GET',
        data: data
    }).then(
        function(reply) {
            var err = bb.detect_post_error( reply );
            if ( err !== null ) {
                debug_log.log( "Couldn't load page", err );
                var dfd = new jQuery.Deferred();
                dfd.reject();
                return dfd;
            } else {
                return reply;
            }
        },
        debug_log.log
    );

}

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

    var url = this.fix_url(url);

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
                url : url,
                xhr : function() { return new BabelExt.XMLHttpRequest() },
                data: data
            }).then(
                function(reply) {
                    var err = bb.detect_post_error( reply );
                    if ( err !== null ) {
                        debug_log.log( "Couldn't load page", err );
                        alert( "Couldn't load page " + url + "\n\nError:\n" + err );
                        var dfd = new jQuery.Deferred();
                        dfd.reject(err);
                        return dfd;
                    } else {
                        return reply;
                    }
                },
                debug_log.log
            );
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
 * @return {Array.<number>} current and maximum page numbers, number of posts on the page
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
 * @return {Array.<Object>} list of hashes describing each post
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
    var ret = [], regex = /\[quote="?([^\n=";\]]+)(?:;([^\n=";\]]*))?"?\]|\[\/quote\]/gi, start=0, depth=0, author, post_id, result;
    while ( (result = regex.exec(text)) ) {
        if ( result[0].toLowerCase() == '[/quote]' ) {
            if ( !--depth ) ret.push( { author: author, post_id: parseInt( post_id, 10 ), text: text.substr( start, result.index - start ) } );
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
 * @param {boolean} skip_images convert all images to <img> - significantly improves performance
 * @return {jQuery.Promise} Deferred object that will return when all pages have loaded
 */
BulletinBoard.prototype.thread_posts = function( thread_id, first_page, skip_images ) {

    var bb = this;

    function get_later_pages(html) {
        if ( typeof(html) == 'string' ) {
            if ( skip_images ) html = html.replace(/<img[^>]*>/ig, '<img>');
            html = $(html);
        }

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
                bb.get(bb.url_for.thread_show({ thread_id: thread_id, page_no: n }))
                    .then(function(html) {
                        if ( skip_images ) html = html.replace(/<img[^>]*>/ig, '<img>');
                        return bb.process_posts(bb.get_posts(html));
                    })
            );

        if ( more_pages.length ) {
            return bb.when(more_pages).then(
                function(more_posts) { more_posts.unshift(posts); return Array.concat.apply( [], more_posts ) },
                function(          ) { return 'Failed to load some later pages in ' + bb.url_for.thread_show({ thread_id: thread_id }) }
            );
        } else {
            var dfd = new jQuery.Deferred();
            dfd.resolve( posts );
            return dfd.promise();
        }
    }

    if ( first_page ) {

        if ( typeof(first_page) == 'string' ) {
            if ( skip_images ) first_page = first_page.replace(/<img[^>]*>/ig, '<img>');
            first_page = $(first_page);
        }

        var pages = bb.get_pages(first_page);
        if ( pages.current == pages.total ) {
            return new $.Deferred()
                .resolve( bb.process_posts(bb.get_posts(first_page)) )
                .promise()
            ;
        } else if ( pages.replies_on_page == this.default_reply_count )
            return get_later_pages(first_page);
        else {

            var first_post_index = (pages.current-1) * pages.replies_on_page;

            var current_page = Math.ceil( pages.current * pages.replies_on_page / this.default_reply_count );
            var   final_page = Math.ceil( pages.total   * pages.replies_on_page / this.default_reply_count );

            // number of posts to trim from the first downloaded page, to make it look as if we started loading on this page:
            var offset = ( pages.replies_on_page * (pages.current-1) ) - ( this.default_reply_count * (current_page-1) );
            var pages = [
                bb.get(bb.url_for.thread_show({ thread_id: thread_id, page_no: current_page }))
                    .then(function(html) {
                        if ( skip_images ) html = html.replace(/<img[^>]*>/ig, '<img>');
                        var posts = bb.process_posts(bb.get_posts(html));
                        posts.splice(0, offset);
                        return posts;
                    })
            ];

            for ( var n=current_page+1; n<=final_page; ++n )
                pages.push(
                    bb.get(bb.url_for.thread_show({ thread_id: thread_id, page_no: n }))
                        .then(function(html) {
                            if ( skip_images ) html = html.replace(/<img[^>]*>/ig, '<img>');
                            return bb.process_posts(bb.get_posts(html));
                        })
                );

            return bb.when(pages).then(
                function(posts) { return Array.concat.apply( [], posts ) },
                function(     ) { return 'Failed to load some pages in ' + bb.url_for.thread_show({ thread_id: thread_id }) }
            );
        }

    } else {

        return this.get( bb.url_for.thread_show({ thread_id: thread_id }) )
            .then(get_later_pages, function() {
                debug_log.log('Failed to load thread ' + bb.url_for.thread_show({ thread_id: thread_id }));
                return $.Deferred()
                    .reject('Failed to load thread ' + bb.url_for.thread_show({ thread_id: thread_id }) )
                    .promise()
                ;
            });

    }

}

/**
 * @summary Escape an object in a way that's safe to put in a forum post
 * @param {string}   name   object name
 * @param {Object}   object object to stringify
 * @param {function} cmp    comparison function
 * @return {string} text to include in a post
 */
BulletinBoard.prototype.stringify = function(name, object, cmp) {
    return '[code]/* BEGIN DATA BLOCK: ' + name.toUpperCase() + ' */\n' + stringify( object, cmp ) + '\n/* END DATA BLOCK: ' + name.toUpperCase() + ' */[/code]'
}

BulletinBoard.prototype._parse = function(name, text, before, after) {
    var ret = null;
    text.replace(
        new RegExp( before + '/\\* BEGIN DATA BLOCK: ' + name.toUpperCase() + ' \\*/\\s*((?:.|\\n)*?)\\s*\\/\\* END DATA BLOCK: ' + name.toUpperCase() + ' \\*/' + after ),
        function( match, json ) { ret = JSON.parse(json) }
    );
    return ret;
}

/**
 * @summary Retrieve a string previously encoded with .stringify()
 * @param {string} name object name
 * @param {string} text post text
 * @return {Object} parsed object
 */
BulletinBoard.prototype.parse = function(name, text) {
    return this._parse( name, text, '\\[code\\]', '\\[/code\\]' );
}

/**
 * @summary Retrieve a string previously encoded with .stringify()
 * @param {string} name object name
 * @param {Object} post post data returned from process_posts()
 * @return {Object} parsed object
 */
BulletinBoard.prototype.parse_post = function(name, post) {/*
    var bb = this;
    return post.message_element.find( '...').get().reduce(function(prev,post) { return bb._parse( name, post.textContent, '^', '$' ) || prev });
*/}




/**
 * @summary vBulletin API
 * @extends BulletinBoard
 * @constructor
 */
function VBulletin(args) {
    BulletinBoard.call(this, args);

    var bb = this;

    if ( bb.session_id ) {
        setInterval(
            function() {
                // can't reset the token without cookies - just ping the page and hope for the best
                bb.get( '/' ).then(function() {
                    BabelExt.memoryStorage.set( 'VBulletin login ' + bb._origin + ' ' + bb.default_user, JSON.stringify({
                        creation_time : new Date().getTime(),
                        session_id    : bb.session_id,
                        security_token: bb.security_token
                    }))
                });
            }, 1000*60*30 );
    } else {
        var securitytoken = '';
        $(function() { securitytoken = bb._get_token() });
        setInterval(
            function() {

                if ( bb._origin ) {

                    BabelExt.memoryStorage.get( 'VBulletin login ' + bb._origin + ' ' + bb.default_user, function(data) {
                        if ( data.value ) {
                            var credentials = JSON.parse(data.value);
                            if ( credentials.creation_time + 60*60*1000 > new Date().getTime() ) {
                                bb.session_id     = credentials.session_id;
                                bb.security_token = credentials.security_token;
                                if ( credentials.creation_time + 20*60*1000 < new Date().getTime() ) {
                                    return bb.post( '/ajax.php?do=securitytoken', { do: 'securitytoken' } ).then(function(xml) {
                                        BabelExt.memoryStorage.set( 'VBulletin login ' + bb._origin + ' ' + bb.default_user, JSON.stringify({
                                            creation_time : new Date().getTime(),
                                            security_token: bb.security_token
                                        }));
                                    });
                                }
                            }
                        }
                    });

                } else if ( bb._get_token() == securitytoken ) { // skip this if the token was already updated

                    return bb.post( '/ajax.php?do=securitytoken', { do: 'securitytoken' } ).then(function(xml) {
                        securitytoken = xml.getElementsByTagName('securitytoken')[0].textContent;
                        $('input[name="securitytoken"]').val(securitytoken);
                    });

                }
            },
            1000*60*30 // every 30 minutes
        );
    }

    $.extend(
        this.url_for,
        {
            activity: function() { return bb.build_url( '/activity.php' ) },

            forum_show: function(args) { return bb.build_url(
                '/forumdisplay.php',
                [
                    { key: 'forum_id', param: 'f' }
                ],
                args
            )},

            login: function() { return bb.build_url(
                '/login.php',
                [
                    { key: 'do', param: 'do', default: 'login' }
                ]
            )},

            folder_show: function(args) { return bb.build_url(
                '/private.php',
                [
                    { key: 'folder_id', param: 'folderid' },
                ],
                args
            )},

            moderation_inline: function() { return bb.build_url( '/inlinemod.php' ) },
            moderation_posts : function() { return bb.build_url( '/modcp/moderate.php?do=posts' ) },
            moderation_user  : function() { return bb.build_url( '/modcp/user.php' ) },

            // This is a fake URL - you will need to call redirect_modcp_ipsearch() on the page:
            moderation_ipsearch: function(args) { return bb.build_url(
                '/modcp/user.php',
                [
                    { key: 'action'    , param: 'do', default: 'doips' },
                    { key: 'ip_address', param: 'ipaddress' },
                    { key: 'username'  , param: 'username' },
                    { key: 'user_id'   , param: 'userid' },
                    { key: 'depth'     , param: 'depth' }
                ],
                args
            )},

            infraction: function(args) { return bb.build_url(
                '/infraction.php',
                [
                    { key: 'user_id', param: 'u' },
                    { key: 'post_id', param: 'p' },
                    { key: 'action' , param: 'do', 'default': 'view' },
                ],
                args
            )},

            user_notes: function(args) { return bb.build_url(
                '/usernote.php',
                [
                    { key: 'user_id', param: 'u' }
                ],
                args
            )},

            user_show: function(args) { return bb.build_url(
                '/member.php',
                [
                    { key: 'user_id', param: 'u' }
                ],
                args
            )},

            users_show: function(args) { return bb.build_url(
                '/memberlist.php',
                [
                    { key: 'order'   , param: 'order', 'default': 'desc' },
                    { key: 'sort'    , param: 'sort' , 'default': 'joindate' },
                    { key: 'per_page', param: 'pp'   , 'default': '100' },
                    { key: 'page_no' , param: 'page' }
                ],
                args
            )},

            search: function() { return bb.build_url( '/search.php' ) },

            thread_edit: function(args) { return bb.build_url(
                '/postings.php',
                [
                    { key: 'action'   , param: 'do' },
                    { key: 'thread_id', param: 't' }
                ],
                args
            )},
            thread_show: function(args) { return bb.build_url(
                '/showthread.php',
                [
                    { key: 'thread_id'      , param: 't' },
                    { key: 'posts_per_page' , param: 'pp', default: VBulletin.prototype.default_reply_count },
                    { key: 'post_id'        , param: 'p' },
                    { key: 'page_no'        , param: 'page' },
                    { key: 'show_if_deleted', param: 'viewfull', map: { true: 1, false: '' } },
                    { key: 'goto'           , param: 'goto' }, // usually 'newpost'
                ],
                args,
                args.post_id ? 'post' + args.post_id : undefined // hash
            )},
            thread_user_posts: function(args) { return bb.build_url(
                '/search.php',
                [
                    { key: 'action'        , param: 'do', default: 'finduser' },
                    { key: 'content_type'  , param: 'contenttype', default: 'vBForum_Post' },
                    { key: 'posts_show'    , param: 'showposts', default: 1 },
                    { key: 'user_id'       , param: 'userid' },
                    { key: 'thread_id'     , param: 'searchthreadid' },
                    { key: 'posts_per_page', param: 'pp', default: VBulletin.prototype.default_reply_count },
                ],
                args
            )},

            post_edit: function() { return bb.build_url( '/editpost.php' ) },
            post_show: function(args) { return bb.build_url(
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
    );

}
VBulletin.prototype.constructor = VBulletin;
VBulletin.prototype = Object.create(BulletinBoard.prototype, {

    // only used if "origin" is set:
    default_user  : { writable: true, configurable: false },
    session_id    : { writable: true, configurable: false },
    security_token: { writable: true, configurable: false },

    default_reply_count: { writable: false, configurable: false, value: 200 },

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
    }

});

/*
 * UTILITY FUNCTIONS
 */

VBulletin.prototype.fix_url = function(url) {
    url = BulletinBoard.prototype.fix_url.call(this, url);
    if ( this.session_id )
        url += ( ( url.search(/\?/) == -1 ) ? '?s=' : '&s=' ) + this.session_id;
    return url;
}

VBulletin.prototype.get_posts = function(doc) { return $( doc || this.doc ).find('#posts').children().get() }

VBulletin.prototype.get_pages = function(doc) {
    doc = $( doc || this.doc );
    var ret = { current: 1, total: 1 };
    ( doc.find('.pagination a').first().text() || '' ).replace( /Page ([0-9]+) of ([0-9]+)/, function(match, current, total) {
        ret = { current: parseInt( current, 10 ), total: parseInt( total , 10 ) };
    });
    ret.replies_on_page = doc.find('#posts > li:not(.postbitdeleted)').length;
    return ret;
}

VBulletin.prototype.process_posts = function(posts) {
    // this is a surprisingly tight loop when downloading a large thread (up to 10,000 posts in quick succession),
    // so we mostly avoid jQuery and go straight to DOM accessors
    if ( !posts ) posts = this.get_posts();
    return posts.map(function(post) {

        var username = post.getElementsByClassName('username')[0];
        var title    = post.getElementsByClassName('title'  )[0];

        var ret = {

            container_element: post,
            post_id          : parseInt( post.id.substr(5), 10 ),

            date             : post.getElementsByClassName('date')[0].textContent,

            title            : title ? title.textContent.replace(/^\s*/, '').replace(/\s*$/, '') : '',

            username         : username.textContent,
            user_id          : parseInt( ( username.getAttribute('href') || '             guest' ).substr(13), 10 ),

            is_deleted       : post.className.search( /\bpostbitdeleted\b/ ) != -1,
            is_moderated     : !!post.getElementsByClassName('moderated').length,
            is_ignored       : post.className.search( /\bpostbitignored\b/ ) != -1

        };

        if ( !ret.is_ignored && !ret.is_deleted ) {

            var content    = post.getElementsByClassName('content')[0];
            var ip_element = post.getElementsByClassName('ip'     )[0];

            $.extend(ret, {
                message        : content.textContent.replace(/^\s*/, '').replace(/\s*$/, ''),
                message_element: $(content),
                linking        : $(post.getElementsByClassName('postlinking')[0]),
                ip_element     : ip_element ? $(ip_element) : $('<div>'),
                report_element : $(post.getElementsByClassName('report')[0]),
                ip             : ip_element ? ip_element.textContent.replace(/^\s*/, '').replace(/\s*$/, '') : '',
            },
            ret.is_moderated ? {} : {
                post_no        : parseInt( post.getElementsByClassName('iepostcounter')[0].textContent.substr(1), 10 ),
            });

            var edited = post.getElementsByClassName('lastedited');
            if ( edited.length ) {
                var a = $('a[href]', edited[0]);
                ret.edit_username = a.text().substr(15);
                ret.edit_user_id  = parseInt( a.attr('href').split('?p=')[1], 10 );
                edited[0].textContent.replace( /; ([^;]*?)\.\s*Reason:\s*(.*?)\s*$/, function(match, time, reason) {
                    ret.edit_time = time;
                    ret.edit_reason = reason;
                });
            }

        }

        return ret;

    });
}

VBulletin.prototype._get_token = function() {
    if ( this._origin ) {
        return this.security_token || 'guest';
    } else {
        var token = this.security_token || $('input[name="securitytoken"]').val();
        if ( token ) return token;
        BabelExt.utils.runInEmbeddedPage( 'document.head.setAttribute("data-securitytoken", SECURITYTOKEN );' );
        var token = document.head.getAttribute('data-securitytoken');
        document.head.removeAttribute('data-securitytoken');
        return token;
    }
}

VBulletin.prototype._add_standard_data = function(data) {

    var dfd = new jQuery.Deferred();

    data = $.extend( data, this.standard_post_data );

    if ( !data.url ) {
        data.url = 'images/misc/navbit-home.png'; // redirect POST requests to a quick-to-load page
        data.ajax = 1; // some URLs will serve a lightweight page if passed this
    }

    if ( data.securitytoken = this._get_token() ) {
        dfd.resolve(data);
    } else {
        var bb = this;
        $(function() {
            if ( data.securitytoken = bb._get_token() ) {
                dfd.resolve(data);
            } else {
                debug_log.log("Fatal: could not get securitytoken");
                dfd.reject();
            }
        });
    }

    return dfd.promise();
}

VBulletin.prototype.detect_post_error = function(reply) {
    if ( reply.getElementsByTagName && reply.getElementsByTagName('error').length ) // XML response
        return reply.getElementsByTagName('error')[0].textContent
    else if ( reply.search && !reply.search(/^\s*</) ) { // looks like HTML
        if (  reply.search(' class="standard_error"') != -1 ) { // HTML error
            var this_script = '';
            reply.replace( /var THIS_SCRIPT = "([^"]+)";/, function(match,_this_script) { this_script = _this_script });
            reply.replace( /<body([^]*<\/)body>/, function(body, body_innerHTML) { reply = $('<div'+body_innerHTML+'div>') });
            var noscript = reply.find( 'noscript' );
            if ( noscript.length && (
                noscript.html().search( /http-equiv="refresh"/i ) == -1 || // Automatic page refreshes generally indicate success, even when the success message has class="standard_error"
                this_script == "newthread" // automatic page refreshes during thread creation *do not* indicate success
            ))
                return $.trim(reply.find('.standard_error').text());
            else
                return null;
        } else if ( reply.search && reply.search( / class="[^"]*\b(?:blockrow\b[^"]*\berror\b|error\b[^"]*\bblockrow\b)[^>*]>(?!(?:&nbsp;)?<\/div>)/ ) != -1 ) {
            return $.trim( $(reply).find( '.blockrow.error' ).text() );
        } else {
            return null;
        }
    } else {
        return null;
    }
}

VBulletin.prototype.parse_post = function(name, post) {
    var bb = this;
    return post.message_element.find( '.bbcode_code').get()
        .reduce(function(prev,post) { return bb._parse( name, post.textContent, '^', '$' ) || prev }, null);
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
    var bb = this;
    return this.when(Object.keys(requests).map(function(key) { return bb.post( '/newattachment.php', requests[key] ) }));
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
 *     ban_reason         : 'reason to show the user if the infraction triggers a ban',
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
        banreason        : data.ban_reason,
        message          : data.bbcode,
        message_backup   : data.bbcode,
        infractionlevelid: data.infraction_id,
        savecopy         : 1,
        sbutton          : 'Give Infraction',
        p                : data.post_id,
        u                : data.user_id,
    };
    if ( data.is_warning ) post_data['warning['+data.infraction_id+']'] = 1;
    return this.post( '/infraction.php?do=update', post_data );
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

    return this.get( this.url_for.infraction({ action: 'report', user_id: user_id || 37 }) ).then(function(html) {
        return $(html).find('input[name="infractionlevelid"]').map(function() {
            if ( $(this).val() != '0' ) {
                var name = $.trim($(this).parent().text());
                return {
                    name  : name,
                    id    : parseInt( $(this).val(), 10 ),
                    points: parseInt( $(this).closest('td').next().text(), 10 )
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
            var post_id = $(mutation.target).closest('li').attr('id') || $(mutation.target).children('li').attr('id');
            if ( !post_id ) return;
            post_id = parseInt( post_id.substr(5), 10 );
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

    post.attr( 'id', 'post_0' );
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
 * @param {Object} data
 * @return {jQuery.Promise}
 *
 * @example
 * bb.post_edit({
 *     post_id: 123,
 *     bbcode : 'post [i]body[/i]',
 *     reason : 'reason for change', // optional, default: keep old reason
 * });
 */
VBulletin.prototype.post_edit = function( data ) {
    return this.post(
        '/editpost.php?do=updatepost&p=' + data.post_id,
        {
            do            : 'updatepost',
            p             : data.post_id,
            reason        : data.reason,
            //title         : data.title, // doesn't work - VBulletin is more reluctant to set this than I can be bothered to test
            message       : data.bbcode,
            message_backup: data.bbcode
        }
    );
}

/**
 * @summary Get information about a post (vBCode and attachment info)
 * @param {Number} post_ID ID of post to retrieve
 * @return {jQuery.Promise}
 */
VBulletin.prototype.post_info = function( post_id ) {

    var bb = this;

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

        return bb.get( '/newattachment.php', {
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
 * @summary Get summary text for a post returned by process_posts()
 * @param {Object} post post to summarise
 * @return {string} short summary
 */
VBulletin.prototype.post_summary = function( post ) {

    if ( post.title ) return post.title;

    var message = post.message_element.clone()
    message.find('.bbcode_container,.spoiler').remove();
    return $.trim(message.text())
        .replace( /\s+/g, ' ' )
        // if there are more than 15 words, truncate after the first 10:
        .replace( /^(\S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+) \S+ \S+ \S+ \S+ \S+ .*/, "$1\u2026" );

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

/**
 * @summary Get recent private messages in a folder
 * @param {Number} folder_id folder to download
 * @return {jQuery.Promise}
 */
VBulletin.prototype.folder_pms = function( folder_id ) {
    return this.get( '/private.php?folderid=' + folder_id ).then(function(html) {
        return $(html).find('.pmbit').map(function() {
            var $this = $(this);
            return {
                container_element: $this,
                pm_id    : parseInt( this.id.substr(3), 10 ),
                date     : $.trim($this.find( '.datetime' ).text()),
                user_id  : parseInt( $this.find('.username').attr('href').split('?u=')[1], 10 ),
                user_name: $this.find('.username').text(),
                title    : $this.find('.title').text()
            }
        }).get();
    });
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
 * @summary De-bump a thread
 * @param {Number} thread_ID ID of thread to de-bump
 * @return {jQuery.Promise}
 */
VBulletin.prototype.thread_debump = function(thread_id) {
    return this.post(
        '/postings.php',
        {
            do: 'vsa_makeolder',
            t : thread_id
        }
    );
}

/**
 * @summary suggest possible completions given a partial thread title
 * @param {string} substring partial thread title
 * @return {Array.<Object>} list of thread titles and IDs
 */
VBulletin.prototype.threads_complete = function(substring) {
    return this.post(
        '/search.php?do=process',
        {
            do: 'process',
            contenttypeid: 1,
            query: substring,
            titleonly: 1,
            showposts: 0,
            searchfromtype: 'vBForum:Post'
        }
    ).then(function(html) {
        return $(html).find( '.title' ).map(function() {
            return {
                thread_id: parseInt( this.id.split('_')[2], 10 ),
                title: $(this).text(),
                forum_id: parseInt( $(this).closest('li').find('.threadpostedin a').attr('href').split('?f=')[1], 10 )
            }
        }).get();
    });
}

/**
 * @summary list recent threads with at least one reply, sorted by reply count
 * @param {string} substring partial thread title
 * @return {Array.<Object>} list of thread titles and IDs
 */
VBulletin.prototype.threads_recent = function(substring) {
    return this.post(
        '/search.php?do=process',
        {
            do: 'process',
            beforeafter: 'after',
            childforums: 1,
            contenttypeid: 1,
            order: 'descending',
            replyless: 0,
            replylimit: 1,
            searchdate: 1,
            searchfromtype: 'vBForum:Post',
            showposts: 0,
            sortby: 'replycount'
        }
    ).then(function(html) {
        // if multiple pages, get all pages
        return $(html).find( '.title' ).map(function() {
            return {
                thread_id: parseInt( this.id.split('_')[2], 10 ),
                title: $(this).text(),
                forum_id: parseInt( $(this).closest('li').find('.threadpostedin a').attr('href').split('?f=')[0], 10 )
            }
        }).get();
    });
}

/**
 * @summary Create a new thread
 * @param {Object} data
 * @return {jQuery.Promise}
 * @example
 * bb.thread_create({
 *     forum_id: 12,
 *      icon_id: 1,
 *     prefix  : 'some_prefix',
 *     title   : 'thread title',
 *     bbcode  : 'thread bbcode'
 *     close_thread: true, // optional, default: thread is open
 *     stick_thread: true, // optional, default: thread is not sticky
 * });
 */
VBulletin.prototype.thread_create = function(data) {
    return this.post(
        '/newthread.php?do=postthread&f=' + data.forum_id,
        {
            do            : 'postthread',
            f             : data.forum_id,
            iconid        : data.icon_id,
            prefixid      : data.prefix_id,
            subject       : data.title,
            message_backup: data.bbcode,
            message       : data.bbcode,
            sbutton       : 'Submit New Thread',
            openclose     : data.close_thread ? 1 : undefined,
            stickunstick  : data.stick_thread ? 1 : undefined,
        }
    ).then(function(html) {
        return $(html).find( 'input[name="t"]' ).val();
    });
}

/**
 * @summary Delete thread
 * @param {Object} data
 * @return {jQuery.Promise}
 * @example
 * bb.thread_delete({
 *     thread_id: 123,
 *     reason   : 'reason for deletion',
 * });
 * @description this soft-deletes a post - physically removing posts is not supported
 */
VBulletin.prototype.thread_delete = function( data ) {
    return this.post( '/postings.php?do=dodeletethread&threadid=' + data.thread_id, {
        deletereason: data.reason,
        deletetype: 1, // soft delete
        do: 'dodeletethread',
        t: data.thread_id
    });
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
 *     close_thread    : true, // optional, default: open thread
 *     unapprove_thread: true, // optional, default: do not unapprove
 *     delete_thread   : true // optional, default: leave in current state
 *     delete_reason   : 'reason why thread was deleted',
 * });
 */
VBulletin.prototype.thread_edit = function( data ) {
    return this.post( '/postings.php?do=updatethread&t=' + data.thread_id, {
        do      : 'updatethread',
        title   : data.title,
        notes   : data.notes,
        prefixid: data.prefix_id,
        visible : data.unapprove_thread ? 'no' : 'yes',
        open    : (
            ( typeof(data.close_thread) === 'undefined' ) ? 'yes' :
                     data.close_thread                    ? ''    :
                                                            'yes'
        ),

        keepattachments: data.delete_thread ? 'yes'       : undefined,
        reason         : data.delete_thread ? data.reason : undefined,
        threadstatus   : (
            ( typeof(data.delete_thread) === 'undefined' ) ? undefined :
                     data.delete_thread                    ? 0         :
                                                             1
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
 * @summary Move a thread from one forum to another
 * @param {Object} data
 * @return {jQuery.Promise}
 *
 * @example
 * bb.thread_move({
 *     thread_id     : 123,
 *              title: 'new thread title',
 *     redirect_title: 'thread title for redirect',
 *     forum_id      : 12,
 *     redirect      : { period: 1, frame: 'w' }, // see parse_duration()
 *     url           : '/foo.php' // optional, default: post with AJAX to avoid page load
 * });
 */
VBulletin.prototype.thread_move = function( data ) {
    return this.post(
        '/postings.php?domovethread&t=' + data.thread_id,
        $.extend(
            data.redirect ? { enableredirect: 1, redirect: 'expires', period: data.redirect.period, frame: data.redirect.frame } : {},
            {
                do: 'domovethread',
                t: data.thread_id,
                destforumid: data.forum_id,
                redirecttitle: data.redirect_title || data.title,
                title: data.title,
                url: data.url
            }
        ),
        data.url
    );
}

/**
 * @summary Get metadata about a thread
 * @param {Number} thread_id
 * @return {jQuery.Promise}
 */
VBulletin.prototype.thread_metadata = function( thread_id ) {
    var bb = this;
    return this.get( '/postings.php?do=editthread&t=' + thread_id ).then(function(html) {
        html = $(html);
        return $.extend( bb._forum_thread_metadata(html), {
            title: html.find('#title').val(),

            notes: html.find('[name="notes"]').val(),

            valid  : !!html.find('#cb_open').length,
            open   :   html.find('#cb_open').is(':checked'),
            deleted: !!html.find('[name="threadstatus"]').length,
            merged : !!html.find('#rb_redirect_expires').length,

            sticky: html.find('#cb_sticky').is(':checked'),
            moderated: !html.find('#cb_visible').is(':checked'),

            delete_reason: html.find('[name="reason"]').val()

        });
    });
}

/**
 * @summary Get the title of a thread
 * @param {string|HTMLElement=} thread thread to get page for (default: current page)
 * @return string
 */
VBulletin.prototype.thread_title = function( thread ) {
    return $.trim( $(thread || this.doc).find( '.threadtitle').first().text() );
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
 * }).then(function(new_post_id) {
 *     ...
 * });
 *
 * @description
 * Note: 'flip_thread_openness' suffers from a race condition -
 *       when two people flip the state at the same time, it cancels out.
 *       See {@link thread_openclose} for a safer solution.
 */
VBulletin.prototype.thread_reply = function( data ) {
    var ret = this.post(
        '/newreply.php?do=postreply&t=' + data.thread_id,
        {
            do            : 'postreply',
            t             : data.thread_id,
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
    if ( data.url )
        return ret;
    else
        return ret.then(function(xml) {
            return xml.getElementsByTagName('postbit')[0].getAttribute('postid');
        });
}

/**
 * @summary Get the list of posters in a thread
 * @param {Number} thread_id ID of thread to check
 * @return {jQuery.Promise}
 *
 * @description Note: this is quite inefficient for threads with over 2,500 posts
 */
VBulletin.prototype.thread_whoposted = function( thread_id ) {
    return this.get( '/misc.php?do=whoposted&t=' + thread_id ).then(function(html) {
        html = $(html);
        return {
            total: html.find('.stats.total dd').text(),
            users: html.find('#whoposted .blockrow').map(function() { // '#whoposted' is needed on forums with debugging enabled
                return {
                    user_id   : parseInt( $('.username a', this).attr('href').split('?u=')[1], 10 ),
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
 * @summary actually get paramaters to pass to a ModCP request
 * @private
 * @return {Object}
 */
VBulletin.prototype._parse_modcp_data = function(html) {
    html = $(html);
    return {
        adminhash    : html.find('input[name="adminhash"]'    ).val(),
        securitytoken: html.find('input[name="securitytoken"]').val()
    };
}

/**
 * @summary get parameters to pass to a ModCP request
 * @private
 * @return {jQuery.Promise}
 */
VBulletin.prototype._get_modcp_data = function() {
    if ( ! this._modcp_data )
        this._modcp_data = this.get( '/modcp/user.php?do=doips' ).then(this._parse_modcp_data);
    return this._modcp_data;
}

/**
 * @summary get IP addresses used by an account
 * @param {Object} user user to check (must contain "username" or "user_id")
 * @param {boolean} get_overlapping whether to also return the list of other accounts using those IPs
 * @return {jQuery.Promise}
 * @description
 * Note: "overlapping" users includes people that share the same
 * house, share an ISP which uses dynamic IP addresses, or just happen
 * to have used the same router one time.
 */
VBulletin.prototype.user_ips = function( user, get_overlapping ) {

    var bb = this;

    return this._get_modcp_data().then(function(data) {
        // Note: this page accepts a "userid" parameter, even though there's no such input in the form:
        return bb.post( '/modcp/user.php?do=doips', $.extend( {}, data, { do: 'doips', username: user.username, userid: user.user_id, depth: get_overlapping ? 2 : 1 } ) ).then(function(html) {
            html = $(html);
            var ret = {
                registration_ip: html.find('#cpform_table .alt1').eq(1).text(),
                used_ips       : html.find('#cpform_table td > ul > li' ).map(function() { var ip = $(this).children('a').first().text(); if ( ip != '127.0.0.1' ) return ip }).get(),
                overlapping_users: {},
            }
            ret.unique_ip_count = ret.used_ip_count = ret.used_ips.length;
            var overlapping_ips = {};
            html.find( '#cpform_table ul ul > li' ).each(function() {
                var elements = $(this).children('a');
                var name     = elements.eq(0).text(),
                user_id  = parseInt( elements.eq(0).attr('href').split('&u=')[1], 10 ),
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

    return this._get_modcp_data().then(function(data) {

        return bb.post( '/modcp/user.php?do=doips', $.extend( {}, data, { do: 'doips', ipaddress: ip, depth: 1 } ) ).then(function(html) {
            html = $(html);
            var domain_name = html.find('#cpform_table .alt1 b').first().text();
            if ( domain_name == 'Could Not Resolve Hostname' ) domain_name = ip;
            var previous_users = {};
            return {
                ip: ip,
                domain_name: domain_name,
                users: html.find('#cpform_table li a b').parent().map(function() {
                    var user_id = parseInt( $(this).attr('href').split('&u=')[1], 10 );
                    if ( !previous_users.hasOwnProperty(user_id) ) {
                        previous_users[user_id] = 1;
                        return {
                            username: $(this).text(),
                            user_id: user_id
                        }
                    }
                }).get()
            };
        });

    });

}

/**
 * @summary get users that have used the same IP address
 * @param {string} username user to check
 * @return {jQuery.Promise}
 * @description
 * Note: This includes any use of the same address (registration or posting)
 */
VBulletin.prototype.user_overlapping = function( user ) {

    // VBulletin's "overlapping IP search" doesn't catch overlapping registration addresses,
    // so we have to do quite a lot of requests.

    var bb = this, users = {}, ret = [];

    return bb.user_ips(user).then(function(user_ips) {
        return $.when.apply( // Search for associated users
            $,
            [user_ips.registration_ip].concat(user_ips.used_ips).map(function(ip) {
                return bb.ip_users(ip).then(function(ip_users) {
                    ip_users.users.forEach(function(overlapping_user) {
                        if (
                            !( user.username && user.username == overlapping_user.username ) &&
                            !( user.user_id  && user.user_id  == overlapping_user.user_id  )
                        ) {
                            if ( !users.hasOwnProperty(overlapping_user.user_id) ) {
                                users[overlapping_user.user_id] = overlapping_user;
                                ret.push(overlapping_user);
                            }
                        }
                    });
                });
            })
        ).then(function() {
            return ret;
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
 * @summary Get information about a user note
 * @param {string} note_id ID of the note
 * @return {jQuery.Promise}
 */
VBulletin.prototype.usernote_info = function( note_id ) {
    return this.get( '/usernote.php?do=editnote&usernoteid=' + note_id ).then(function(html) {
        html = $(html);
        return {
            title : html.find('#titlefield').val(),
            bbcode: html.find('#vB_Editor_001_editor').val()
        }
    });
}

/**
 * @summary Change the contents of a user note
 * @param {string} note_id ID of the note
 * @param {string} title  message title
 * @param {string} bbcode message body
 * @return {jQuery.Promise}
 */
VBulletin.prototype.usernote_edit = function( note_id, title, bbcode ) {
    return this.post(
        '/usernote.php?do=donote&usernoteid=' + note_id,
        {
            do            : 'donote',
            title         : title,
            message       : bbcode,
            message_backup: bbcode,
        }
    );
}

/**
 * @summary Get information about the current user
 * @return {Object} username and user_id
 */
VBulletin.prototype.user_current = function() {
    var link = $('.welcomelink a');
    return (
        link.length
        ? { username: link.text(), user_id: link.attr('href').split('?u=')[1] }
        : null
    );
}

/**
 * @summary Get information about a user from their member page
 * @param {Number} user_id ID of user to gather information about
 * @return {jQuery.Promise}
 */
VBulletin.prototype.user_info = function(user_id) {
    var bb = this;
    return this.get('/member.php?u='+user_id+'&tab=infractions&pp=50').then(function(html) {
        html = $(html);

        var join_date = $.trim(html.find( '.userinfo dd' ).first().text());
        var title     = $.trim(html.find('#userinfo .usertitle').text());
        var username  = $.trim(html.find('.member_username').text());

        var ret = {
            joined: join_date,
            title : title,

            user_note_count: parseInt( html.find('a[href="usernote.php?u='+user_id+'"]').text().replace( /^(?:.*[^0-9])?\(([0-9]+)\).*/, "$1" ), 10 ),

            summary: '<a href="/member.php?u=' + user_id + '">' + $('<div/>').text(username).html() + '</a>',

            infraction_reasons: [],
            infraction_count  : 0,
            warning_count     : 0,
            infraction_points : 0,
            infraction_summary: '',

            join_summary: 'joined ' + $('<div/>').text(join_date).html() + ', ' + $('<div/>').text(title).html()
        };

        if ( html.find('.infractions_block').length ) {

            var infractions = html.find( '#infractionslist > li' ); // all infractions, even those expired or reversed

            var interesting_user_notes = ret.user_note_count - infractions.length;
            if ( interesting_user_notes > 0 ) {
                ret.infraction_summary += (
                    '<a href="/usernote.php?u='+user_id+'" title="' +
                    ( ( ret.user_note_count == 1 ) ? '1 user note' : ret.user_note_count + ' user notes'  ) +
                    '">' +
                    new Array( interesting_user_notes + 1 ).join( '&#x2669;' ) +
                    '</a>'
                );
            }

            html.find( '#infractions' ).text().replace( '[0-9]+', function( points ) { ret.infraction_points = points });

            infractions = infractions.filter(function() { return $('.inflistexpires',this).text().search(/Reversed/) == -1 });

            ret.infraction_reasons = infractions.map(function() { return $('.infraction_reason em', this).text() }).get();

            infractions = infractions.filter(function() { return $('.inflistexpires',this).text().search(/Expired/) == -1 });

            ret.infraction_count  = infractions.length;
            ret.warning_count     = infractions.has('img.inlineimg[src="images/misc/yellowcard_small.gif"]').length;
            ret.infraction_summary += (
                infractions.closest('li').map(function() {
                    var info = $(this).find('.inflistinfo');
                    var date = $(this).find('.inflistdate');
                    date.find('.postby').remove();
                    if ( info.find('a').length ) { // post-related infraction
                        return (
                            '<a href="'    + $('<div/>').text(info.find('a').attr('href')).html() +
                                '" title="'     + $('<div/>').text($.trim(date.text()) + ': ' + info.find('em').text()).html() +
                                '"><img src="/' + $('<div/>').text(info.find('img').attr('src')).html() +
                                '"></a>'
                        );
                    } else {
                        return (
                            '<span title="'     + $('<div/>').text($.trim(date.text()) + ': ' + info.find('em').text()).html() +
                                '"><img src="/' + $('<div/>').text(info.find('img').attr('src')).html() +
                                '"></span>'
                        );
                    }
                }).get().reverse().join('')
            );

        } else if ( ret.user_note_count ) {

            ret.infraction_summary += (
                '<a href="/usernote.php?u='+user_id+'" title="' +
                ( ( ret.user_note_count == 1 ) ? '1 user note' : ret.user_note_count + ' user notes'  ) +
                '">' +
                new Array( ret.user_note_count + 1 ).join( '&#x2669;' ) +
                '</a>'
            );

        }

        if ( html.find('#usermenu a[href^="modcp/banning.php?do=liftban"]').length ) {
            return bb.get( '/modcp/banning.php?do=editreason&userid=' + user_id ).then(function(html) {
                ret.is_banned = true;
                // ignore warnings/infractions/notes for banned users:
                ret.infraction_summary = '<span style="color: red">BANNED: ' + $('<div/>').text($.trim($(html).find( '#it_reason_1' ).val())).html() + '</span>';
                ret.summary = ret.infraction_summary + ' ' + ret.summary;
                return ret;
            });
        } else {
            ret.summary = ret.infraction_summary + ' ' + ret.summary;
            return ret;
        }
    });
}

/**
 * @summary Get information about a user from ModCP
 * @param {Number} user_id ID of user to gather information about
 * @return {jQuery.Promise}
 */
VBulletin.prototype.user_moderation_info = function(user_id) {

    var bb = this;

    return this.get( '/modcp/user.php?do=viewuser&u=' + user_id ).then(function(html) {
        html = $(html);

        var name = html.find( '[name="user\\[username\\]"]' ).val();

        if ( !name || !name.length ) return null; // user doesn't exist

        var image = html.find( 'img[src^="../image.php"]').attr( 'src' );

        var primary_group = html.find( '[name="user\\[usergroupid\\]"] :selected' ).text();
        var additional_groups = html.find('[name="membergroup\\[\\]"]:checked' ).map(function() { return $(this.parentNode).text() }).get();

        function get_date(type) {
            var div = html.find('#ctrl_' + type);
            var month = div.find('[name="' + type + '\\[month\\]"]').val();
            if ( month == 0 ) return null;
            return new Date(
                div.find('[name="' + type + '\\[year\\]"]').val(),
                parseInt(month,10)-1,
                div.find('[name="' + type + '\\[day\\]"]').val(),
                div.find('[name="' + type + '\\[hour\\]"]').val(),
                div.find('[name="' + type + '\\[minute\\]"]').val()
            );
        }

        var join_date = get_date('joindate'),
           visit_date = get_date('lastvisit'),
        activity_date = get_date('lastactivity'),
            post_date = get_date('lastpost');

        var ret = {
            username  : html.find( '[name="user\\[username\\]"]'  ).val(),
            user_id   : user_id,
            email     : html.find( '[name="user\\[email\\]"]'     ).val(),
            ip        : html.find( '[name="user\\[ipaddress\\]"]' ).val(),
            homepage  : html.find( '[name="user\\[homepage\\]"]'  ).val(),
            signature : html.find( '[name="signature"]'           ).val(),
            post_count: parseInt( html.find( '[name="user\\[posts\\]"]').val(), 10 ),

            groups    : [primary_group].concat(additional_groups),

            image     : ( image ? image.replace( /^\.\./, '' ) : null ),

                join_date:               join_date.getTime(),
               visit_date: visit_date ? visit_date.getTime() : null,
            activity_date:           activity_date.getTime(),
                post_date:   post_date ? post_date.getTime() : null,

            pm_notification: (
                bb._config['unPMable user groups'].filter(function(group) { return group == primary_group }).length
                ?             null                  // new users cannot receive messages
                : (
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
            )
        };

        ret.summary = (
            '(joined <time datetime="' +     join_date.toISOString() + '">' +     join_date.toISOString() + '</time>,' +
            ' active <time datetime="' + activity_date.toISOString() + '">' + activity_date.toISOString() + '</time>'
        );
        switch ( ret.post_count ) {
        case 0 :                                                  break;
        case 1 : ret.summary += ', 1 post'                      ; break;
        default: ret.summary += ', ' + ret.post_count + ' posts'; break;
        }
        var groups = ret.groups.filter(function(group) { return group != bb._config['default user group'] }).join(', ');
        if ( groups.length ) ret.summary += ', ' + groups;
        ret.summary += ')';

        return ret;
    });

}

/**
 * @summary Get user's signature user from ModCP
 * @param {Number} user_id ID of user to get signature for
 * @return {jQuery.Promise}
 */
VBulletin.prototype.user_signature_get = function(user_id) {
    var bb = this;
    return bb.get( '/modcp/user.php?do=editsig&u=' + user_id ).then(function(html) {

        if ( !this._modcp_data ) {
            // populate _modcp_data without making an extra request
            var dfd = new jQuery.Deferred();
            dfd.resolve(bb._parse_modcp_data(html));
            bb._modcp_data = dfd.promise();
        }

        return $(html).find('[name="signature"]').val();

    });
}

/**
 * @summary Set user's signature user through ModCP
 * @param {Number} user_id   ID of user to set signature for
 * @param {string} signature new signature text
 * @return {jQuery.Promise}
 */
VBulletin.prototype.user_signature_set = function(user_id, signature) {
    var bb = this;
    return this._get_modcp_data().then(function(data) {
        return bb.post( '/modcp/user.php?do=doeditsig', $.extend( {}, data, { do: 'doeditsig', signature: signature, userid: user_id } ) );
    });
}

/**
 * @summary Get new users
 * @return {jQuery.Promise}
 */
VBulletin.prototype.users_list_new = function() {

    return this.get( '/memberlist.php?order=desc&sort=joindate&pp=100' ).then(function(html) {
        return $(html).find('#memberlist_table tr:not(.columnsort) a.username').map(function() {
            var $this = $(this);
            return {
                username   : $this.text(),
                user_id    : parseInt( $this.attr('href').split('?u=')[1], 10 ),
                member_page: $this.attr('href')
            };
        }).get();
    });

}

/**
 * @summary suggest possible completions given a partial user name
 * @param {string} prefix partial user name
 * @return {Array.<Object>} list of user names and IDs
 */
VBulletin.prototype.users_complete = function( prefix ) {
    return this.post( '/ajax.php?do=usersearch', {
	do      : 'usersearch',
        fragment: prefix
    }).then(function(xml) {
        var ret = [], users = xml.getElementsByTagName('user'), n;
        for ( n=0; n!=users.length; ++n )
            ret.push({ user_id: parseInt( users[n].getAttribute('userid'), 10 ), username: users[n].textContent });
        return ret;
    });
}

/*
 * MISCELLANEOUS
 */

/**
 * @summary convert a URL to the parameters needed to build it
 * @param {string} url URL to convert
 * @return {Object} e.g. { type: 'user', url_for: 'user_show', args: { user_id: 1234 } }
 * @description The return value contains the following:
 * * type    - the main object of the URL (e.g. "user" or "thread")
 * * subtype - the specific page type (see url_for for a list)
 * * args    - arguments to url_for.<subtype>()
 */
VBulletin.prototype.url_decode = function( url ) {
    var ret;
    var decoders = [
        [ /showthread\.php\?(?:.*&)?p=([0-9]+)/, function(url, id) { ret = { type: 'post'  , subtype: 'thread_show', args: {   post_id: id } } } ],
        [ /showthread\.php\?(?:.*&)?t=([0-9]+)/, function(url, id) { ret = { type: 'thread', subtype: 'thread_show', args: { thread_id: id } } } ],
        [ /member.php\?(?:.*&)?u=([0-9]+)/     , function(url, id) { ret = { type: 'user'  , subtype:   'user_show', args: {   user_id: id } } } ]
    ];
    do {
        url.replace.apply( url, decoders.shift() );
    } while ( decoders.length && !ret );
    return ret;
}

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

// code shared between forum_metadata() and thread_metadata():
VBulletin.prototype._forum_thread_metadata = function(html) {
    html = $(html);
    var forum = html.find('.navbit a[href^="forumdisplay.php"]').map(function() {
        return { forum_id: parseInt( this.href.split( /\?f=/ )[1], 10 ), name: this.textContent };
    }).get();
    var prefix_id, prefixes = html.find('#prefix option').map(function() {
        if ( $(this).is(':checked') ) prefix_id = this.value;
        return {
            prefix_id: this.value, // despite the name, this is a string
            text: this.textContent
        };
    });
    var icon_id, icons = html.find('[name="iconid"]').map(function() {
        if ( $(this).is(':checked') ) icon_id = parseInt( this.value, 10 );
        return {
            icon_id: parseInt( this.value, 10 ),
            file: html.find('label[for="'+this.id+'"] img').attr('src'),
            name: html.find('label[for="'+this.id+'"] img').attr('alt')
        };
    });
    return {
        forum_id: forum.length ? forum[forum.length-1].forum_id : null,
        forum: forum,

        prefix_id: prefix_id,
        prefixes: prefixes.get(),

        icon_id: icon_id,
        icons: icons.get()

    };
}

/**
 * @summary Get metadata about a forum
 * @param {Number} forum_id
 * @return {jQuery.Promise}
 */
VBulletin.prototype.forum_metadata = function( forum_id ) {
    return this.get( '/newthread.php?do=newthread&f=' + forum_id ).then(this._forum_thread_metadata);
}

/**
 * @summary Get information about threads from the first page of a forum
 * @see {thread_posts}
 *
 * @param {number}  forum_id ID of forum to get threads for
 * @param {Boolean} recent   only download recently-changed threads (usually the past 24 hours)
 * @return {jQuery.Promise} Deferred object that will return when all pages have loaded
 */
VBulletin.prototype.forum_threads = function(forum_id, recent) {

    var bb = this;

    return bb.get(
        recent
        ? '/forumdisplay.php?pp=200&sort=lastpost&order=desc&daysprune=1&f=' + forum_id
        : '/forumdisplay.php?pp=200&sort=lastpost&order=desc&daysprune=-1&f=' + forum_id
    ).then(function(html) {

        var is_moderator = html.search( '<script type="text/javascript" src="clientscript/vbulletin_inlinemod.js?' ) != -1;

        var today = new Date(), yesterday = new Date();
        yesterday.setDate(yesterday.getDate()-1);
        today     = [ today    .getDate().toString().replace(/^(.)$/,"0$1"), (today    .getMonth()+1).toString().replace(/^(.)$/,"0$1"), today    .getYear()+1900 ].join( '/' );
        yesterday = [ yesterday.getDate().toString().replace(/^(.)$/,"0$1"), (yesterday.getMonth()+1).toString().replace(/^(.)$/,"0$1"), yesterday.getYear()+1900 ].join( '/' );

        if ( is_moderator && !this._forum_threads_callback_initialised++ ) {
            bb.doc.on( 'dblclick', '.bb_api_threadstatus', function() {
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
            else if ( $( '.prefix_closed'          , this ).length ) status = 'closed'
            else if ( $( '.prefix_deleted,.deleted', this ).length ) status = 'deleted'
            ;

            var ret = {
                container_element: this,
                forum_id         : forum_id,
                thread_id        : parseInt(thread_id,10),
                orig_thread_id   : parseInt(this.id.substr(7),10), // for moved threads
                title_element    : title,
                title            : title.text(),
                status           : status,
                is_sticky        : $('div.sticky', this).length ? true : false
            };
            if ( status != 'moved' && status != 'deleted' ) {
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
 * @summary Get a tree of forums on the site
 * @return {jQuery.Promise} Deferred object that will return when all pages have loaded
 */
VBulletin.prototype.forums = function() {
    return this.get( '/archive/index.php' ).then(function(html) {
        function node() {
            var children = $(this).children('ul').children().map(node).get();
            var a = $(this).children('a');
            var forum_id;
            ( a.attr('href') || '' ).replace( /\/archive\/index.php\/f-([0-9]+)\.html$/, function(match, _forum_id) { forum_id = _forum_id });
            if ( children.length || forum_id ) {
                var ret = { name: a.text() };
                if ( forum_id ) ret.forum_id = parseInt( forum_id, 10 );
                if ( children.length ) ret.children = children;
                return ret;
            }
        }
        return $(html).find( '#content > ul > li' ).map(node).get();
    });
}

/**
 * @summary get recent threads/posts on the forum
 * @return {jQuery.Promise}
 */
VBulletin.prototype.activity = function(min_date, min_post_id) {
    return this.post(
        '/activity.php',
        {
            mindateline: Math.max( min_date, Math.floor( new Date().getTime()/1000 - 60*60 ) ),
            minid      : min_post_id || 1,
            minscore   : 0,
            pp         : 200,
            show       : 'all',
            sortby     : 'recent',
            time       : 'anytime'
        }
    ).then(function(xml) {
        var posts = [], elements = xml.getElementsByTagName('bit');
        var max_post_id = 0, max_thread_id = 0;
        for ( var n=0; n!=elements.length; ++n ) {
            var $element = $(elements[n].textContent);
            var links = $element.find('a');
            var   post_id = parseInt( links.last().attr('href').split('#post')[1], 10 );
            var thread_id = parseInt( links.eq(1) .attr('href').split('?t='  )[1], 10 );
            if ( post_id ) {
                if ( max_post_id   <   post_id ) max_post_id   =   post_id;
            } else {
                if ( max_thread_id < thread_id ) max_thread_id = thread_id;
            }
            posts.push({
                container_element: $element,
                  post_id        :   post_id,
                thread_id        : thread_id,
                 forum_id        : parseInt( links.eq(2) .attr('href').split('?f='  )[1], 10 ),
                date             : $element.find('.date').text(),
                username         : links.first().text(),
                user_id          : parseInt( ( links.first().attr('href') || '             guest' ).substr(13), 10 ),
                title            : links.eq(1).text(),
                message          : $element.find('.excerpt').text(),
                message_element  : $element.find('.excerpt'),
            });
        }
        return {
            max_date     : parseInt( xml.getElementsByTagName('maxdateline')[0].textContent, 10 ),
            max_post_id  : max_post_id,
            max_thread_id: max_thread_id,
            posts: posts
        }
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
        thread_show: 'postbit.css',
        activity   : 'activitystream.css',
        folder_show: 'private.css'
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
 * @summary Get keys for use in building dynamic CSS
 * @return {Object.<string,string>} CSS keys and values
 *
 * @description Bulletin board software often uses theme-specific values
 * to control various bits of CSS.  We retrieve those from the page,
 * in a format compatible with Variables.parse()
 */
VBulletin.prototype.css_keys = function() {
    var ret = {}, element;
    element = $('<div></div>').appendTo(this.doc.find('body'));
    ret['foreground colour'] =  element.css( 'color' );
    element.remove();

    element = $('<div class="body_wrapper"></div>').appendTo(this.doc.find('body'));
    ret['body_wrapper background colour'] = element.css('background-color');
    element.remove();

    element = $('<div class="popupmenu"><a class="popupctrl"></a></div>').appendTo(this.doc.find('body'));
    element.children().css('background-image').replace(/(?:^|\/)images\.([^\/]*)/, function(image, theme) { ret.theme = theme });
    element.remove();

    return ret;
}

/**
 * @summary Get posts in the moderation queue
 * @return {jQuery.Promise}
 */
VBulletin.prototype.posts_moderated = function() {

    return this.get( '/modcp/moderate.php?do=posts' ).then(function(html) {
        html = $(html);
        var ret = {
            threads: [],
            posts  : [],
        };
        var current_block, current;
        function parse_row() {
            $( 'a[href^="user.php"]', this ).each(function() { // User who created a post (first row of a block)
                current_block.push(current = {
                    user_id : parseInt( this.href.split('&u=')[1], 10 ),
                    username: $(this).text()
                });
            });
            $( 'a[href^="../showthread.php"]', this ).each(function() { // Thread (in post block)
                current.thread_id    = parseInt( this.href.split('?t=')[1], 10 );
                current.thread_title = $(this).text();
            });
            $( 'a[href^="../forumdisplay.php"]', this ).each(function() { // Forum
                current.forum_id   = parseInt( this.href.split('?f=')[1], 10 );
                current.forum_name = $(this).text();
            });
            $( '[name^="threadtitle"]', this ).each(function() { // Title (in thread block)
                current.thread_id    = parseInt( this.name.split(/[\[\]]/)[1], 10 );
                current.thread_title = $(this).val();
            });
            $( '[name^="posttitle"]', this ).each(function() { // Title (in post block)
                current.post_id    = parseInt( this.name.split(/[\[\]]/)[1], 10 );
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

    var login_attempt_count = 0;

    iframe
        .css({ overflow: 'hidden', display: 'none' })
        .attr( 'src', url )
        .one( 'load', function() {
            document.title = title;
            if ( $('#vb_login_username', iframe[0].contentDocument.body ).length ) { // need to log in
                setTimeout(function() {
                    if ( !login_attempt_count++ && iframe[0].contentDocument.getElementById('vb_login_password').value.length ) {
                        $(iframe[0].contentDocument.body).find('form').submit();
                    } else {
                        $(iframe[0].contentDocument.body).css({ overflow: 'hidden' }).find('p').remove();
                        iframe.css({ display: 'block', width: '450px', height: '200px' }); // set the desired size
                        var form = $(iframe[0].contentDocument.body).find('form');
                        iframe.css({ width: form.outerWidth() + 'px', height: form.outerHeight() + 'px' }); // fit based on the computed size
                    }
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
                }, 0 );
            } else { // already logged in
                dfd.notify();
                document.title = title;
                dfd.resolve(iframe[0]);
                return;
            }
        });

    return dfd.promise();

}

/**
 * @summary log in to the site
 * @param {jQuery} iframe iframe element to use
 * @param {jQuery.Promise}
 *
 * @description
 * This function pops up an iframe with login details for the main site.
 * Note: for security reasons, the calling code must ensure that
 * VBulletin.iframe_callbacks() is called in the iframe page.
 * (this could be done automatically when logging in to the current site,
 * but not when logging in to another domain)
 */
VBulletin.prototype.login = function( iframe, default_user ) {

    var dfd = new jQuery.Deferred();
    var title = document.title; // iframes tend to overwrite the document title

    if ( !this._origin ) {
        dfd.resolve(iframe);
        return dfd.promise();
    }

    var bb = this;

    function get_login() {
        iframe
            .css({ overflow: 'hidden', display: 'none' })
            .attr( 'src', bb._origin )
        ;

        window.addEventListener(
            "message",
            function listen(event) {
                if (event.origin !== bb._origin) return;
                if ( event.data == 'BulletinBoard VBulletin get default user' ) {
                    document.title = title;
                    iframe.css({ display: 'block', width: '0', height: '0', border: 'none' });
                    setTimeout(function() {
                        // Firefox will silently refuse to reply unless we wait a little while
                        event.source.postMessage( 'BulletinBoard VBulletin default user ' + (default_user||''), event.origin );
                    }, 10 );
                } else if ( event.data == 'BulletinBoard VBulletin show' ) {
                    iframe.css({ display: 'block', width: '450px', height: '2em' });
                } else if ( event.data == 'BulletinBoard VBulletin progress' ) {
                    iframe.hide();
                } else {
                    event.data.replace( /^BulletinBoard VBulletin session (.*)/, function(match, session_id) { bb.session_id = session_id });
                    event.data.replace( /^BulletinBoard VBulletin success (.*)\n([^]*)/, function(match, security_token, doc) {
                        bb.security_token = security_token;
                        bb.default_user   = default_user;
                        bb.doc = $(doc);
                        document.title = title;
                        iframe.hide();
                        window.removeEventListener("message", listen, false);
                        if ( bb.session_id ) {
                            BabelExt.memoryStorage.set( 'VBulletin login ' + bb._origin + ' ' + default_user, JSON.stringify({
                                creation_time : new Date().getTime(),
                                session_id    : bb.session_id,
                                security_token: bb.security_token
                            }));
                        }
                        dfd.resolve(iframe);
                    });
                }
            },
            false
        );

    }

    if ( default_user ) {
        BabelExt.memoryStorage.get( 'VBulletin login ' + bb._origin + ' ' + default_user, function(data) {
            if ( data.value ) {
                var credentials = JSON.parse(data.value);
                if ( credentials.creation_time + 60*60*1000 > new Date().getTime() ) {
                    bb.session_id     = credentials.session_id;
                    bb.security_token = credentials.security_token;
                    dfd.resolve(iframe);
                } else {
                    get_login();
                }
            } else {
                get_login();
            }
        })
    } else {
        get_login();
    }

    return dfd.promise();

}

/**
 * @summary communicate from an iframe to the parent window
 * @param {string} target_origin expected origin of the parent window
 * @param {Array.<string>} cookie_domains domains that cookies are normally set for (default: do not delete cookies)
 *
 * @description For security reasons, .login() cannot inject JavaScript
 * into iframes in different origins.  Instead, the calling code must
 * arrange for this function to be called.
 *
 * It's sometimes useful to use VBulletin's no-cookie fallback mode
 * (e.g. using the "trailing dot" domain on a site that hard-codes
 * the cookie domain).  Passing cookie_domain ensures cookies are deleted
 * to resemble a cookieless browser
 */
VBulletin.iframe_callbacks = function(target_origin, cookie_domains) {
    BabelExt.utils.dispatch(
        {
            match_pathname: '/login.php',
            match_params: { do: 'login' },
            callback: function( stash, pathname, params, a ) {
                window.parent.postMessage( 'BulletinBoard VBulletin progress', target_origin );
            }
        },
        {
            match_pathname: '/login.php',
            match_params: { do: 'login' },
            match_elements: '#redirect_button a.textcontrol',
            callback: function( stash, pathname, params, a ) {
                a.href.replace( /[\?&]s=([^&]+)/, function( match, session_id ) {
                    window.parent.postMessage( 'BulletinBoard VBulletin session ' + session_id, target_origin );
                });
            }
        },
        {
            match_elements: 'input[name="securitytoken"]',
            callback: function( stash, pathname, params, input) {
                if ( input.value == 'guest' ) $(function() {
                    window.addEventListener("message", function(event) {
                        if (event.origin !== target_origin) return;
                        event.data.replace( /^BulletinBoard VBulletin default user (.*)/, function(match, default_user) {
                            if ( default_user.length ) $('#navbar_username').val( default_user );
                            setTimeout(function() {
                                if ( document.getElementById('navbar_password').value.length )
                                    $('.loginbutton').click();
                                else
                                    window.parent.postMessage( 'BulletinBoard VBulletin show', target_origin );
                            }, 50 );
                        });
                    }, false);
                    window.parent.postMessage( 'BulletinBoard VBulletin get default user', target_origin );
                    $(document.body)
                        .css({ overflow: 'hidden' }).html( $('#navbar_loginform')[0].outerHTML )
                        .children().css({ 'text-align': 'center', 'width': '450px' });
                    $('#navbar_password_hint,#remember').hide();
                    $('#navbar_password').show().focus().attr( 'placeholder', 'password' );
                    $('.loginbutton').click(function() {
                        document.cookie.split(/; /).forEach(function(cookie) {
                            ( cookie_domains || [] ).forEach(function(cookie_domain) {
                                document.cookie = cookie.replace(/($|=.*)/, '=; domain='+cookie_domain+'; expires=Thu, 01-Jan-1970 00:00:01 GMT');
                            });
                        });
                    });
                });
                else {
                    window.parent.postMessage( 'BulletinBoard VBulletin success ' + input.value + "\n" + document.documentElement.outerHTML, target_origin );
                }
            }
        }
    );
}

/**
 * @summary set the contents of the page's main edit box
 * @param {string} text text to set
 */
VBulletin.prototype.editor_set = function( text ) {
    $('#vB_Editor_QR_editor_backup,#vB_Editor_QR_editor').val( text );
    if ( ! $('#vB_Editor_001_textarea:visible,#cke_contents_vB_Editor_QR_editor:visible,.cke_source:visible').val( text ).length )
        BabelExt.utils.runInEmbeddedPage("vB_Editor['vB_Editor_001'].write_editor_contents(" + JSON.stringify(text) + ")");
}

/**
 * @summary get the contents of the page's main edit box
 * @return {string} text contents
 */
VBulletin.prototype.editor_get = function() {
    // The only reliable way to get this value is from JavaScript running in page context:
    BabelExt.utils.runInEmbeddedPage( 'document.body.setAttribute( "data-editor-contents", vB_Editor["vB_Editor_001"].get_editor_contents() )');
    var ret = this.doc.find('body').attr('data-editor-contents');
    this.doc.find('body').removeAttr('data-editor-contents');
    return ret;
}

/**
 * @summary Statistics about the server running the bulletin board
 * @return {Object} one, five and fifteen minute load averages; total, logged-in and logged-out users online
 */
VBulletin.prototype.server_stats = function( ) {
    return this.get( '/modcp/index.php?do=home' ).then(function(html) {
        var ret;
        $(html).find('.alt1').eq(1).text().replace(
            /^\s*([0-9.]+)\s*([0-9.]+)\s*([0-9.]+)\s*\|\s*([0-9,]+) Users Online \(([0-9,]+) members and ([0-9,]+) guests\)\s*$/,
            function( match, one_minute, five_minutes, fifteen_minutes, total_online, members_online, guests_online ) {
                ret = {
                        one_minute_loadavg: parseFloat(     one_minute  ),
                       five_minute_loadavg: parseFloat(    five_minutes ),
                    fifteen_minute_loadavg: parseFloat( fifteen_minutes ),
                      total_online: parseInt(   total_online.replace( /,/g, '' ), 10 ),
                    members_online: parseInt( members_online.replace( /,/g, '' ), 10 ),
                     guests_online: parseInt(  guests_online.replace( /,/g, '' ), 10 ),
                };
            });
        return ret;
    });
}

/**
 * @summary Redirect from the "moderation_ipsearch" page to the right page
 * @param {Object} params page parameters
 * @description We would like to link to the IP search page, but it needs
 * various extra parameters for authentication and CSRF protection.
 * This function redirects from the fake page to the real one.
 */
VBulletin.prototype.redirect_modcp_ipsearch = function(params) {
    var bb = this;
    bb.get( '/modcp/user.php?do=doips' ).then(function(html) {
        function redirect() {
            var form = $(html).find('#cpform').hide().appendTo(bb.doc.find('body'));
            [ 'ipaddress', 'username', 'depth' ].forEach(function(param) {
                if ( params.hasOwnProperty(param) ) form.find( '[name="' + param + '"]' ).val( params[param] );
            });
            form.submit();
        }
        if ( document.body ) redirect();
        else $(redirect);
    });
    $(function() {
        $('blockquote').text( 'Redirecting...' );
    });
}
