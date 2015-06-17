/**
 * @file Duplicate username list
 * @author Andrew Sayers
 * @summary Select a list of accounts you believe to be duplicates for the same user
 */

/**
 * @summary Select a list of accounts you believe to be duplicates for the same user
 * @constructor
 * @extends Widget
 * @param {Object} args duplicate account arguments
 * @example
 *
 * var dupe_list = new DuplicateAccountList({
 *
 *     required: [{ username: ..., user_id: ..., email: ..., notes: ... }, ...], // Accounts that must be included in the list
 *     default : [{ username: ..., user_id: ..., email: ..., notes: ... }, ...], // Accounts that will be suggested by default
 *
 *     show_heatmap: false, // if true, the "required" and "default" lists must include info and mod_info
 *
 *     // other data needed for the list to function:
 *     bb          : bb, // BulletinBoard object
 *     v           : v, // Variables object
 *     callback    : function(users) { ... }, // called with the current data
 *     container   : dupes_appended_to_this,
 *     loading_html: 'loading...',
 *
 * });
 */
function DuplicateAccountList( args ) {

    // we need to handle the callback specially:
    var callback = args.callback;
    delete args.callback;

    Widget.call( this, args, 'duplicate_account_list' );

    if ( !DuplicateAccountList.css_added ) {
        DuplicateAccountList.css_added = true;
        $("head").append(
            "<style type='text/css'>" +
                args.v.parse( BabelExt.resources.get('res/widgets/duplicate_account_list.css'), args.bb.css_keys() ) +
            "</style>"
        );
    }

    var dupes = this;

    this.bb           = args.bb;
    this.v            = args.v;
    this.user_info    = {};
    this.show_heatmap = args.show_heatmap;
    this.loading_html = args.loading_html;
    this.li_template  = this.element.find('li').detach();
    if ( args.required && args.required.length ) {
        this.account_highlighter = new AccountHighlighter({ v: args.v, source_username: args.required[0].username.replace( /\s/g, '\u00A0' ), source_address: args.required[0].email });
    } else {
        this.account_highlighter = new AccountHighlighter({ v: args.v, source_username: '', source_address: '@' });
    }

    if ( this.show_heatmap ) this.element.addClass('heatmap');

    // make sure there's a <datalist> for us:
    var list_id = this.element.find('.user').attr('list');
    if ( $('#'+list_id).length == 0 ) {
        $('<datalist id="' + list_id + '"><option></option></datalist>').appendTo(document.body);
    }

    this.val(args);

    var primary_user_id = args.required ? args.required[0].user_id : 0, old_list_length = -1;

    var user_table = this.element.children('table');
    form_keys( args.bb, user_table, function(keys, list) {
        var callback_needed = false, callback_list = [];
        if ( !user_table.find('[name="primary-username"]:checked').length )
            user_table.find('[name="primary-username"]').first().prop( 'checked', true );
        var new_primary_user_id = user_table.find('[name="primary-username"]:checked').closest('tr').data('dupe-account-current');
        if ( primary_user_id != new_primary_user_id ) {
            primary_user_id = new_primary_user_id;
            callback_needed = true;
        }
        list.forEach(function(item) {
            var row = $(item.element).closest('tr');
            if ( item.value ) {
                row.removeClass('dupe-unknown');
                callback_needed |= dupes._set_row( row, $.trim(item.text), item.value );
                callback_list.push( row.data('dupe-account-val') );
                callback_list[callback_list.length-1].is_primary = callback_list[callback_list.length-1].user_id == primary_user_id;
            } else {
                row.   addClass('dupe-unknown');
            }
        });
        if ( old_list_length != list.length ) {
            old_list_length = list.length;
            callback_needed = true;
        }
        if ( callback_needed && callback ) {
            callback(
                $(user_table).find('.required').map(function() {
                    var ret = $(this).data('dupe-account-val');
                    ret.is_primary = ret.user_id == primary_user_id;
                    return ret;
                }).get().concat( callback_list )
            );
        }
        return false; // prevent form submission
    });

    // INITIALISE THE POPUP

    var popup = this.element.find('.timeline-popup');
    function hide_popup() {
        if ( !$(this).closest('.timeline-popup').length ) {
            popup.hide();
            $(document.body).off( 'click', hide_popup );
        }
    };
    popup.find('.close').click(function(event) {
        popup.hide();
        $(document.body).off( 'click', hide_popup );
        event.preventDefault();
    });
    popup.on( 'click', 'a', function(event) {
        this.href.replace( /#event-[0-9]*/, function(event) {
            $(event).data('collapse').val(false);
        });
    });

    this.element.find('.timeline').on( 'click', 'a.mod-team-events', function(event) {
        var $this = $(this);

        popup.find('.header span:first-child').text($this.attr('title'));
        popup.find('.body').children().detach();
        popup.find('.body').append($this.data('popup-body'));

        var position = $this.position();
        position.top += $this.outerHeight();
        popup.css(position).show();
        setTimeout(function() { $(document.body).click(hide_popup) }, 0);

        event.preventDefault();
    });

}

