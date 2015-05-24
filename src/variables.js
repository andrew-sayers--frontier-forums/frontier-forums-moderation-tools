/**
 * @file Configuration, localisation and policy loaded from the user's site
 * @author Andrew Sayers
 */

/**
 * @summary Generic class for any type of bulletin board
 * @constructor
 * @abstract
 * @extends Cacheable
 * @description
 * Each variable has a language, namespace and value.
 * Variable resolution is necessarily quite complex:
 * + A default language is passed in
 * + If a "thread languages" variable exists, it is used for thread-specific language overrides
 * + If a "forum languages" variable exists, it is used for forum-specific language overrides
 * + Variable names of the form "foo: bar: baz" are treated specially - the part before the first ": " must be matched, others are optional (so a request for ['foo', 'bar'] would match a variable named 'foo)
 * Variable values can include {{keys}}, which are resolved recursively.  So {{foo: {{something}}}} will first resolve {{something}}, then {{foo: (that thing)}}
 */
function Variables(args) {

    this.bb               = args.bb;
    this.default_language = args.default_language;
    this.default_keys     = args.default_keys || {};
    this.error_callback   = args.error_callback;

    this.thread_languages = {};
    this.forum_languages  = {};

    Cacheable.call( this, args );

    var v = this;
    this.promise = this.promise.then(function() {
        v.set_namespaces();
        if ( v.check( 'policy', 'thread languages' ) ) {
            var tl = v.resolve( 'policy', 'thread languages', {}, 'hash of arrays' );
            Object.keys(tl).forEach(function(language) { tl[language].forEach(function(thread) { if ( thread.type == 'thread' ) v.thread_languages[thread.thread_id] = language; }); });
        }
        if ( v.check( 'policy', 'forum languages' ) ) {
            var fl = v.resolve( 'policy',  'forum languages', {}, 'hash of arrays' );
            Object.keys(fl).forEach(function(language) { fl[language].forEach(function(forum ) { if (  forum.type == 'forum'  ) v. forum_languages[ forum. forum_id] = language; }); });
        }
    });

}

Variables.prototype = Object.create(Cacheable.prototype, {

    bb               : { writable: true, configurable: false },
    default_language : { writable: true, configurable: false },
    default_keys     : { writable: true, configurable: false },

    // main list of variables (filled in by child classes):
    namespaces: { writable: true, configurable: false },

    // thread- and forum-specific language overrides:
    thread_languages: { writable: true, configurable: false },
    forum_languages : { writable: true, configurable: false },

    error_callback: { writable: true, configurable: false, default: function(message) { alert(message) } }

});
Variables.prototype.constructor = Variables;

/**
 * @summary get the target language
 * @param {Number} thread_id thread ID
 * @param {Number}  forum_id forum ID
 * @description thread language overrides forum language, which overrides user language,
 * EXCEPT when the user language is a specialism of the other language.
 * So a user language 'en-GB' overrides a thread language 'en',
 * but a user language 'en-GB' is overridden by a thread language 'fr'.
 */
Variables.prototype.get_language = function(thread_id, forum_id) {
    var language = this.default_language, thread_languages = this.thread_languages, forum_languages = this.forum_languages;
    if      ( thread_id && thread_languages.hasOwnProperty(thread_id) && language.search(thread_languages[thread_id]+'-')!=0 ) language = thread_languages[thread_id];
    else if (  forum_id &&  forum_languages.hasOwnProperty( forum_id) && language.search( forum_languages[ forum_id]+'-')!=0 ) language =  forum_languages[ forum_id];
    return language;
}


/**
 * @summary update the complete list of variables, grouped by namespace
 * @return {Array.<Object>}
 */
Variables.prototype.set_namespaces = function() {/*
    this.namespaces = this.cache.namespaces; // or however the child class builds namespaces
*/}


