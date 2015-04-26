/**
 * @file Manage a list of available users
 * @author Andrew Sayers
 * @description Keep track of which users are currently "available", and share jobs fairly between them
 */

/**
 * @summary Manage a list of available users
 * @param {Object} args available users arguments
 * @constructor
 * @abstract
 *
 * @example
 * var available_users = new AvailableUsers({
 *     bb: bb, // BulletinBoard object
 *     ss: ss, // SharedStore object
 *     language: 'en' // user will only be marked available for items in this language
 * });
 *
 *
 * @description All registered users can be "available" or "unavailable".
 * Jobs can only be assigned to available users.  Availability is calculated
 * from two metrics: has the user set their state to "active", and have
 * they moved the mouse in the past minute or so.
 */
function AvailableUsers(args) {

    var username = args.bb.user_current().username;

    this.current_user = { username: username, active_time: new Date().getTime() };
    this.users = [this.current_user];

    var available = true;
    this._available = function() { available = true };

    var au = this;
    this.promise = args.bb.ping().then(function(data) {
        au.time_offset = data.offset;
        au.current_user.active_time = new Date().getTime() - au.time_offset;
        args.ss.interval_transaction(function(data) {

            var need_update = false;

            if ( data.hasOwnProperty('available_users') ) {
                au.users = data.available_users;
                au.current_user = au.users.reduce(function(prev,user) { return user.username == username ? user : prev }, null );
                if ( !au.current_user ) {
                    au.current_user = { username: username, active_time: 0 };
                    au.users.push(au.current_user);
                    need_update = true;
                }
            } else {
                data.available_users = au.users;
                need_update = true;
            }

            if ( au.active && available ) {
                au.current_user.active_time = new Date().getTime() - au.time_offset;
                au.current_user.language    = args.language;
                need_update = true;
            }

            available = false;

            return need_update;

        });
        return args.ss.transaction(function(){}); // trigger an initial update
    });

}

AvailableUsers.prototype.constructor = AvailableUsers;
AvailableUsers.prototype = Object.create(Object, {
    current_user: { writable: true, configurable: false },
    users       : { writable: true, configurable: false },
    active      : { writable: true, configurable: false },
    time_offset : { writable: true, configurable: false },
    _available  : { writable: true, configurable: false },
});

/**
 * @summary getset a user's activity state
 * @param {Boolean=} val new activity state
 * @return {Boolean} activity state
 *
 * @description a user is deemed to be available if their state
 * is set to "active" and they have moved the mouse in the past
 * minute or so.
 */
AvailableUsers.prototype.active = function(val) {
    if ( typeof(val) != 'undefined' && val != this.active ) {
        this.active = val;
        if ( this.active ) {
            $(window       ).on ( 'focus scroll'      , this._available );
            $(document.body).on ( 'mousemove keypress', this._available );
            this._available();
        } else {
            $(window       ).off( 'focus scroll'      , this._available );
            $(document.body).off( 'mousemove keypress', this._available );
        }
    }
    return this.active;
}

/**
 * @summary decide whether an element belongs to us based on an ID
 * @param {Number} id Item ID
 * @return {Boolean} true if the item belongs to us
 *
 * @description
 * Based on the list of users and their availability, decides whether
 * this item should be assigned to us.  This should assign items
 * as stably as possible, even when users' availability changes.
 */
AvailableUsers.prototype.is_ours = function( id, language ) {

    // anyone that has not updated their activity in the last five minutes is assumed to be unavailable:
    var activity_cutoff = new Date().getTime() - this.time_offset - 5*60*1000;

    if ( this.current_user.active_time < activity_cutoff ) return false;

    // leave users with other languages in, so the list isn't reshuffled when someone changes language:
    var users = this.users.slice(0);

    if ( language ) language = language.substr(0,2);

    for (;;) { // no need for an end condition - we know at least one user (us) is available
        var user = users.splice(id % users.length, 1)[0];
        if (
            user.active_time >= activity_cutoff &&
            ( !language || language == user.language.substr(0,2) ) // users with another language are treated as offline
        )
            return user === this.current_user;
    }

}
