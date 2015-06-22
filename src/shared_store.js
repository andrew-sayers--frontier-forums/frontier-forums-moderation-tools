/**
 * @file Share a data store between users
 * @author Andrew Sayers
 * @description We use a third party to synchronise storage between users
 */

/**
 * @summary Share a data store between users
 * @param {Object} args store arguments
 * @constructor
 * @abstract
 *
 * @example
 * var shared_store = new SharedStore({
 *     lock_url: 'http://.../...', // third-party URL to lock the store during writing
 *     store   : function(data) {...}, // called when we want to store a new string
 *     retrieve: function() {...}, // called when we want to download a string
 *     error_callback: function(message, resolutions),
 *     v: v
 * });
 *
 * @description Stores data in a location shared between several users.
 * Most bulletin board software doesn't provide a mechanism to lock a resource
 * when writing.  To prevent race conditions where two users overwrite
 * each other's updates, we call out to a third-party locking service.
 * See /lock.rb in this repository for an example implementation.
 *
 * Note: if this string is empty, the object will work but will not protect against
 * race conditions
 *
 */
function SharedStore(args) {

    this.store    = args.store;
    this.retrieve = args.retrieve;

    this.change_cbs   = [];
    this.interval_cbs = [];
    this.data         = '{}';
    this.error_callback = args.error_callback;
    this.v = args.v;

    var ss = this;
    this.promise = this.retrieve().then(function(data) { ss.data = data });

    if ( args.lock_url ) {
        this.   lock = function(       ) { return $.ajax({ url: args.lock_url +    '/lock'           , xhr: function() { return new BabelExt.XMLHttpRequest() } }) };
        this. unlock = function(lock_id) { return $.ajax({ url: args.lock_url +  '/unlock/' + lock_id, xhr: function() { return new BabelExt.XMLHttpRequest() } }) };
        this.refresh = function(lock_id) { return $.ajax({ url: args.lock_url + '/refresh/' + lock_id, xhr: function() { return new BabelExt.XMLHttpRequest() } }) };
    } else {
        console.log( "Shared store lock URL not specified - writes to the shared store may overwrite other people's information!" );
        this.lock = this.unlock = this.refresh = function() {
            return $.Deferred().resolve('1').promise();
        }
    }

}

SharedStore.prototype.constructor = SharedStore;
SharedStore.prototype = Object.create(Object, {

       lock: { writable: true, configurable: false },
     unlock: { writable: true, configurable: false },
    refresh: { writable: true, configurable: false },

    promise: { writable: true, configurable: false },

    store    : { writable: true, configurable: false },
    retrieve : { writable: true, configurable: false },

      change_cbs: { writable: true, configurable: false },
    interval_cbs: { writable: true, configurable: false },

    error_callback: { writable: true, configurable: false },
    v: { writable: true, configurable: false }

});

/**
 * @summary get the stored value
 * @return {Object} stored value
 * @description because this value is stored remotely, this just
 * returns the cached value.
 * See transaction() and change()
 */
SharedStore.prototype.val = function() {
    return JSON.parse(this.data);
}

// Regularly update the data
SharedStore.prototype._interval_transaction = function(callback) {
    var ss = this;
    this._timeout = setTimeout(function() { ss.transaction(function(){}) }, 60*1000 );
}

/**
 * @summary Add a callback for when the value changes, or fire a change event
 * @param {function=} callback
 * @param {jQuery.Promise=} retrieval callback
 *
 * @example
 * ss.change(function(data) { console.log(data) }); // no return value
 * ss.change().then(function(data) {...}); // also calls previous change_cbs
 *
 * The store is checked at regular intervals, and will be called whenever
 * the value changes.
 */
SharedStore.prototype.change = function(callback) {

    if ( callback ) {

        this.change_cbs.push(callback);
        if ( !this._timeout ) this._interval_transaction();

    } else {

        var ss = this;
        return this.retrieve().then(function(data) {
            if ( !data || data == ss.data ) {
                data = JSON.parse(data || '{}' );
            } else {
                data = JSON.parse(data);
                ss.change_cbs.forEach(function(f) { f(data) });
            }
            return data;
        });

    }

}