DuplicateAccountList.prototype = Object.create(Widget, {
    bb                 : { writable: true, configurable: false },
    v                  : { writable: true, configurable: false },
    user_info          : { writable: true, configurable: false },
    account_highlighter: { writable: true, configurable: false },
    loading_html       : { writable: true, configurable: false },
    li_template        : { writable: true, configurable: false },
});
DuplicateAccountList.prototype.constructor = DuplicateAccountList;

// Set the elements in a <tr>, return true if the element has changed value:
DuplicateAccountList.prototype._set_row = function( row, username, user_id, first_user ) {

    row.find('.member').attr( 'href', this.bb.url_for.user_show({ user_id: user_id }) );

    if ( row.data('dupe-account-current') == user_id ) return false;

    if ( this.user_info.hasOwnProperty(user_id) ) {

        var user = this.user_info[user_id];
        if ( this.show_heatmap ) {
            row.find('.heatmap').html( this.loading_html );
            var dupes = this;
            $.when( user.post_promise, user.note_promise ).then(function(posts, notes) { dupes._heatmap( row.find('.heatmap'), user.info, posts, notes ) });
        }
        row
            .data('dupe-account-current', user_id)
            .removeClass( 'dupe-loading' );
        row.find('.email-user a,.at a,.email-domain a'  ).attr( 'href', 'mailto:' + user.email );
        row.find( '.notes' ).html( user.notes ).find('time').timeago();
        if ( first_user ) {
            var email = user.email.split('@');
            row.find('.member'        )        .text( username.replace( /\s/g, '\u00A0' ) );
            row.find('.email-user a'  )        .text( email[0] );
            row.find('.email-domain a').first().text( email[1] );
        } else {
            this.account_highlighter.highlight_to_element(
                username.replace( /\s/g, '\u00A0' ),
                user.email,
                row.find('.member'),
                row.find('.email-user a'  ),
                row.find('.email-domain a').first()
            );
        }

    } else {

        var dupes = this;
        row.addClass( 'dupe-loading' );
        var post_promise = this.show_heatmap && this.bb.user_posts(user_id, true);
        var note_promise = this.show_heatmap && this.bb.user_notes(user_id);
        $.when(
            this.bb.user_info(user_id),
            this.bb.user_moderation_info(user_id)
        ).then(function( user_info, user_moderation_info ) {
            dupes.user_info[user_id] = {
                email: user_moderation_info.email,
                notes: user_info.infraction_summary + ' ' + user_moderation_info.summary,
                info: user_info,
                moderation_info: user_moderation_info,
                post_promise: post_promise,
                note_promise: note_promise,

            };
            dupes._set_row( row, username, user_id );
        });

    }

    row.data( 'dupe-account-val', { username: username, user_id: user_id } );

    return true;

}

