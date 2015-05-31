/**
 * @file Thread Title Selector
 * @author Andrew Sayers
 * @summary Select a thread to merge into
 */

/**
 * @summary Select a thread title
 * @constructor
 * @extends Widget
 * @param {Object} args widget arguments
 * @example
 *
 * var selector = new ThreadTitleSelector({
 *     target_thread_id  : 1234, // initial target thread ID
 *     target_forum_id   : 12, // initial target forum ID
 *     target_thread_desc: 'initial target name',
 *     mode              : 'edit', // or 'merge' to pick a merge target by title
 *
 *     thread_id  : 2345, // current thread ID
 *     forum_id   : 23, // current forum ID
 *     bb         : bb, // BulletinBoard object
 *     ss         : ss, // SharedStore object
 *     callback   : function(keys) { ... }, // called with the current data
 *     container  : notification_appended_to_this,
 * });
 *
 */
function ThreadTitleSelector( args ) {

    var widget = this;
    var callback = args.callback;
    delete args.callback; // disable default handling

    this.datalist = $('#thread_title_selector_datalist');

    this.title_to_data = {};
    this.   id_to_data = {};
    this.thread_id = args.thread_id;

    if ( !this.datalist.length ) {
        this.datalist = $('<datalist id="thread_title_selector_datalist"></data>').appendTo(document.body);
        $.when( args.bb.threads_recent() ).then(function(recent) {
            recent.forEach(function(target) { widget._add(target.thread_id, target.name, target.forum_id ) });
        });
    }

    Widget.call( this, args, 'thread_title_selector' );

    var input = this.element.children('input');
    var  edit_attrs = { title: input.attr(       'title' ), placeholder: input.attr(       'placeholder' ) };
    var merge_attrs = { title: input.data( 'merge-title' ), placeholder: input.data( 'merge-placeholder' ) };

    var next_callback_id = 0, prev_callback_thread_id = NaN;

    function call_callback(value, callback_id) {
        if ( callback_id != next_callback_id ) return;
        if ( value ) {
            widget.check(value.thread_id).then(function(error) {
                if ( callback_id != next_callback_id ) return;
                if ( error && error != 'closed' ) {
                    widget.value.target_thread_id   = null;
                    widget.value.target_thread_desc = null;
                    widget.value.target_forum_id    = null;
                    if ( callback ) callback(null);
                } else if ( prev_callback_thread_id != value.thread_id ) {
                    prev_callback_thread_id = value.thread_id;
                    widget.value.target_thread_id   = value.thread_id;
                    widget.value.target_thread_desc = value.thread_desc;
                    widget.value.target_forum_id    = value.forum_id;
                    if ( callback ) callback(value);
                }
            });
        } else {
            widget.value.target_thread_id   = null;
            widget.value.target_thread_desc = null;
            widget.value.target_forum_id    = null;
            if ( callback ) callback(value);
        }
    }

    var searched_thread_descs = {}, search_timeout, value_timeout;
    input.on( 'input change', function(event) {
        widget.element.removeClass('closed old self missing');
        var value = $.trim(this.value.toLowerCase());
        if ( widget.value.mode == 'merge' ) {
            input.attr( merge_attrs );
            var target_thread = null;
            if ( widget.title_to_data.hasOwnProperty(value) ) {
                call_callback( widget.title_to_data[value], ++next_callback_id );
            } else if ( value.toLowerCase() == '(this thread does not exist)' ) {
                widget.element.addClass('missing');
                call_callback(null, ++next_callback_id);
            } else {
                value.replace( /^\s*(?:.*\/showthread.php\?t=|.*\[thread=)?([0-9]{4,})/, function(value, thread_id) {
                    if ( value_timeout ) clearTimeout(value_timeout);
                    ++next_callback_id;
                    value_timeout = setTimeout(function() {
                        widget._set( parseInt(thread_id, 10) );
                        value_timeout = null;
                    }, 500 );
                    value = null;
                });
                if ( !value ) return;
                var element = this;
                if ( search_timeout ) clearTimeout(search_timeout);
                search_timeout = setTimeout(function() {
                    var title = $.trim(element.value.toLowerCase());
                    if (
                        title.length >= 3 &&
                        !searched_thread_descs.hasOwnProperty(title) &&
                        !widget.title_to_data.hasOwnProperty(title)
                    ) {
                        searched_thread_descs[title] = null;
                        args.bb.threads_complete( title ).then(function(vals) {
                            search_timeout = null;
                            vals.forEach(function(val) { widget._add( val.thread_id, val.title, val.forum_id ) });
                            $(element).change();
                        });
                    } else {
                        search_timeout = 0;
                    }
                }, 500 );
            }
        } else {
            input.attr( edit_attrs );
            widget.value.target_forum_id    = args.forum_id;
            widget.value.target_thread_id   = args.thread_id;
            widget.value.target_thread_desc = this.value;
            if ( callback ) callback({
                forum_id   : args.forum_id,
                thread_id  : args.thread_id,
                thread_desc: this.value
            });
        }
    });

    this.bb = args.bb;

    this.value = {
        mode              : 'edit',
        target_thread_id  : args.thread_id,
        target_thread_desc: args.thread_desc,
        target_forum_id   : args.forum_id
    };

    if ( args.thread_id ) {
        this._set( args.thread_id, args.thread_desc, args.forum_id );
    }

}

ThreadTitleSelector.prototype = Object.create(Widget.prototype, {
    bb           : { writable: true, configurable: false },
    datalist     : { writable: true, configurable: false },
       id_to_data: { writable: true, configurable: false },
    title_to_data: { writable: true, configurable: false },
    thread_id    : { writable: true, configurable: false },
});
ThreadTitleSelector.prototype.constructor = ThreadTitleSelector;

/**
 * @summary add a value to the (shared) datalist
 * @private
 * @param {Number} thread_id    thread ID
 * @param {string=} thread_desc thread title (or other description)
 */
ThreadTitleSelector.prototype._add = function( thread_id, thread_desc, forum_id ) {
    if ( typeof(thread_desc) == 'string' ) {
        this. title_to_data[thread_desc.toLowerCase()] =
            this.id_to_data[thread_id                ] =
            { thread_id: thread_id, thread_desc: thread_desc, forum_id: forum_id };
        if ( !this.datalist.find('option').filter(function() { return this.textContent == thread_desc }).length )
            this.datalist.append( $('<option>').val(thread_desc).text(thread_desc) );
        return $.Deferred().resolve().promise();
    } else if ( this.id_to_data.hasOwnProperty(thread_id) ) {
        return $.Deferred().resolve().promise();
    } else {
        var widget = this;
        return this.bb.thread_metadata(thread_id).then(function(data) {
            if ( data.valid ) {
                widget. title_to_data[data.title.toLowerCase()] =
                    widget.id_to_data[thread_id               ] =
                    { thread_id: thread_id, thread_desc: data.title, forum_id: data.forum_id };
                widget.datalist.append( $('<option>').val(data.title).text(data.title) );
            } else {
                widget.id_to_data[thread_id] = { thread_id: thread_id, thread_desc: '(this thread does not exist)', forum_id: null };
            }
        });
    }
}

/**
 * @summary set a new value
 * @private
 * @param {Number} thread_id    thread ID
 * @param {string=} thread_desc thread title (or other description)
 */
ThreadTitleSelector.prototype._set = function( thread_id, thread_desc, forum_id ) {
    var widget = this;
    if ( thread_desc === '' ) {
        widget.element.children('input').val( '' ).change();
    } else {
        return this._add( thread_id, thread_desc, forum_id ).then(function() {
            widget.element.children('input').val( widget.id_to_data[thread_id].thread_desc );
            if ( widget.value.mode == 'merge' ) {
                widget.check(thread_id).then(function(error) {
                    if ( error ) {
                        widget.value.target_thread_id   = null;
                        widget.value.target_thread_desc = null;
                        widget.value.target_forum_id    = null;
                    } else {
                        widget.value.target_thread_id   = thread_id;
                        widget.value.target_thread_desc = widget.id_to_data[thread_id].thread_desc;
                        widget.value.target_forum_id    = widget.id_to_data[thread_id].forum_id;
                    }
                    widget.element.children('input').change();
                });
            } else {
                widget.element.children('input').change();
            }
        });
    }
}

/**
 * @summary check whether the specified thread is a valid merge target
 * @param {Number} thread_id thread to check
 * @return {jQuery.Promise}
 */
ThreadTitleSelector.prototype.check = function( thread_id ) {
    if ( this.thread_id == thread_id ) {
        this.element.addClass('self');
        return $.Deferred().resolve('self').promise();
    } else if ( this.thread_id < thread_id ) {
        this.element.addClass('old');
        return $.Deferred().resolve('old').promise();
    } else {
        var widget = this;
        return this.bb.thread_metadata(thread_id).then(function(data) {
            var ret = '';
            if ( data.deleted || data.merged || !data.valid ) ret = 'missing';
            else if ( !data.open ) ret = 'closed';
            widget.element.addClass(ret);
            return ret;
        });
    }
}

/**
 * @summary Give focus to this widget
 */
ThreadTitleSelector.prototype.focus = function() {
    this.element.children('input').focus();
}

/**
 * @summary Get/set widget's value
 * @param {Object} value new value
 * @return {Object} (new) value
 * @example
 *
 * widget.val({
 *     mode: 'merge', // or 'edit'
 *     target_thread_id  : 1234,
 *     target_thread_desc: 1234,
 * });
 *
 */
ThreadTitleSelector.prototype.val = function( value ) {

    if ( value ) {
        Widget.prototype.val.call( this, value );
        if ( value.hasOwnProperty('mode') ) {
            if ( value.mode == 'merge' )
                this.element.children('input').attr( 'list', 'thread_title_selector_datalist' );
            else
                this.element.children('input').removeAttr( 'list' );
        }
        if ( value.hasOwnProperty('target_thread_id') ) {
            this._set( value.target_thread_id, value.target_thread_desc, value.target_forum_id );
        } else {
            this.element.children('input').change();
        }
    }

    return $.extend( Widget.prototype.val.call(this), {
        thread_desc: this.element.children('input').val(),
    });

}
