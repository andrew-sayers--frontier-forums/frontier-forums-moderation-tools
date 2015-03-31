/**
 * @file List of known violations
 * @author Andrew Sayers
 */

/**
 * @summary List of known violations
 * @constructor
 * @extends Cacheable
 * @description maintains a list of violations.
 * If the variables 'PM-worthy violations', 'warning-worthy violations' and/or 'infraction-worthy violations' exist,
 * the names in those lists are used to set the default_user_action for each violation.
 *
 * @example
 * var vi = new Violations({
 *      v                  : v,
 *      bb                 : bb,
 *      cache              : violations_cache,
 *      cache_updater      : function(cache) { ... },
 *      reload_interval    : 60 * 1000,
 *      error_callback     : handle_error,
 *      default_user_action: 'PM' // or 'warning' or 'infraction'
 * });
 *
 * // later...
 * var violations = vi.violations.map(function(infraction) { ... infraction.name, infraction.value, infraction.default_user_action ... });
 */
function Violations(args) {
    Cacheable.call( this, args );
    var vi = this;
    this.promise = this.promise.then(function() {
        vi.violations = vi.cache.violations;
    });
}

Violations.prototype = Object.create(Cacheable.prototype, {
    violations: { writable: true, configurable: false },
});
Violations.prototype.constructor = Violations;

/**
 * @summary Refresh the list of violations
 * @param {Object} args arguments passed to the constructor
 * @return {jQuery.promise}
 * @description downloads the violations and converts them to metadata
 */
Violations.prototype.refresh = function(args) {

    var vi = this;

    return $.when( args.bb.infraction_ids(), args.v.promise ).then(
        function(violations) {

            if ( !violations.length ) {
                args.error_callback( "Could not refresh the list of violations", 'log in');
                return;
            }

            var infraction_map = {};
            violations.forEach(function(infraction) {
                infraction.default_user_action = args.default_user_action;
                infraction.dupe_related = false;
                infraction_map[ infraction.name.toLowerCase() ] = infraction;
            });

            [ 'infraction', 'warning', 'PM' ].forEach(function( default_user_action ) {
                if ( args.v.check( 'policy', default_user_action + '-worthy violations' ) ) {
                    args.v.resolve('policy', default_user_action + '-worthy violations', {}, 'array of items').forEach(function(violation) {
                        if ( infraction_map.hasOwnProperty(violation.value.toLowerCase()) ) {
                            infraction_map[violation.value.toLowerCase()].default_user_action = default_user_action;
                        } else {
                            args.error_callback(
                                '"' + violation.value + '" is not a known violation name',
                                args.v.suggest_resolutions_edit( 'policy', default_user_action + '-worthy violations' )
                            );
                        }
                    });
                }
            });

            if ( args.v.check( 'policy', 'dupe-related violations' ) ) {
                args.v.resolve('policy', 'dupe-related violations', {}, 'array of items').forEach(function(violation) {
                    if ( infraction_map.hasOwnProperty(violation.value.toLowerCase()) ) {
                        infraction_map[violation.value.toLowerCase()].dupe_related = true;
                    }
                    // No error callback, as we need to include old violation names that have now been retired
                });
            }

            vi.cache.violations = violations;
            vi.update_cache();

        },
        function() {
            args.error_callback( "Could not refresh the list of violations", 'log in' );
        }
    );

}
