/**
 * @file Manage a form that builds a set of keys
 * @author Andrew Sayers
 */

/**
 * @summary Manage a form that builds a set of keys
 * @param {BulletinBoard} bb       Bulletin board to retrieve data from
 * @param {jQuery}        form     Form to manage
 * @param {function}      callback Called when the form changes or is submitted
 * @return {jQuery} form
 *
 * @description Automatically populates certain values in a form (e.g. suggesting "user" and "thread" completions),
 * and builds a set of keys based on the inputs, in a format that can be passed to Variables.resolve()
 */
function form_keys( bb, form, callback ) {

    function call_callback( event ) {
        var keys = {}, list = [];
        function add(name, value) {
            if ( !keys.hasOwnProperty(name) ) keys[ name ] = [];
            keys[ name ].push( value );
        }
        form.find('input').each(function() {
            var name = this.name, value = this.value;
            if ( value == '' ) return;
            if ( $(this).is('.user,.thread,.post') ) {
                if ( value == '' ) return;
                value = value.replace(/^\s*([0-9]+)\s*$/, this.className.replace(/.*\b(user|thread|post)\b.*/, "$1") + ' #$1' );
                var data_value = $(this).data( 'value' );
                list.push({ element: this, text: value, value: data_value });
                if ( typeof(data_value) == 'undefined' ) return;
                var title, link;
                switch ( this.className.replace(/.*\b(user|thread|post)\b.*/, "$1") ) {
                case   'user': title = 'username'; link = '[URL="'+location.origin+bb.url_for.user_show({ user_id: data_value }) + '"]'+value+'[/URL]'; break;
                case 'thread': title = 'thread'  ; link = '[thread='+ data_value + ']' + value + '[/thread]'; break;
                case   'post': title = 'post'    ; link = '[post='+ data_value + ']' + value + '[/post]'; break;
                }
                keys[title               ] = [value];
                keys[title + ' with link'] = [link];
                add( title + 's', value );
                add( title + 's with links', link );
                add( name, value );
                add( name + ' with links', link );
                add( name + ' with link', link );
                add( name + ' values', data_value );
            } else {
                add(name, value);
            }
        });
        return callback(keys, list, event);
    }

    function update_element( element, value ) {
        if ( value === null ) {
            element.attr( 'data-blocked', 'blocked' );
            form.find('[type="submit"]').prop( 'disabled', true );
            element.removeData( 'value' );
        } else {
            element.removeAttr( 'data-blocked' );
            element.data( 'value', value );
        }
    }

    var type_handlers = {
          user: function(val) { return bb.  users_complete( val ).then(function(vals) { return vals.map(function(val) { return { name: val.username, value: val.  user_id } }); }) },
        thread: function(val) { return bb.threads_complete( val ).then(function(vals) { return vals.map(function(val) { return { name: val.title   , value: val.thread_id } }); }) },
          post: function(   ) { var dfd = new jQuery.Deferred(); dfd.resolve([]); return dfd.promise() }
    };

    var timeout, known = {
          user: {},
        thread: {},
          post: {}
    };

    return form

        // Create and destroy multiple inputs:
        .on( 'blur', '.multi:not(:last-child) input', function() {
            if ( $(this).val() == '' ) {
                // remove empty inputs, except the last one
                $(this).closest('.multi').remove();
            }
        })
        .on( 'input change', '.multi:last-child input', function() {
            if ( $(this).val() != '' ) {
                // remove empty inputs, except the last one
                $(this).closest('.multi')
                    .clone()
                    .insertAfter($(this).closest('.multi'))
                    .find('input').val('')
                ;
            }
        })

        // Handle inputs that switch type:
        .on( 'change', '.switch', function() {
            var type = $(this).val().toLowerCase();
            $(this).closest('tr').find('input')
                .attr( 'class', type )
                .attr( 'list' , 'mod-friend-data-for-' + type );
        })

        // Handle common input types:
        .on( 'input change', '.user,.thread,.post', function() {

            var $this = $(this), text = $this.val(), select = $(this).closest('.multi').find('select');

            // special case for the empty string
            if ( text == '' ) {
                update_element( $this, '' );
                return;
            }

            // set type and value by URL
            var url_data = bb.url_decode( text );
            if ( url_data ) {
                select.val(
                    select.children('option').filter(function() { return $(this).text().toLowerCase() == url_data.type }).text()
                );
                $this.attr( 'class', url_data.type ).attr( 'list' , 'mod-friend-data-for-' + url_data.type );
                $this.val( url_data.type + ' #' + url_data.args[url_data.type+'_id'] );
                update_element( $this, url_data.args[url_data.type+'_id'] );
                return;
            }

            // set type and value by predefined string
            if ( text.replace( /^\s*(user|thread|post)?\s*#*([0-9]+)\s*$/i, function( text, type, id ) {
                if ( type ) {
                    type = type.toLowerCase();
                    select.val(
                        select.children('option').filter(function() { return $(this).text().toLowerCase() == type }).text()
                    );
                    $this.attr( 'class', type ).attr( 'list' , 'mod-friend-data-for-' + type );
                }
                update_element( $this, id );
                return '';
            }) != text ) {
                return;
            };

            // guess value
            var datalist = $( '#' + $this.attr('list') ), type = this.className.replace(/.*\b(user|thread|post)\b.*/, "$1"), known_things = known[type];
            update_element( $this, known_things.hasOwnProperty(text.toLowerCase()) ? known_things[text.toLowerCase()] : null );
            if ( timeout ) clearTimeout(timeout);
            timeout = setTimeout(function() {
                type_handlers[type]( text ).then(function(values) {
                    timeout = null;
                    values.forEach(function(value) {
                        if ( !known_things.hasOwnProperty(value.name.toLowerCase()) ) {
                            datalist.append( $('<option>').text(value.name) );
                            known_things[value.name.toLowerCase()] = value.value;
                            if ( value.name.toLowerCase() == text.toLowerCase() ) {
                                update_element( $this, value.value );
                                call_callback();
                            }
                        }
                    });
                });
            }, 500 );

        })

        // Manage the submission process:
        .on( 'input change', function() {
            form.find('[type="submit"]').prop( 'disabled', !!form.find('[data-blocked]').length );
            call_callback();
        })

        .on( 'submit', function(event) {
            return !form.find('[data-blocked]').length && call_callback(event);
        });

}
