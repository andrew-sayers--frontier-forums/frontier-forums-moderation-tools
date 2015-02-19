/**
 * @file List of known violations
 * @author Andrew Sayers
 */

/**
 * @summary List of known violations
 * @constructor
 * @abstract
 * @description maintains a list of violations.
 * If the variables 'PM-worthy violations', 'warning-worthy violations' and/or 'infraction-worthy violations' exist,
 * the names in those lists are used to set the default_user_action for each variable.
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
                args.error_callback( "Could not refresh the list of violations", [{
                    message: 'log in',
                    href   : args.bb.url_for.login(),
                }]);
                return;
            }

            var infraction_map = {};
            violations.forEach(function(infraction) {
                infraction.default_user_action = args.default_user_action;
                infraction_map[ infraction.name.toLowerCase() ] = infraction;
            });

            [ 'infraction', 'PM' ].forEach(function( default_user_action ) {
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

            vi.cache.violations = violations;
            vi.update_cache();

        },
        function() {
            args.error_callback( "Could not refresh the list of violations", [{
                message: 'log in',
                href   : args.bb.url_for.login(),
            }]);
        }
    );

}