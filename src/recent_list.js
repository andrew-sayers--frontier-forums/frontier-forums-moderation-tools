/**
 * @file Manage a list of recent values
 * @author Andrew Sayers
 */

/**
 * @summary Manage a list of recent values
 * @param {Object} args list arguments
 * @constructor
 * @abstract
 *
 * @example
 * var recent_list = new RecentList({
 *     ss: ss, // SharedStore object
 *     name: 'name of value within shared store',
 *     time_horizon: 60*60*1000, // how recent is "recent" (default: 24 hours)
 * });
 *
 */
function RecentList(args) {
    this.ss = args.ss;
    this.name = args.name;
    this.time_horizon = args.time_horizon || 1000*60*60*24;
    this.promise = args.ss.promise;
}

RecentList.prototype.constructor = RecentList;
RecentList.prototype = Object.create(Object, {
    ss          : { writable: true, configurable: false },
    name        : { writable: true, configurable: false },
    time_horizon: { writable: true, configurable: false },
    promise     : { writable: true, configurable: false },
});

/**
 * @summary get a list of values updated in the past 24 hours
 * @return {Array} list of values
 */
RecentList.prototype.get = function() {
    var time_horizon = new Date().getTime() - this.time_horizon, ret = [];
    ( this.ss.val()[this.name] || [] ).forEach(function(value) {
        if ( value.date > time_horizon ) ret.push(value.value);
    });
    return ret;
}

/**
 * @summary append to a list of recent values
 * @param {Object} value value to add
 * @return {jQuery.Promise} promise that succeeds when the change goes through
 */
RecentList.prototype.push = function(value) {
    var rl = this;
    return this.ss.transaction(function(data) {
        if ( data.hasOwnProperty(rl.name) ) {
            data[rl.name].push({ date: new Date().getTime(), value: value });
            var time_horizon = new Date().getTime() - rl.time_horizon;
            data[rl.name] = data[rl.name].filter(function(value) { return value.date > time_horizon });
        } else {
            data[rl.name] = [ { date: new Date().getTime(), value: value } ];
        }
        return true;
    });
}