/**
 * @summary get a variable
 * @param {string}                namespace namespace to find the variable in
 * @param {string|Array.<string>} names     name(s) of variable within the namespace
 * @param {Number=}               forum_id  ID of forum to instantiate for
 * @param {Number=}               thread_id ID of thread to instantiate for
 * @return {Object} variable (if found) or error information (otherwise)
 *
 * @description
 * Variables need to follow some fairly specific rules to produce useful results:
 * Variables are defined per-language, then the language is decided based on the forum, thread, and default language.
 * Names are defined with sections split up by colons (e.g. "greeting message: newbie", "greeting message: old hand").
 * We always try to return the most specific name for the language, but can default to less-specific ones
 *
 * Variables can be set to special values to override normal handling:
 *
 * "OVERRIDE: pretend this variable exists but has no contents" treats a variable as an empty string.
 * Use this when you want to define a variable as an empty string.  Some WYSIWYG editors will delete
 * empty [quote] blocks - this is the recommended way to avoid those weird errors.
 *
 * "OVERRIDE: pretend this variable doesn't exist" treats a variable as if it didn't exist.
 * Use this when you want to define a general variable, then un-define it again in a more
 * specific variable.
 *
 * "NO OVERRIDE: ..." treats a variable as if the initial "NO OVERRIDE: " didn't exist.
 * Use this to include the above strings literally in a variable.
 *
 * The return object contains 'text' and 'error', one null and one non-null.
 * If there is an error, the object will also contain 'resolutions'.
 * See the source of .resolve() for an example of how to use this output.
 */
Variables.prototype.get = function( namespace, names, forum_id, thread_id ) {

    var root_name;
    if ( typeof(names) == 'string' ) {
        root_name = names;
        names = [];
    } else { // array of possible names
        root_name = names[0];
        names = names.slice(1);
    }

    target_namespace = namespace + ': ' + this.get_language( thread_id, forum_id );

    // STEP TWO: get the best matching variable given the target language
    var text = null, old_match_quality = 0, matching_namespaces = [];
    this.namespaces.forEach(function(namespace) {
        var match_quality = Math.max.apply( Math, namespace.names.map(function(namespace) {
            return (
                  ( target_namespace == namespace )                   ? 3 // exact match
                : ( target_namespace.search( namespace + '-' ) == 0 ) ? 2 // want 'en-GB', have 'en'
                : ( namespace.search( target_namespace + '-' ) == 0 ) ? 2 // want 'en', have 'en-GB'
                : ( namespace       .replace( /: default$/, ': ' ) ==
                    target_namespace.replace( /: [-a-z]+$/, ': ' )  ) ? 1 // want 'en', have 'default'
                : 0
            );
        }));
        if ( match_quality ) matching_namespaces.push(namespace);
        if ( old_match_quality < match_quality ) {
            var name = root_name;
            for ( var n=1; n<Math.pow(2,names.length); ++n ) {
                var new_name = root_name + ': ' + names.filter(function(value,index) { return n & (1<<index) }).join(': ');
                if ( namespace.variables.hasOwnProperty(new_name.toLowerCase()) ) name = new_name;
            }
            if ( namespace.variables.hasOwnProperty(name.toLowerCase()) ) {
                text = namespace.variables[name.toLowerCase()];
                old_match_quality = match_quality;
            }
        }
    });

    var full_name = [ root_name ].concat(names).join(': ');

    var ret = {
        matching_namespaces: matching_namespaces,
        name: full_name
    };

    if ( text === null ) {
        return $.extend(ret, {
            text: null,
            error: "Couldn't find variable \"" + full_name + '" in namespace "' + target_namespace + '"',
            resolutions: this.suggest_resolutions(matching_namespaces),
        });
    } else {
        switch ( text ) {
        case "OVERRIDE: pretend this variable exists but has no contents": return $.extend(ret, { text: ''  , error: null });
        case "OVERRIDE: pretend this variable doesn't exist"             : return $.extend(ret, { text: null, error: 'variable overriden' });
        case '': console.log(
            'Warning: "' + full_name + '" in namespace "' + target_namespace + '" is an empty string.\n' +
            'These are deprecated for compatibility, and will become an error in a future version of the moderators\' etension.'
        );
            // FALL THROUGH
        default                                                          : return $.extend(ret, { text: text.replace( /^NO OVERRIDE: /, "" ), error: null });
        };
    }

}

/**
 * @summary check if a variable exists
 * @param {string}                namespace namespace to find the variable in
 * @param {string|Array.<string>} names     name(s) of variable within the namespace
 * @param {Number=}               forum_id  ID of forum to instantiate for
 * @param {Number=}               thread_id ID of thread to instantiate for
 * @param {boolean}
 */
Variables.prototype.check = function( namespace, names, forum_id, thread_id ) {
    return this.get( namespace, names, forum_id, thread_id ).text !== null;
}

