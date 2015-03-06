/**
 * @file Highlight similar e-mail addresses
 * @author Andrew Sayers
 */

/**
 * @summary Highlight similar e-mail addresses
 * @constructor
 * @param {Object} args address arguments
 * @example
 *
 * var highlighter = new EmailHighlighter({
 *     v: v, // Variables object
 *     source_address: 'a@b.cd'
 * });
 */
function EmailHighlighter( args ) {

    var email = args.source_address.split('@');
    args.v.resolve('internal extension data', 'common e-mail domains', {}, 'array of items').forEach(function(domain) {
        if ( email[1].toLowerCase() == domain.value.toLowerCase() ) email[1] = '';
    });
    this.source_name   = email[0].toLowerCase().split('');
    this.source_domain = email[1].toLowerCase();

}

EmailHighlighter.prototype = Object.create(null, {
    source_name  : { writable: true, configurable: false },
    source_domain: { writable: true, configurable: false },
});
EmailHighlighter.prototype.constructor = EmailHighlighter;

/**
 * @summary Return highlighted values
 * @param {string} target_address E-mail address to highlight
 * @return {Object} highlighted sections for name and domain
 * @example
 * new EmailHighlighter({ name: 'b@c.de', v: v }).highlight( 'abc@c.de' )
 * // returns { name: [ 'a', 'b', 'c' ], domain: [ '', 'c.de', '' ] }
 */
EmailHighlighter.prototype.highlight = function( target_address ) {

    target_address = target_address.split('@');

    /*
     * Compare usernames by longest common substring
     */
    var source_name = this.source_name;
    var target_address_name = target_address[0].toLowerCase().split('');
    var longest_start=0, longest_length=-1;
    for ( var n=0; n<source_name.length; ++n ) {
        for ( var m=0; m<target_address_name.length; ++m ) {
            var max_length = Math.min( source_name.length - n, target_address_name.length - m );
            if ( max_length >= longest_length ) {
                for ( var length=0; length != max_length && source_name[n+length] == target_address_name[m+length]; ++length ) {
                    if ( longest_length < length ) {
                        longest_start = m;
                        longest_length = length;
                    }
                }
            }
        }
    }

    return {

        name:
        // calculation above is off-by-one, but a correct algorithm would be much uglier:
        ( ++longest_length && ( longest_length > 4 || longest_length == source_name.length || longest_length == target_address_name.length ) )
        ? [ // looks like a match!
            target_address[0].substr(0            ,longest_start ),
            target_address[0].substr(longest_start,longest_length),
            target_address[0].substr(longest_start+longest_length)
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
 * @param {string} target_address   E-mail address to highlight
 * @param {jQuery} name_container   Element to place the user's name in
 * @param {jQuery} domain_container Element to place the user's domain in
 */
EmailHighlighter.prototype.highlight_to_element = function( target_address, name_container, domain_container ) {

    target_address = this.highlight(target_address);

    name_container.html('<span></span><b></b><span></span>');
    name_container.children().eq(0).text( target_address.name[0] );
    name_container.children().eq(1).text( target_address.name[1] );
    name_container.children().eq(2).text( target_address.name[2] );

    domain_container.html('<span></span><b></b><span></span>');
    domain_container.children().eq(0).text( target_address.domain[0] );
    domain_container.children().eq(1).text( target_address.domain[1] );
    domain_container.children().eq(2).text( target_address.domain[2] );

}