/**
 * @summary Get/set widget's values
 * @param {Object} value new value
 * @return {Object} (new) value
 * @example
 *
 * ns.val({
 *     required: [{ username: ..., user_id: ... }, ...], // Accounts that must be included in the list
 *     default : [{ username: ..., user_id: ... }, ...], // Accounts that will be suggested by default
 * });
 *
 * @description if "show_heatmap" is true, the "required" and "default" lists must include info and moderation_info
 *
 */
DuplicateAccountList.prototype.val = function( value ) {

    var dupes = this;

    if ( value ) {

        var multi = this.element.find('.multi:last-child');

        var primary_defined = false;

        var bb = this.show_heatmap ? this.bb : { user_posts: function() {} };

        function update_row(user) {
            var row = multi.clone()
                .insertBefore(multi)
                .data( 'user', user );
            row.find('.user').data( 'value', user.user_id );
            dupes.user_info[user.user_id] = {
                email: user.email,
                notes: user.notes,
                info: user.info,
                moderation_info: user.moderation_info,
                post_promise: bb.user_posts(user.user_id, true),
                note_promise: bb.user_notes(user.user_id),
            };
            dupes._set_row(row, user.username, user.user_id, value.required && value.required[0] == user);
            if ( user.is_banned && !primary_defined ) {
                row.find('[name="primary-username"]').prop( 'checked', true );
                primary_defined = true;
            }
            return row;
        }

        this.element.find('tbody > tr:not(:last-child)').remove();
        ( value.required || [] ).forEach(function(user) { update_row(user).addClass('required').find('.user').replaceWith($('<span>').text(user.username.replace( /\s/g, '\u00A0' ))) });
        ( value.default  || [] ).forEach(function(user) { update_row(user)                     .find('.user')                        .val (user.username.replace( /\s/g, '\u00A0' ))  });
        if ( !primary_defined ) this.element.find('[name="primary-username"]').first().prop( 'checked', true );

    }

    return this.element.find('tr').map(function() { return $(this).data('dupe-account-val') }).get();

}

/**
 * Add a user to the list
 */
DuplicateAccountList.prototype._heatmap = function(container, info, post_list, notes) {

    var day_names = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ];

    var heatmap = [];

    // heatmap consists only of posts:
    var max = 1;
    post_list.forEach(function(post) {
        var date = post.date;
        var day = heatmap[date.getUTCDay()];
        if ( !day ) day = heatmap[date.getUTCDay()] = [];

        if ( day[date.getUTCHours()] ) {
            max = Math.max( max, ++day[date.getUTCHours()] );
        } else {
            day[date.getUTCHours()] = 1;
        }
    });

    // build the heatmap from the posts:
    var map = '';
    for ( var d=0; d!=7; ++d ) {
        var day = heatmap[d];
        var day_name = day_names[d];
        if ( day ) {
            map += '<div>'
            for ( var h=0; h!=24; ++h ) {
                var time_name = h + ':00-' + (h+1) + ':00';
                if ( day[h] ) {
                    var intensity = 255 - Math.ceil( 255 * day[h] / max );
                    map += '<div class="posts" style="background: <intensity=' + intensity + '>" title="' + day[h] + ' post(s) at ' + time_name + ' on a ' + day_name + '"></div>';
                } else {
                    map += '<div class="no-posts" title="has never posted at ' + time_name + ' on a ' + day_name + '"></div>'
                }
            }
            map += '</div>';
        } else {
            map += '<div title="(has never posted on a ' + day_name + ')"></div>'
        }
    }

    // build the event list for the user
    var username = info.username, posts = {}, infractions = [];

    var events = [
        { type: 'join'    , username: username, user_id: info.user_id, date: info.    join_date },
        { type: 'activity', username: username, user_id: info.user_id, date: info.activity_date }
    ];

    if ( post_list )
        post_list.forEach(function(post) {
            posts[post.id] = post;
            events.push({ type: 'post', username: username, target: post, date: post.date } );
        });

    if ( info.infractions )
        info.infractions.forEach(function(infraction) {
            events.push({ type: 'infraction', username: username, target: infraction, date: infraction.start_date });
        });

    if ( notes )
        notes.forEach(function(note) {
            events.push({ type: 'note', username: username, target: note, date: note.date_object });
        });

    var widget = this;
    $('<a class="user-heatmap enabled" href="#show-hide-user"></a>')
        .appendTo(container.empty())
        .data( 'events', events )
        .click(function(event) {
            var $this = $(this);
            if ( $this.hasClass('enabled') ) {
                $this.removeClass('enabled').html(map.replace( /<intensity=([0-9]*)>/g, 'rgb($1,$1,$1)'  ));
            } else {
                $this.   addClass('enabled').html(map.replace( /<intensity=([0-9]*)>/g, 'rgb($1,$1,255)' ));
            }
            widget._heatmap_update();
            event.preventDefault();
        })
        .click();

}