/**
 * @summary parse the contents of a variable
 * @param {string}             text      string to parse
 * @param {Object.<string,*>=} keys      keys used to instantiate the variable
 * @param {string=}            parser    parser used for the variable ('string', 'array of items' or 'hash of arrays', default: 'string')
 * @param {Number=}            forum_id  ID of forum to instantiate for
 * @param {Number=}            thread_id ID of thread to instantiate for
 * @return {string|Array|Object} parsed output
 *
 * @description
 * Parse a string as a variable.
 *
 * Keys should either be strings or arrays of strings.  Arrays are automatically converted to sentences,
 * e.g. [1,2,3] becomes "1, 2 and 3".
 *
 * All parsers treat text {{between two curly brackets}} specially.  They're converted
 * either to one of the keys passed in, or alternatively to another matching variable.
 * Curly bracket blocks can be nested (e.g. {{variable for: {{key}}}}), and references
 * within referenced variables are themselves parsed for references.  To include a
 * literal that resembles a variable, put brackets between the key {{(like this)}}.
 *
 * See get() for special override values variables can have.
 *
 * The "string" parser returns plain string output, the "array of items" parser
 * expects the variable to be a BBCode [list], and the "hash of arrays" parser
 * expects the variable to be a BBCode [list] with a single [post], [thread] or [url]
 * element per list item.
 *
 * @example
 * v.parse( 'Hello {{username}}', { username: 'some user' }, 'string', 12, 345 );
 */
