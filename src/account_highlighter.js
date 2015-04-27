/**
 * @file Highlight similarly-named accounts
 * @author Andrew Sayers
 */

/**
 * @summary Highlight similar accounts
 * @constructor
 * @param {Object} args address arguments
 * @example
 *
 * var highlighter = new AccountHighlighter({
 *     v: v, // Variables object
 *     source_username: 'a@b.cd'
 *     source_address : 'a@b.cd'
 * });
 */
function AccountHighlighter( args ) {

    var email = args.source_address.split('@');
    args.v.resolve('internal extension data', 'common e-mail domains', {}, 'array of items').forEach(function(domain) {
        if ( email[1].toLowerCase() == domain.value.toLowerCase() ) email[1] = '';
    });
    this.source_name   = email[0].toLowerCase();
    this.source_domain = email[1].toLowerCase();

    this.source_username = args.source_username.toLowerCase();

}

AccountHighlighter.prototype = Object.create(null, {
    source_username: { writable: true, configurable: false },
    source_name    : { writable: true, configurable: false },
    source_domain  : { writable: true, configurable: false },
});
AccountHighlighter.prototype.constructor = AccountHighlighter;

/**
 * @summary Return highlighted values
 * @param {string} target_address E-mail address to highlight
 * @return {Object} highlighted sections for name and domain
 * @example
 * new AccountHighlighter({ source_username: 'bee', source_address: 'b@c.de', v: v }).highlight( 'ay bee cee', 'abc@c.de' )
 * // returns { username: [ 'ay ', 'bee', ' cee' ], name: [ 'a', 'b', 'c' ], domain: [ '', 'c.de', '' ] }
 */
AccountHighlighter.prototype.highlight = function( target_username, target_address ) {

    target_address = target_address.split('@');

    function longest_common_substring(source, target) {
        var longest_start=0, longest_length=-1;
        for ( var n=0; n<source.length; ++n ) {
            for ( var m=0; m<target.length; ++m ) {
                var max_length = Math.min( source.length - n, target.length - m );
                if ( max_length >= longest_length ) {
                    for ( var length=0; length != max_length && source[n+length] == target[m+length]; ++length ) {
                        if ( longest_length < length ) {
                            longest_start = m;
                            longest_length = length;
                        }
                    }
                }
            }
        }
        // calculation above is off-by-one, but a correct algorithm would be much uglier:
        ++longest_length;
        if ( longest_length > 3 || longest_length == source.length || longest_length == target.length )
            return [ longest_start, longest_length ];
        else
            return [ 0, 0 ];
    }

    /*
     * Compare names by longest common substring
     */
    var username_name_match     = longest_common_substring( this.source_username, target_address[0].toLowerCase() );
    var     name_name_match     = longest_common_substring( this.source_name    , target_address[0].toLowerCase() );
    var username_username_match = longest_common_substring( this.source_username, target_username  .toLowerCase() );
    var     name_username_match = longest_common_substring( this.source_name    , target_username  .toLowerCase() );

    // get the longest match, or the match of the same type if it's a tie:
    var     name_match = ( username_name_match    [1] >  name_name_match    [1] ) ? username_name_match     : name_name_match    ;
    var username_match = ( username_username_match[1] >= name_username_match[1] ) ? username_username_match : name_username_match;

    return {

        username:
        username_match[1]
        ? [ // looks like a match!
            target_username.substr(0            ,username_match[0]),
            target_username.substr(username_match[0],username_match[1]),
            target_username.substr(username_match[0]+username_match[1])
        ]
        : [ target_username, '', '' ]
        ,

        name:
        name_match[1]
        ? [ // looks like a match!
            target_address[0].substr(0            ,name_match[0]),
            target_address[0].substr(name_match[0],name_match[1]),
            target_address[0].substr(name_match[0]+name_match[1])
        ]
        : [ target_address[0], '', '' ]
        ,

        domain:
        // compare domains exactly (but case-insensitively)
        ( this.source_domain == target_address[1].toLowerCase() )
        ? [ '', target_address[1], '' ]
        : [ target_address[1], '', '' ]

    }

}

/**
 * @summary convenience function to populate elements with a highlighted e-mail
 * @param {string} target_username    Username to highlight
 * @param {string} target_address     E-mail address to highlight
 * @param {jQuery} username_container Element to place the user's username in
 * @param {jQuery} name_container     Element to place the e-mail name in
 * @param {jQuery} domain_container   Element to place the e-mail domain in
 */
AccountHighlighter.prototype.highlight_to_element = function( target_username, target_address, username_container, name_container, domain_container ) {

    var target = this.highlight(target_username, target_address);

    username_container.html('<span></span><b></b><span></span>');
    username_container.children().eq(0).text( target.username[0] );
    username_container.children().eq(1).text( target.username[1] );
    username_container.children().eq(2).text( target.username[2] );

    name_container.html('<span></span><b></b><span></span>');
    name_container.children().eq(0).text( target.name[0] );
    name_container.children().eq(1).text( target.name[1] );
    name_container.children().eq(2).text( target.name[2] );

    domain_container.html('<span></span><b></b><span></span>');
    domain_container.children().eq(0).text( target.domain[0] );
    domain_container.children().eq(1).text( target.domain[1] );
    domain_container.children().eq(2).text( target.domain[2] );

}