DuplicateAccountList.prototype._heatmap_update = function() {

    var v = this.v, bb = this.bb;

    var events = [].concat.apply( [], this.element.find('.heatmap a.enabled').map(function() { return $(this).data('events') }).get() );
    events.sort(function(a,b) { return b.date < a.date });

    var timeline = [];

    function event_info(event) {
        switch ( event.type ) {
        case 'infraction':
            var content = '<span class="infraction">infraction</span>: ' + event.target.points + ' point(s) for ' + event.target.reason + '</div>';;
            if ( event.target.notes ) {
                console.log( 'infraction with notes', event.target.notes);
            };
            return {
                header  : content,
                body    : content,
                summary : event.target.reason + ' (' + event.target.points + ')',
                username: event.target.username,
                user_id : event.target.user_id
            };
        case 'post':
            return {
                header  : event.target.thread_title,
                body    : event.target.message,
                summary : bb.post_summary(event.target),
                username: event.target.username,
                user_id : event.target.user_id
            };
        case 'note':
            return {
                header  : '<span class="note">Note</span>: ' + event.target.title,
                summary : bb.post_summary(event.target),
                body    : event.target.message,
                username: event.target.username,
                user_id : event.target.user_id
            };
        case 'join':
            return {
                header  : '<span class="join">joined</span>',
                body    : 'First recorded activity for ' + event.username,
                summary : 'joined',
                username: event.username,
                user_id : event.user_id
            };
        case  'activity':
            return {
                header  : '<span class="active">last activity</span>',
                body    : 'Most recent recorded activity for ' + event.username,
                summary : 'Most recent activity',
                username: event.username,
                user_id : event.user_id
            };
        default:
            return;
        }
    }

    function display_hour(hour_events, year, month, day, hour) {
        // Generate HTML to display all events that occurred this hour

        var event_types = {}, popup_body = $('<ul>');
        hour_events.forEach(function(event) {
            if ( !event_types[event.type] ) event_types[event.type] = [];
            event_types[event.type].push(event);
            if ( event.type == 'nearby' ) {
                var event = events[event.event], info = event_info(event);
                if ( info )
                    $('<li class="' + event.type + '"><span></span><a></a></li>').appendTo(popup_body)
                        .children('a')
                        .attr( 'href', location.toString().replace( /#.*/, '' ) + '#event-' + event.index )
                        .text( event.username + ': ' + info.summary );
            }
        });

        // if there is an infracted post at this time, act as if there is an infraction too:
        if ( !event_types.infraction && ( event_types.post || [] ).filter(function(post) { return post.infraction }).length )
            event_types.infraction = [];

        var ret = $('<a class="mod-team-events" href="#events-' + event_types.nearby.map(function(event) { return event.event }).join() + '"></a>');
        ret
            .attr( 'title', h+':00-'+(h+1)+':00, ' + (d+1) + ' ' + month_names[m] + ' ' + (2000+y) )
            .data( 'popup-body', popup_body )
        ;

        if      ( event_types.infraction ) ret.addClass('infraction');
        else if ( event_types.post       ) ret.addClass('post');
        else if ( event_types.note       ) ret.addClass('note');
        else if ( event_types.join       ) ret.addClass('join');
        else if ( event_types.activity   ) ret.addClass('active');

        return ret;
    }

    events.forEach(function(event, index) {
        var date = event.date;

        event.index = index;

        var min_offset = 0, max_offset=1;
        for ( var day_offset=min_offset; day_offset!=max_offset; ++day_offset )
            for ( var hour_offset=min_offset; hour_offset!=max_offset; ++hour_offset ) {
                var odate = new Date( date );
                odate.setDate ( odate.getDate () +  day_offset );
                odate.setHours( odate.getHours() + hour_offset );
                var node = timeline;
                [ odate.getUTCFullYear() - 2000, odate.getUTCMonth(), odate.getUTCDate()-1, odate.getUTCHours() ].forEach(function(index) {
                    if ( !node[index] ) node[index] = [];
                    node = node[index];
                });
                node.push({ type: 'nearby', event: index });
                if ( !day_offset && !hour_offset ) node.push(event);
            }

    });

    var month_names = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];

    var cell_width = 4;

    var calendar = (
        this.element.find('.timeline')
            .data( 'events', events )
            .html( '<div class="timeline-container"><div class="user-timeline"></div>' )
            .find('.user-timeline')
    );
    var width = cell_width, started = false, now = new Date();
    for ( var y=0; y!=timeline.length; ++y ) {
        var year = timeline[y];
        if ( !year && !started ) continue;
        started = true;
        var year_element = $('<div></div>').appendTo(calendar);
        for ( var m=0; m!=12; ++m ) {
            var date = new Date(2000+y, m+1, 0);
            if ( date > now ) break;
            var day_count = date.getDate();
            var month_element = $('<div><span>' + month_names[m] + " '" + y + '</span><div class="month-marker"></div></div>').appendTo(year_element);
            if ( year ) {
                var month = year[m];
                if ( month )
                    for ( var d=0; d!=day_count; ++d ) {
                        var day = month[d];
                        var day_element = $('<div></div>').appendTo(month_element);
                        if ( day )
                            for ( var h=0; h!=24; ++h ) {
                                var hour = day[h];
                                if ( hour )
                                    day_element.append(display_hour(hour, y, m, d, h));
                                else
                                    day_element.append('<div></div>');
                            }
                    }
            }
        }
    }

    var li_template = this.li_template, lis = [];

    events.forEach(function(event) {
        var info = event_info(event);
        if ( !info ) return;

        var li = li_template.clone().attr( 'id', 'event-' + event.index );
        li.find('.postdate').addClass('mod-friend-event-' + event.type);
        li.data( 'collapse', new Collapse({
            v : v,
            bb: bb,
            insertBefore: li.find('.postdate'),
            collapsed: true,
            callback: function() {
                li.toggleClass('mod-friend-collapsed')
            }
        }));
        li.find('time').attr( 'datetime', event.date ).text( event.date.toLocaleFormat().replace( /:00 /, ' ' ) );
        li.find('.username,.postuseravatar').attr( 'href', bb.url_for.user_show({ user_id: info.user_id }) );
        li.find('.username strong').text(info.username);
        li.find('.postuseravatar img').attr( 'src', bb.url_for.user_avatar({ user_id: info.user_id }) );
        li.find('.summary').text( event.username + ': ' + info.summary );
        li.find('h2').html(info.header);
        li.find('blockquote').html(info.body);

        lis.unshift(li);

    });

    this.element.find('#posts').empty().append(lis);

}
