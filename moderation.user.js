// ==UserScript==
// @name        Forum Moderation
// @namespace   http://www.pileofstuff.org/forum_moderation
// @description Tools to make forum moderation easier
// @include     http://forums.frontier.co.uk/*
// @version     1
// ==/UserScript==

(function() {

    var script = document.createElement('script');
    script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js';
    script.type = 'text/javascript';
    document.getElementsByTagName("head")[0].appendChild(script);

    var i = setInterval( function() {
        if ( window.jQuery ) {
            clearInterval(i);

            var violators = {};


            $('table[id^=post]').each(
                function() {

                    /*
                     * DETECT SIGNATURE VIOLATIONS
                     */

                    var $username = $(this).find('a.bigusername'),
                    userid    = $username.attr("href").split('?u=', 2)[1],
                    username  = $username.text(),
                    sig_block = $('div[id^=post_message_]',this).next().not('[align=right]').not('.smallfont').not('[style="padding:6px"]'),
                    sig_image = sig_block.find( 'img' ).not('.inlineimg'),
                    sig_text = '{' + sig_block.text()
                        .replace( /[\t\n ]*$/, '' )
                        .replace( /^[\t\n ]/, '' )
                        .replace( /\n\tQuote:[\t\n ]*/, "Quote:\n(extra line for quote block)\n" )
                        .replace( /(\n\(extra line for quote block\)\nOriginally Posted by .*\n)[\t\n ]*/, "$1" )
                        + '}',
                    line_count = sig_text.split( "\n" ).length - 1
                    ;

                    if ( ! violators[ username ] ) violators[ username ] = {};

                    if ( sig_image[0] ) {
                        if ( sig_image.length > 1 ) violators[ username ][ 'too many images: ' + sig_image.length ] = 1;
                        if ( sig_image[0].width > 650 ) violators[ username ][ 'sig too wide: ' + sig_image[0].width + 'x' + sig_image[0].height + 'px' ] = 1;

                        if      ( sig_image[0].height > 150                    ) violators[ username ][ 'sig too tall: ' + sig_image[0].width + 'x' + sig_image[0].height + 'px' ] = 1;
                        if      ( sig_image[0].height > 120 && line_count > 2 ) violators[ username ][ 'too many lines: ' + line_count ] = 1;
                        else if ( sig_image[0].height >  90 && line_count > 3 ) violators[ username ][ 'too many lines: ' + line_count ] = 1;
                        else if (                              line_count > 4 ) violators[ username ][ 'too many lines: ' + line_count ] = 1;
                    } else {
                        if      (                              line_count > 5 ) violators[ username ][ 'too many lines: ' + line_count ] = 1;
                    }

                    /*
                     * ADD "USER NOTES" popup
                     */

                    $(this).find( 'tr' ).last().find('.smallfont')
                        .before( '<div style="cursor: pointer; text-decoration: underline" id="user-notes-' + userid + '" onclick="javascript:get_user_notes(' + userid + ')">View User Notes</div>' )
                        .before( '<a href="http://forums.frontier.co.uk/usernote.php?do=newnote&u=' + userid + '">Post New User Note</a>' )
                    ;

                    window.get_user_notes = function(user_id) {
                        $( "#user-notes-" + user_id ).removeAttr( 'style' ).removeAttr( 'onclick' ).load( '/usernote.php?u=' + user_id + ' [style="padding:0px 0px 6px 0px"]' );
                    };

                });

            var violations = '';
            for ( var violator in violators ) if ( violators.hasOwnProperty(violator) ) {
                var header = "Violations for " + violator + "\n";
                for ( var violation in violators[violator] ) if ( violators[violator].hasOwnProperty(violation) ) {
                    violations += header + violation + "\n";
                    header = '';
                }
            }

            if ( violations.length ) alert(violations);

        }
    }, 100);

})();
