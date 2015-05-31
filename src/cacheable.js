/**
 * @file Abstract "cacheable" object
 * @author Andrew Sayers
 * @description Manage storage to and retrieval from an arbitrary cache
 */

/**
 * @summary Base class for objects that can cache their contents
 * @param {Object} args cacheable arguments
 * @constructor
 * @abstract
 *
 * @example
 * var cacheable = new ChildOfCacheable({
 *     cache          : variable_retrieved_from_storage,
 *     cache_updater  : function(cache) { storage.store( cache ) },
 *     reload_interval: 60 * 60 * 1000, // optional
 *     ... // arguments to child object
 * });
 */
function Cacheable(args) {

    this.cache_updater = args.cache_updater;

    var needs_refresh;
    if (
        args.cache && // cache initialised
        args.cache.cache && // cache correctly initialised (not e.g. grandfathered in from an older implementation)
        args.cache.origin == location.origin // cache loaded from current domain (not e.g. from a test domain)
       ) {
        this.cache    = args.cache.cache;
        needs_refresh = args.reload_interval && args.cache.timestamp+args.reload_interval < new Date().getTime();
    } else {
        this.cache    = {};
        needs_refresh = true;
    }

    if ( needs_refresh ) {
        this.promise = this.refresh(args);
    } else {
        this.promise = $.Deferred().resolve().promise();
    }

}

Cacheable.prototype.constructor = Cacheable;
Cacheable.prototype = Object.create(Object, {

    cache        : { writable: true, configurable: false },
    cache_updater: { writable: true, configurable: false },

    // will return when the cache is up-to-date:
    promise      : { writable: true, configurable: false },

});

/**
 * Update this.cache using the passed cache_updater() callback
 */
Cacheable.prototype.update_cache = function() {
    return this.cache_updater.call( null, {
        timestamp: new Date().getTime(),
        origin   : location.origin,
        cache    : this.cache
    });
}

/**
 * Reload the cached values
 * @param {Object} args cacheable arguments (as passed to Cacheable())
 * @return {jQuery.Promise} promise that will return when the cache has been refreshed
 * @abstract
 */
Cacheable.prototype.refresh = function(args) {/*
    return $.get(...).then(function(html) {
        ...
        this.update_cache();
    });
*/}
