(function(localStorage) { // note: we pass in a 'localStorage' variable because Firefox extensions can't use the real localStorage directly

    /*
     * MISCELLANEOUS VARIABLES
     */
    var
        user_id = location.search.match(/&u=([0-9]*)/),
        check_user_note_checkbox
    ;
    if ( user_id ) user_id = user_id[1];

    /*
     * TEMPLATE DATA
     *
     * Moderators have to send a lot of similar posts, so defining templates makes life a lot easier:
     */

    function param_to_template(param) {
        if ( location.search.search( '&' + param + '=' ) == -1 ) return '<<' + param.toUpperCase() + '>>';
        return decodeURIComponent( location.search.replace( new RegExp( '.*&' + param + '=([^&]*).*' ), "$1" ) );
    }

    var template_replacements = {
            PM_HEADER        : "Hi.",
            PM_FOOTER        : "Best regards,\nFrontier Moderation Team.",
            PROBLEM          : param_to_template('problem'),
            POST_ID          : param_to_template('post_id'),
            STATUS           : param_to_template('status' ),
            'NEXT WEEK'      : (new Date()).toGMTString().replace(/:[0-9][0-9] /, ' ' ),
            'SIGNATURE RULES': "[QUOTE=Forum Rules;421867][B]SIGNATURE RULES AND LIMITATIONS[/B]\n\n[LIST]\n[*]Maximum image file size limit limited to 250KB.\n[*] Maximum allowed images per user signature is one.\n[*]Animated images (eg: gif image or banner rotators) are [I]not[/I] allowed.\n[*][B]Maximum width[/B] of an image is 650 pixels.\n[*][B]Maximum height[/B] of an image is 150 pixels.\n[*]Maximum allowed lines of normal sized text per signature is [B]five[/B]. \n[*]If text lines are added to a sig they cannot be made larger than the default size.\n[*]Lines are not allowed to wrap else they count as additional lines\n[LIST]\n[*]If an image is added to a signature, and the image is up to 650x150, maximum lines permitted is zero\n[*]If an image is added to a signature, and the image is up to 650x120, maximum lines permitted is one\n[*]If an image is added to a signature, and the image is up to 650x90, maximum lines permitted is two\n[*]If NO image is added to a signature, maximum lines of text permitted is five.\n[*]Quote, code, and/or special bbcode that consumes lines of text, count as two lines each.\n[*]Links do not count as special bbcodes but must adhere to the links rules\n[*]Empty lines of text count as a line / additional line to a signature.\n[/LIST]\n[/LIST][/QUOTE]",
            'LANGUAGE RULES' : "[QUOTE=Forum Rules;421867][B]No Abuse or Disrespectful Behaviour[/B]\nThe following forum rules are in place to promote the Frontier forums as a safe, friendly and welcoming place for the community. Discussions and debates are greatly welcomed. However, not at the expense of common sense and decency, as exemplified by the rules below.\n\n[b]You agree to not:[/b]\n[LIST][*]Be insulting to any person via obscene, offensive, hateful or inflammatory comments via the means of private messages, public messages and visitor messages in order to bait, harass, and lure other users into responding. This is also known as trolling or flame-baiting.\n[*]Derail an ongoing discussion topic, forcing it to another type of discussion.\n[*]Use sexually explicit or harmful language including the use of misspelled or punctuated words to insinuate, represent any of the above - also known as \"masked swearing\". This includes words that are blocked by the automatic filter, swearing is not allowed in posts.\n[*]Utilize symbols or other non-normal ASCII English letters to mask out a swear word. If a word is filtered, then it's filtered, don't evade it.\n[*]Partake in personal arguments with other members of the community on the forums. If you have problems with other members either resolve your issues in private via PM or email, or use the \"Ignore\" feature of the bulletin board system in order to ignore that person.\n[*]Promote discrimination based on race, sex, religion, nationality, disability, sexual orientation, age or other criteria that offends other users.\n[*]Use the discussion board features to call out individuals or groups in thread titles, polls and/or posts to simply demean or insult them. Commonly known as bandwagoning. \n[/LIST][/QUOTE]"
        },
        template_posts = [ // we use an array here to control the order they're displayed in
            {
                id: 'bad_signature',
                title: 'Please bring your signature into line with forum rules',
                body: "<<PM_HEADER>>\n\nThis is a friendly request to bring your signature in line with the forum rules.  Your signature has <<PROBLEM>> - could you modify it to comply with the rules quoted below?\n\n<<SIGNATURE RULES>>\n\nPlease modify your signature within 7 days (i.e. by <<NEXT WEEK>>) - we're required to issue an official warning if it's still in violation after that time.\n\n<<PM_FOOTER>>",
                copy_to_user_note: 1,
            },

            {
                id: 'masked_swearing',
                title: 'Please avoid inappropriate language',
                body: "<<PM_HEADER>>\n\nThis is a friendly reminder that you should rephrase sentences to avoid the need for filtered words, instead of leaving words masked or trying to work around the filter.  The filter is simply a reminder to keep things family-friendly before manual moderation is required.\n\n[post=<<POST_ID>>]Your message[/post] has now been edited to comply with forum rules.  Please be very careful if you re-edit the post - avoiding the problem phrase altogether is fine, but a second moderation will almost certainly be an automatic infraction.  For your reference, the rules on inappropriate language are quoted below.\n\n<<LANGUAGE RULES>>\n\n<<PM_FOOTER>>",
                copy_to_user_note: 1,
            },

            {
                id: 'report_take',
                title: "I'm on it",
                body: "I'm on it",
            },

            {
                id: 'report_update',
                title: "Update",
                body: 'Current action:\n\n[list]\n[*]\n[*]updated user notes\n[/list]\n\nCurrent status: <<STATUS>>'
            }

        ],
        template_post_overrides = JSON.parse( localStorage.getItem( 'moderation-template_posts' ) || '{}' )
    ;

    /*
     * CROSS-PAGE ACTIONS
     *
     * Sometimes it's useful to perform an action based on the page you just came from
     * (e.g. reviewing a post after creating it)
     *
     * To create a new cross-page action:
     *
     * 1. Add it to the 'cross_page_actions' hash below
     * 2. Optionally add a cross_page_failure action to fire if the normal action doesn't fire
     * 3. call on_next_page( 'action_name', arg1, arg2, arg3 ), where the arguments will be passed to your action
     *
     */

    var
        cross_page_actions = {

            copy_to_user_note: function( text, title, security_token ) {
                $.ajax({
                    type: "POST",
                    url: 'http://forums.frontier.co.uk/usernote.php',
                    data: {
                        'do'           : 'donote',
                        'message'      : text,
                        'parseurl'     : 1,
                        'title'        : title,
                        'u'            : user_id,
                        'securitytoken': security_token
                    },
                    error: function() {
                        alert('Could not copy PM to user note - please copy it over manually.');
                    }
                });
            },

            set_user_id: function( _user_id ) { if (!user_id) user_id = _user_id; },
            check_user_note_checkbox: function() { check_user_note_checkbox = true; }

        },
        cross_page_failure_actions = {
            copy_to_user_note: function() { alert( 'Failed to copy message to user note - please copy it manually.' ); },
        },
        cross_page_data = JSON.parse( localStorage.getItem( 'moderation-cross_page_data' ) || '[]' )

    ;

    for ( var n=0; n!=cross_page_data.length; ++n ) {
        var cross_page_datum = cross_page_data[0];
        if ( (new Date()).getTime() < cross_page_datum.time ) {
            if ( document.referrer && document.referrer == cross_page_datum.referrer ) {
                cross_page_data.splice(n--, 1);
                cross_page_actions[cross_page_datum.action].apply( this, cross_page_datum.args );
            }
        } else {
            cross_page_data.splice(n--, 1);
            if ( cross_page_failure_actions[cross_page_datum.action] )
                cross_page_failure_actions[cross_page_datum.action]();
        }
    }
    localStorage.setItem( 'moderation-cross_page_data', JSON.stringify(cross_page_data) );

    function on_next_page( action ) {
        cross_page_data.push({
            referrer: window.location.toString(),
            time    : new Date().getTime() + 10000,
            action  : action,
            args    : Array.prototype.slice.call(arguments, 1),
        });
        localStorage.setItem( 'moderation-cross_page_data', JSON.stringify(cross_page_data) );
    }

    /*
     * MAIN SECTION
     *
     * Runs after jQuery has loaded
     */

    var i = setInterval( function() {
        if ( window.jQuery ) {
            clearInterval(i);

            /*
             * POST TEMPLATES
             */
            if (
                   window.location.pathname == '/private.php'
                || window.location.pathname == '/newreply.php'
            ) {
                /*
                 * ADD ELEMENTS TO FORM
                 */
                var select_box = $('<select><option value="">Pick a template</option></select>').insertBefore('table.fieldset'),
                    edit_box = $('<form style="display: none; position: fixed; width: 40em; margin-left: -20em; margin-top: -12em; left: 50%; top: 50%; border: 2px solid black; background: #cde; padding: 1em"><input type="hidden" name="id"><input style="width: 99%" name="new_title"><textarea style="width: 99%; height: 20em" name="new_body"></textarea><br><input type="submit" value="OK"><input type="submit" value="Cancel"></form>').appendTo(document.body)
                ;
                edit_box.submit(function(event) {
                    if ( !$("input[value=Cancel]:focus", this).length ) {
                        template_post_overrides[ $('[name=id]',this).val() ] = {
                            title: $('[name=new_title]',this).val(),
                            body : $('[name=new_body]' ,this).val()
                        };
                        localStorage.setItem( 'moderation-template_posts', JSON.stringify(template_post_overrides) );
                    }
                    $(this).hide();
                    event.preventDefault();
                });
                select_box.change(function() {
                    $('[name=title]'      ).val (           select_box.find(':selected').text()                    );
                    $('#copy_to_user_note').prop('checked', select_box.find(':selected').data('copy_to_user_note') );
                    var text = select_box.find(':selected').val();
                    for ( var replacement in template_replacements ) if ( template_replacements.hasOwnProperty(replacement) ) {
                        text = text.replace( '<<' + replacement + '>>', template_replacements[replacement] );
                    }
                    $('#vB_Editor_001_textarea').val( text );
                });
                if ( user_id ) { // copy to user_note
                    select_box.after( '<label style="display: block"><input type="checkbox" id="copy_to_user_note">Copy message to user note for user ' + user_id + '</label>' );
                    if ( check_user_note_checkbox ) $('#copy_to_user_note').prop( 'checked', true );
                    $('#vB_Editor_001_save').closest('form').submit(function() {
                        on_next_page( 'set_user_id', user_id );
                        on_next_page( 'check_user_note_checkbox' );
                        if ( !$("input[name=preview]:focus", this).length && $('#copy_to_user_note').prop('checked') )
                            on_next_page( 'copy_to_user_note', $('#vB_Editor_001_textarea').val(), $('[name=title]').val(), $('input[name="securitytoken"]').val() );
                    });
                }
                $( '<a style="color: blue" href="#edit_template">edit template</a>' )
                    .insertAfter(select_box)
                    .click(function() {
                        if ( select_box.find(':selected').data('id') ) {
                            edit_box.show();
                            edit_box.find( '[name=new_title]' ).val( select_box.find(':selected').text() );
                            edit_box.find( '[name=new_body]'  ).val( select_box.find(':selected').val () );
                            edit_box.find( '[name=id]'        ).val( select_box.find(':selected').data('id') );
                        } else {
                            alert('please pick a template to edit');
                        }
                    });

                if ( location.search.search( '&cb_openclose=1' ) != -1 )
                    $('#cb_openclose').prop('checked', true);

                /*
                 * ADD TEMPLATES
                 */
                for ( var n=0; n!=template_posts.length; ++n ) {
                    var template_post = template_posts[n],
                        override_post = template_post_overrides[template_post.id]
                    ;
                    if ( override_post ) {
                        template_post.title = override_post.title;
                        template_post.body  = override_post.body ;
                    }
                    $('<option>').appendTo( select_box )
                        .text( template_post.title )
                        .val( template_post.body )
                        .data( 'id', template_post.id )
                        .data( 'copy_to_user_note', template_post.copy_to_user_note ? true : false )
                    ;
                    if ( location.search.search( '&template=' + template_post.id ) != -1 ) {
                        select_box.val( template_post.body ).change();
                    };
                }

            };

            /*
             * MODERATION TOOLS SECTION ON THREAD PAGES
             */

            var violators = {},
                report_block = $('<div style="padding: 10px"><table width="100%" cellspacing="1" cellpadding="6" border="0" align="center" class="tborder"><thead><tr><td class="thead" style="color: white">Moderation report</td></tr></thead><tbody><tr><td style="color: white">Recent threads in <a href="http://forums.frontier.co.uk/forumdisplay.php?f=48">the reported posts forum</a></td></tr><tr><td width="100%" class="alt1" id="mod_tools_container"></td></tr><tr><td><table style="width: 100%" id="threadbits_forum_48_container"></table></td></tr><tr><td style="color: white">Most recent post in <a href="http://forums.frontier.co.uk/showthread.php?t=24499&goto=newpost">the moderation thread</a></td></tr><tr><td id="last_post_container"></td></tr></table></div>').insertAfter( '#posts' ).find( '#mod_tools_container' ).last();
            $('#threadbits_forum_48_container').load( 'http://forums.frontier.co.uk/forumdisplay.php?f=48 #threadbits_forum_48', function() {
                var $this = $('#threadbits_forum_48');
                $this.children("tr").slice(5).remove();
            });
            $('#last_post_container').load( 'http://forums.frontier.co.uk/showthread.php?t=24499&goto=newpost [id^=edit]:last', function() {
                $('#last_post_container div.normal:nth(1)').attr( 'style', 'color: white' );
            });

            var first_post_in_reported_post_forum = -1;
            if ( $('table.tborder').eq(0).has( 'a[href="forumdisplay.php?f=48"]' ).length ) {
                var newreply = $('a[href^=newreply]').eq(0);
                newreply.after( '<span style="font-size: 200%"> - <a href="' + newreply.attr( 'href' ) + '&template=take_post&template=report_take">take this report</a> - <a href="' + newreply.attr( 'href' ) + '&template=take_post&template=report_update&status=open">update this report</a> - <a href="' + newreply.attr( 'href' ) + '&template=take_post&template=report_update&status=closed&cb_openclose=1">close this report</a></span>' );
                first_post_in_reported_post_forum = ( $('table[id^=post]').first().attr( 'id' ) || '' ).substr( 4 );
            }

            $('table[id^=post]').each(
                function() {

                    /*
                     * DETECT COMMON VIOLATIONS
                     */

                    var $username = $(this).find('a.bigusername'),
                        post_id    = this.id.substr( 4 ),
                        goto_link  = ' - <a href="#' + this.id + '">view post</a>',
                        userid     = $username.attr("href").split('?u=', 2)[1],
                        body       = $( 'div[id^=post_message_]',this),
                        post_block = body.siblings().last()
                        username   = $username.text(),
                        sig_block  = body.next().not('[align=right]').not('.smallfont').not('[style="padding:6px"]'),
                        sig_image  = sig_block.find( 'img' ).not('.inlineimg'),
                        sig_text   = '{' + sig_block.text()
                            .replace( /[\t\n ]*$/, '' )
                            .replace( /^[\t\n ]/, '' )
                            .replace( /\n\tQuote:[\t\n ]*/, "Quote:\n(extra line for quote block)\n" )
                            .replace( /(\n\(extra line for quote block\)\nOriginally Posted by .*\n)[\t\n ]*/, "$1" )
                            + '}',
                        line_count = sig_text.split( "\n" ).length - 1
                    ;

                    if ( ! violators[ username ] ) violators[ username ] = {};

                    if ( sig_image[0] ) {
                        if ( sig_image.length > 1 ) violators[ username ][ 'too many images: ' + sig_image.length ] =
                            goto_link + ' - <a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+userid+'&template=bad_signature&problem=too many images (' + sig_image.length + ')">Send PM</a>';
                        if ( sig_image[0].width > 650 ) violators[ username ][ 'sig too wide: ' + sig_image[0].width + 'x' + sig_image[0].height + 'px' ] =
                            goto_link + ' - <a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+userid+'&template=bad_signature&problem=an image that is too wide (' + sig_image[0].width + 'px)">Send PM</a>';

                        if      ( sig_image[0].height > 150                    ) violators[ username ][ 'sig too tall: ' + sig_image[0].width + 'x' + sig_image[0].height + 'px' ] =
                            goto_link + ' - <a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+userid+'&template=bad_signature&problem=an image that is too tall (' + sig_image[0].height + 'px)">Send PM</a>'
                        if      ( sig_image[0].height > 120 && line_count > 2 ) violators[ username ][ 'too many lines: ' + line_count ] =
                            goto_link + ' - <a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+userid+'&template=bad_signature&problem=too many lines for your image height (' + line_count + 'lines, ' + sig_image[0].height + 'px)">Send PM</a>'
                        else if ( sig_image[0].height >  90 && line_count > 3 ) violators[ username ][ 'too many lines: ' + line_count ] =
                            goto_link + ' - <a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+userid+'&template=bad_signature&problem=too many lines for your image height (' + line_count + 'lines, ' + sig_image[0].height + 'px)">Send PM</a>'
                        else if (                              line_count > 4 ) violators[ username ][ 'too many lines: ' + line_count ] =
                            goto_link + ' - <a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+userid+'&template=bad_signature&problem=too many lines for your image height (' + line_count + 'lines, ' + sig_image[0].height + 'px)">Send PM</a>'
                    } else {
                        if      (                              line_count > 5 ) violators[ username ][ 'too many lines: ' + line_count ] =
                            goto_link + ' - <a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+userid+'&template=bad_signature&problem=too many lines (' + line_count + ')">Send PM</a>'
                    }

                    /*
                     * ADD "USER NOTES" popup
                     */

                    $(this).children( 'tbody' ).children( 'tr' ).last().find('.smallfont').first()
                        .before( '<div style="cursor: pointer; text-decoration: underline; float: right" id="user-notes-' + userid + '" onclick="javascript:get_user_notes(' + userid + ')">View User Notes</div><div style="float: right; width: 2ex; text-align: center"> - </div><a style="float: right" href="http://forums.frontier.co.uk/usernote.php?do=newnote&u=' + userid + '">Post New User Note</a>' )
                    ;

                    window.get_user_notes = function(user_id) {
                        $( "#user-notes-" + user_id ).removeAttr( 'style' ).removeAttr( 'onclick' ).load( '/usernote.php?u=' + user_id + ' [style="padding:0px 0px 6px 0px"]' );
                    };

                    /*
                     * ADD "REPORT POSTS FORUM" extras
                     */

                    if ( post_id == first_post_in_reported_post_forum ) {
                        var user_notes = $('<div></div>').appendTo( body ), reported_user = -1,
                            reported_post = $('a[href^="http://forums.frontier.co.uk/showthread.php?p="]').first().attr( 'href' ).split( '#post' )[1]
                        ;
                        $(this).find( 'a[href^="http://forums.frontier.co.uk/member.php"]' ).each(function() {
                            if ( reported_user != this.getAttribute( 'href' ).split( '?u=' )[1] ) { // people sometimes report their own posts
                                reported_user = this.getAttribute( 'href' ).split( '?u=' )[1];
                                $('<div><h1>User notes for ' + $(this).html() + '</h1><div style="border-left: 3px solid black; padding-left: 1em"></div></div>' )
                                    .prependTo( user_notes )
                                    .children( 'div' )
                                    .load( this.getAttribute( 'href' ).replace( 'member', 'usernote' ) + ' [style="padding:0px 0px 6px 0px"]' );
                                ;
                            }
                        });
                        user_notes.prepend(
                            '<h1>Common actions</h1><ul>' +
                                '<li><a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+reported_user+'&template=masked_swearing&post_id=' + reported_post + '">send PM for masked swearing</a>' +
                                '<li><a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+reported_user+'&post_id=' + reported_post + '">send PM (no template)</a>' +
                                '<li><a href="http://forums.frontier.co.uk/infraction.php?do=report&p=' + reported_post + '">give infraction (no template)</a>' +
                            '</ul>'
                        );
                    }

                });

            var report = '';
            for ( var violator in violators ) if ( violators.hasOwnProperty(violator) ) {
                var header = "<h3>Violations for " + violator + "</h>\n<ul><li>";
                for ( var violation in violators[violator] ) if ( violators[violator].hasOwnProperty(violation) ) {
                    report += header + violation + violators[violator][violation] + "\n";
                    header = '<li>';
                }
                if ( header == '<li>' ) report += "</ul>\n";
            }

            report_block.html( report );

        }
    }, 100);

})(( ( typeof(unsafeWindow) == 'undefined' ) ? window : unsafeWindow ).localStorage);
