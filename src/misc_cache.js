/**
 * @file Various Frontier Forums-specific cached values
 * @author Andrew Sayers
 */

/**
 * @summary Various Frontier Forums-specific cached values
 * @constructor
 * @extends Cacheable
 * @description Cache a set of values with no pattern other than the forum they're specific to
 *
 * @example
 * var mc = new MiscellaneousCache({
 *      v                  : v,
 *      bb                 : bb,
 *      cache              : misc_cache,
 *      cache_updater      : function(cache) { ... },
 *      reload_interval    : 60 * 1000,
 * });
 *
 */
function MiscellaneousCache(args) {
    Cacheable.call( this, args );
    var mc = this;
    this.promise = this.promise.then(function() { $.extend( mc, mc.cache ) });
}

MiscellaneousCache.prototype = Object.create(Cacheable.prototype, {
    violation_groups: { writable: true, configurable: false },
});
MiscellaneousCache.prototype.constructor = MiscellaneousCache;

/**
 * @summary Refresh the list
 * @param {Object} args arguments passed to the constructor
 * @return {jQuery.promise}
 * @description downloads the list and convert to metadata
 */
MiscellaneousCache.prototype.refresh = function(args) {

    var mc = this;

    return args.v.promise.then(function() {

        var infractions_list_post = args.v.resolve( 'frequently used posts/threads', 'Infractions list post' );

        return $.when( $.get( args.bb.url_for.thread_show({ post_id: infractions_list_post }) ), args.vi.promise ).then(
            function(get_args) {

                var violation_map = {};
                args.vi.violations.forEach(function(violation) {
                    var key = violation.name.toLowerCase().replace( /[^a-z0-9]/g, '' );
                    violation_map[key] = violation;
                });

                // Parse the violations list to get the violation groups:
                var violation_groups = mc.cache.violation_groups = [];

                args.bb
                    .process_posts(args.bb.get_posts(get_args[0]) ) // get all posts on the page
                    .filter(function() { return this.post_id == infractions_list_post })[0] // get the target post
                    .message_element // get the titles and tables
                    .find('blockquote')
                    .children('font,div')
                    .each(function() {
                        if ( this.nodeName == 'FONT' ) { // start a new group when we find a title
                            violation_groups.push({ name: this.textContent, violations: [] });
                        } else { // append each infraction to the current group
                            $('td:first-child', this).each(function(index) {
                                if ( index ) { // do not append the table header
                                    var key = this.textContent.toLowerCase().replace( /[^a-z0-9]/g, '' );
                                    if ( violation_map.hasOwnProperty(key) ) {
                                        violation_groups[violation_groups.length-1].violations.push( violation_map[key] );
                                        delete violation_map[key];
                                    } else {
                                        console.log( 'Ignoring unknown violation name: ' + this.textContent );
                                    }
                                }
                            });
                        }
                    })
                ;

                var other_violations = {
                    name: 'Other',
                    violations: args.vi.violations.filter(function(violation) { return violation_map.hasOwnProperty(violation.name.toLowerCase().replace( /[^a-z0-9]/g, '' )) })
                };
                if ( other_violations.violations.length ) violation_groups.push( other_violations );

                mc.update_cache();

            },
            function() {
                args.error_callback( "Could not refresh the miscellaneous cache", 'log in' );
            }
        );

    });

}
