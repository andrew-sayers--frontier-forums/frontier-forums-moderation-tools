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

        return $.when( args.bb.post_info(args.v.resolve( 'frequently used posts/threads', 'Infractions list post' ) ), args.vi.promise ).then(
            function(post) {

                var violation_map = {};
                args.vi.violations.forEach(function(violation) {
                    var key = violation.name.toLowerCase().replace( /[^a-z0-9]/g, '' );
                    violation_map[key] = violation;
                });

                // Parse the violations list to get the violation groups:
                var violation_groups = mc.cache.violation_groups = [];
                post.bbcode.replace(
                        /\[COLOR=#[a-fA-F0-9]+\]\[B\]([A-Za-z]+ Violations)\[\/B\]\[\/COLOR\]|\[TD\]([^\[]+)\[\/TD\]/g,
                    function( match, group_name, violation_name ) {
                        if ( group_name ) {
                            violation_groups.push({ name: group_name, violations: [] });
                        } else {
                            var key = violation_name.toLowerCase().replace( /[^a-z0-9]/g, '' );
                            if ( violation_map.hasOwnProperty(key) ) {
                                violation_groups[violation_groups.length-1].violations.push( violation_map[key] );
                                delete violation_map[key];
                            } else {
                                console.log( 'Ignoring unknown violation name: ' + violation_name );
                            }
                        }
                    }
                );

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