Variables.prototype.parse = function( text, keys, parser, forum_id, thread_id ) {

    var v = this;

    // resolve {{keys}}:
    keys = $.extend( {}, this.default_keys, keys || {} );
    var has_changed;
    do {
        has_changed = false;
        text = text.replace( /{{([^{}\n]+)}}/g, function(match, key) {
            if ( !key.search( /^\(.*\)$/ ) ) return match;
            key = key.toLowerCase();
            if ( keys.hasOwnProperty(key) ) {
                has_changed = true;
                var values = keys[key];
                if ( $.isArray(values) ) {
                    switch ( values.length ) {
                    case 0: return '';
                    case 1: return values[0];
                    default:
                        var last_joiner = v.get('other templates', 'localisation: list end joiner', forum_id, thread_id);
                        if ( last_joiner.error ) {
                            v.error_callback( last_joiner.error, last_joiner.resolutions );
                            throw last_joiner.error;
                        } else {
                            return values.slice( 0, values.length-1 ).join(', ') + last_joiner.text + values[values.length-1];
                        }
                    }
                } else {
                    return values;
                }
            } else if ( key.search(':') != -1 ) {
                var names = key.split(/:\s*/);
                var root_name = names.shift();
                if ( v.check( root_name, names, forum_id, thread_id ) ) {
                    has_changed = true;
                    return v.resolve( root_name, names, keys, 'string', forum_id, thread_id );
                }
            }
            return match;
        })
    } while ( has_changed );

    text = text.replace( /{{\(([^{}\n]+)\)}}/g, "{{$1}}" );


    // parse:
    function parse_array() {
        var array = [];
        text.replace( /\[list\]\s*\[\*\]\s*((?:.|\n)*?)\s*\[\/list\]/i, function(text, list) {
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
    case 'string': return text;
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

/**
 * @summary escape a string for use in .parse()
 * @param {string} text string to escape
 * @return {string} escaped output
 *
 * @description
 * .parse() recursively parses keys passed to it.  If you want to include a key
 * that includes literal text {{between two curly brackets}}, you will need to
 * escape it.
 *
 */
Variables.prototype.escape = function( value ) { return value.replace( /{{([^{}\n]+)}}/g, "{{($1)}}") }

/**
 * @summary get() and parse() a variable
 * @param {string}                namespace namespace to find the variable in
 * @param {string|Array.<string>} names     name(s) of variable within the namespace
 * @param {Object.<string,*>=}    keys      keys used to instantiate the variable
 * @param {string=}               parser    parser used for the variable ('string', 'array of items' or 'hash of arrays', default: 'string')
 * @param {Number=}               forum_id  ID of forum to instantiate for
 * @param {Number=}               thread_id ID of thread to instantiate for
 *
 * @example
 * v.resolve( 'policy', [ 'greeting message', 'newbie' ], { name: username }, 'string', 12, 345 );
 */
Variables.prototype.resolve = function( namespace, names, keys, parser, forum_id, thread_id ) {

    var variable = this.get(namespace, names, forum_id, thread_id);

    if ( variable.error ) {
        this.error_callback( variable.error, variable.resolutions );
        throw variable.error;
    } else {
        return this.parse( variable.text, keys, parser, forum_id, thread_id );
    }

}

/*
 * Suggest ways to resolve a "missing variable" error
 * @abstract
 * @private
 * @param {Array} matching_namespaces namespace objects that could contain the variable
 * @param {Array} suggested resolutions
 */
Variables.prototype.suggest_resolutions = function( matching_namespaces ) {/*
    return [
        {
            message: 'edit some thread',
            href   : '/showthread.php?t=1234'
        }
    ];
*/}

/*
 * Suggest ways to resolve an error by editing it
 * @param {string}                namespace namespace to find the variable in
 * @param {string|Array.<string>} names     name(s) of variable within the namespace
 * @param {Number=}               forum_id  ID of forum to instantiate for
 * @param {Number=}               thread_id ID of thread to instantiate for
 */
Variables.prototype.suggest_resolutions_edit = function( namespace, names, forum_id, thread_id ) {

    var variable = this.get( namespace, names, forum_id, thread_id );

    var resolutions = this.suggest_resolutions( variable.matching_namespaces );

    resolutions.forEach(function(resolution) { resolution.message = ('edit ' + variable.name).replace( / +/g, '\xA0' ) });

    return resolutions;

}

/*
 * Build a namespace from a set of posts
 * @param {Array.<Number>} posts posts to retrieve
 * @param {jQuery.Promise}
 */
Variables.prototype.posts_namespace = function( posts, names ) {

    var bb = this.bb;
    var variables = {};
    return $.when.apply(
        $,
        posts.map(function(post_id) {
            return bb.post_info(post_id).then(function(info) {
                bb.quotes_process(info.bbcode).forEach(function(variable) {
                    variables[variable.author.toLowerCase()] = variable.text;
                })
            });
        })
    ).then(function() {
        return { variables: variables, names: names.map(function(name) { return name.name + ': ' + name.language }) };
    });

}


/*
 * VARIABLES FROM POST
 */

/**
 * @summary variables loaded from the first post in a thread
 * @constructor
 * @extends Variables
 */
function VariablesFromFirstPost(args) {
    args.default_language = 'default';
    Variables.prototype.constructor.call(this, args);
}
VariablesFromFirstPost.prototype = Object.create(Variables.prototype);

VariablesFromFirstPost.prototype.set_namespaces = function() { this.namespaces = this.cache.namespaces }

VariablesFromFirstPost.prototype.refresh = function(args) {
    var v = this;
    return this.bb.thread_posts( args.thread_id, args.first_page ).then(function (posts) {
        return v.posts_namespace( [ posts[0].post_id ], [{ name: args.namespace, language: 'default' }] ).then(function(namespace) { v.cache.namespaces = [namespace] });
    });
}

/*
 * VARIABLES FROM FORUM
 */

/**
 * @summary variables loaded from a forum full of variables
 * @constructor
 * @extends Variables
 */
function VariablesFromForum(args) {
    Variables.prototype.constructor.call(this, args);
}
VariablesFromForum.prototype = Object.create(Variables.prototype);

VariablesFromForum.prototype.suggest_resolutions = function( matching_namespaces ) {
    var v = this;
    return matching_namespaces.map(function(namespace) {
        var thread = Object.keys(v.cache.threads).filter(function(thread_id) { return v.cache.threads[thread_id].namespace.names.join(' / ') === namespace.names.join(' / ') })[0];
        thread = v.cache.threads[ thread ];
        return {
            message: 'Add variable to ' + thread.title,
            href   : '/showthread.php?t=' + thread.thread_id
        }
    });
}

VariablesFromForum.prototype.set_namespaces = function() {
    var threads = this.cache.threads;
    var keys = Object.keys( threads || {} );
    keys.sort(function(a,b) { return parseInt(a.thread_id,10) - parseInt(b.thread_id,10) });
    this.namespaces = keys.map(function(key) { return threads[key].namespace });
}

/**
 * Get namespace associated with a thread
 * @param {Object}       thread     thread to retrieve
 * @param {HTMLElement=} first_page first page of the thread
 * @return {jQuery.Promise}
 * @private
 */
VariablesFromForum.prototype.thread_namespace = function( thread, first_page ) {
    var v = this;
    if ( thread.replies && !first_page )
        return v.posts_namespace( thread.replies, thread.names ).then(function(namespace) { thread.namespace = namespace });
    else
        return this.bb.thread_posts( thread.thread_id, first_page ).then(function (posts) {
            thread.replies = posts.map(function(post) { return post.post_id });
            thread.replies.shift(); // ignore the first post
            return v.posts_namespace( thread.replies, thread.names ).then(function(namespace) { thread.namespace = namespace });
        });
}

/**
 * @summary Refresh the list of variables
 * @param {Object} args arguments passed to the constructor
 * @return {jQuery.promise}
 * @description downloads the variables forum and converts it to metadata
 */
VariablesFromForum.prototype.refresh = function(args) {

    var v = this;

    return this.bb.forum_threads(args.forum_id).then(function(threads) {

        // we cache thread modification times and reply lists to reduce the number of downloads:
        var old_threads = v.cache.threads || {};
        var new_threads = {};

        if ( !threads.length ) return; // in case we're logged out or something

        // reset namespaces:
        Object.keys(old_threads).forEach(function(thread_id) { old_threads[thread_id].names = [] });

        var promises = [];
        threads.forEach(function(thread) {
            thread.title.replace( /^([^ :]*):\s*([^:]*)$/, function( text, language, namespace ) { // thread titles should be of the form "language: namespace"

                var thread_data = old_threads[thread.thread_id];

                if ( !thread_data )
                    old_threads[thread.thread_id] = thread_data = { thread_id: thread.thread_id, last_modified: 'new', replies: [], names: [] };

                if ( thread.status == 'moved' ) language += '-'; // slightly reduce the match quality for redirects

                thread_data.names.push({ name: namespace, language: language });

                if ( !thread.reply_count ) return; // only add unmoved threads with at least one reply

                thread_data.title = thread.title;
                new_threads[thread.thread_id] = thread_data;

                // reload thread data
                if ( thread.last_modified && thread.last_modified != thread_data.last_modified ) {
                    thread_data.last_modified = thread.last_modified;
                    switch ( thread.reply_count - thread_data.replies.length ) {
                    case 0 :                                                break; // no new replies
                    case 1 : thread_data.replies.push(thread.last_post_id); break; // one new reply
                    default: delete thread_data.replies;                    break; // many new replies
                    }
                    promises.push(thread_data);
                }

            });

        });

        return $.when.apply( $, promises.map(function(thread) { return v.thread_namespace(thread) }) ).then(function() {
            v.cache.threads = new_threads;
            return v.update_cache();
        });

    }, function() {
        args.error_callback( "Could not refresh the list of variables", 'log in');
    });

}

/**
 * Refresh the list of variables associated with the specified thread
 * @param {Number}       thread_id thread to refresh
 * @param {HTMLElement=} body      page for the current thread
 * @param {jQuery.Promise}
 */
VariablesFromForum.prototype.refresh_thread = function(thread_id, body) {
    var v = this;
    if ( this.cache.threads.hasOwnProperty(thread_id) )
        return v.thread_namespace( this.cache.threads[thread_id], body ).then(function() { return v.update_cache() });
    else
        // TODO: handle this properly:
        return $.Deferred().reject('thread not initialised').promise();
}

/**
 * Serialise a variables thread for backup/later upload
 * @param {Number}      thread_id thread to refresh
 * @param {string}      title     title for the current thread
 * @param {HTMLElement} body      page for the current thread
 * @param {jQuery.Promise}
 */
VariablesFromForum.prototype.serialise_thread = function(thread_id, title, body) {

    var post_contents = [];
    var bb = this.bb;

    return bb.thread_posts( thread_id, body ).then(function(posts) {

        return $.when.apply( $, posts.map(function(post, index) {
            if ( post.post_id != '0' && !post.is_deleted ) {
                return bb.post_info(post.post_id).then(function(info) {
                    var root = $('<root><post></post></root>');
                    if ( post.title ) root.children().attr( 'title', post.title );
                    root.children().text( info.bbcode );
                    post_contents[index] = '	' + root.html() + "\n";
                });
            }
        }))
            .then(function() {
                var root = $('<root><thread></thread></root>');
                root.children()
                    .attr( 'id'   , thread_id )
                    .attr( 'title', title )
                    .html( '\n' + post_contents.filter(function(post) { return post }).join('') )
                ;
                return root.html().replace(/&nbsp;/g, '&#xA0;');
            });

    });

}