/**
 * @summary transaction handlers called regularly
 * @param {function} updater callback
 *
 * @example
 * ss.interval_transaction(function(data) {
 *     data.last_active_time = new Date().getTime(); // see the 'offset' value in BulletinBoard.ping()
 *     return true; // data has changed, should do a write
 * });
 *
 * @description Sometimes we need to write to the store regularly,
 * and it's more efficient to do one big write instead of several
 * small ones.
 */
SharedStore.prototype.interval_transaction = function(updater) {
    this.interval_cbs.push(updater);
    if ( !this._timeout ) this._interval_transaction();
}

/**
 * @summary update the value
 * @param {function} updater called to update the value
 * @return {jQuery.Promise} promise that succeeds when the change goes through
 *
 * @example
 * ss.transaction(function(data) {
 *     ++data.value; // update the value
 *     return true; // signal that an update is needed
 * }).then(function(new_data) {
 *     console.log( "new data" );
 * });
 *
 * @description To ensure users can't overwrite each other's changes,
 * we lock the store, retrieve and update the value, then store it again.
 * Change callbacks might be called after the retrieve(), but will not
 * be called when the update goes through.
 *
 */
SharedStore.prototype.transaction = function(updater) {

    var ss = this;

    var dfd = $.Deferred();

    function babel_xhr() { return new BabelExt.XMLHttpRequest() };

    var delay_count = 0;

    function transact() {
        var lock_timeout = new Date().getTime() + 5000;
        ss.lock().then(function(lock_id) {
            if ( lock_id == '0' ) { // could not lock
                setTimeout( transact, ++delay_count*1000 );
            } else {

                var refresh_timeout, locked = true;

                function unlock() {
                    locked = false;
                    ss.unlock(lock_id);
                    if ( refresh_timeout ) clearTimeout(refresh_timeout);
                    $(window).off( 'unload', unlock );
                }
                $(window).on( 'unload', unlock );

                function refresh() { // the lock lasts for five seconds by default, and can be refreshed for a few more seconds
                    refresh_timeout = null;
                    if ( locked ) {
                        lock_timeout = new Date().getTime() + 5000;
                        ss.refresh(lock_id).then(function(result) {
                            if ( locked && result == 1 )
                                refresh_timeout = setTimeout( refresh, 1000 );
                            else
                                locked = false;
                        }, function() {
                            locked = false;
                        });
                    }
                }
                refresh();

                ss.retrieve().then(function(data) {
                    if ( !locked || lock_timeout < new Date().getTime() ) {
                        unlock();
                        setTimeout( transact, ++delay_count*1000 );
                        return;
                    }
                    if ( !data || data == ss.data ) {
                        data = JSON.parse(data || '{}' );
                    } else {
                        ss.data = data;
                        data = JSON.parse(data);
                        ss.change_cbs.forEach(function(f) { f(data) });
                    }
                    var need_update = ss.interval_cbs.reduce(function (prev,update) { return update(data) ? true : prev }, updater(data) );
                    if ( ss._timeout ) {
                        clearTimeout( ss._timeout );
                        ss._interval_transaction();
                    }
                    if ( need_update ) {
                        ss.store( ss.data = JSON.stringify( data ) ).then(function() {
                            dfd.resolve(data);
                            unlock();
                        }, function() {
                            unlock();
                            dfd.reject();
                        });
                    } else {
                        unlock();
                        dfd.resolve(data);
                    }
                }, function() {
                    unlock();
                    dfd.reject();
                });

            }
        }, function() {
            ss.error_callback(
                'Could not lock shared store',
                ss.v.resolve( 'policy', 'shared store resolutions', {}, 'array of items' ).map(function(item) {
                    return { message: item.value, href: item.url };
                })
            );
            dfd.reject();
        });
    }
    transact();

    return dfd.promise();

}
