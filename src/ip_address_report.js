/**
 * @file IP Address Report builder
 * @author Andrew Sayers
 * @summary Build an IP address report
 */

/**
 * @summary IP Address Report builder
 * @constructor
 * @param {Object} args report arguments
 * @example
 *
 * var ip_report = new IPAddressReport({
 *     users: { username: ..., user_id: ... }, // user to apply action to
 *     bb   : bb, // BulletinBoard object
 * });
 */
function IPAddressReport(args) {
    this.bb             = args.bb;
    this._users         = args.users;
    this._cache_timeout = 0;
    this._cache_bbcode  = '';
    this._cache_html    = '';
}

IPAddressReport.prototype = Object.create(null, {
    bb            : { writable: true, configurable: false },
    _users        : { writable: true, configurable: false },
    _cache_timeout: { writable: true, configurable: false },
    _cache_bbcode : { writable: true, configurable: false },
    _cache_html   : { writable: true, configurable: false },
});
IPAddressReport.prototype.constructor = IPAddressReport;

/**
 * @summary Set the time after which the report will need to be redownloaded
 * @param {Number} timeout (Epoch) time when the cache will expire
 * @description the special values 0 and Infinity set the cache to
 * immediately/never expire.
 */
IPAddressReport.prototype.cache_timeout = function(timeout) { this._cache_timeout = timeout }
/**
 * @summary Set the list of affected users
 * @param {Array.<Object>} users list of users
 */
IPAddressReport.prototype.users = function(users) { this._users = users }

/**
 * @summary Get the report BBCode
 * @return {jQuery.Promise}
 */
IPAddressReport.prototype.bbcode = function() { var report = this; return this.action().fire().then(function() { return report._cache_bbcode }) }
/**
 * @summary Get the report HTML
 * @return {jQuery.Promise}
 */
IPAddressReport.prototype.html   = function() { var report = this; return this.action().fire().then(function() { return report._cache_html   }) }

/**
 * @summary Create an Action to download the report
 * @return {Action} download the report and define the 'ip address report' key
 */
IPAddressReport.prototype.action = function() {

    var report = this;

    function user_link_bbcode(user) {
        return (
            ( user.registration_ip ? '[b]' : '' ) +
            '[URL="' + location.origin + report.bb.url_for.user_show({ user_id: user.user_id }) + '"]' + user.username + '[/URL]' +
            ( user.registration_ip ? '[/b]' : '' )
        );
    }

    function user_link_html(user) {
        return (
            ( user.registration_ip ? '<strong title="account was registered from this address">' : '' ) +
            '<a href="' + location.origin + report.bb.url_for.user_show({ user_id: user.user_id }) + '">' + user.username + '</a>' +
            ( user.registration_ip ? '</a>' : '' )
        );
    }

    var skip, ips, target_ids;

    return new Action(
        'IP address report',
        new Action(
            'IP address report: download',
            {
                fire: function() {
                    skip = report._cache_timeout > new Date().getTime();
                    ips = {};
                    target_ids = {};
                    report._users.forEach(function(user) { target_ids[user.user_id] = true });
                }
            },
            new Action(
                'IP address report: download one user',
                this._users.map(function(user) {
                    return {
                        description: function() { return [{ type: 'user IPs', target: user }] },
                        fire       : function(keys) {
                            if ( skip ) return;
                            return report.bb.user_ips(user).then(function(data) {
                                var ip_requests = [];
                                var registration_ip_seen = false;
                                function add_ip(ip) {
                                    user = {
                                        registration_ip: ip == data.registration_ip,
                                        username: user.username,
                                        user_id : user.user_id
                                    };
                                    registration_ip_seen |= user.registration_ip;
                                    if ( ips.hasOwnProperty(ip) ) {
                                        ips[ip].targets.push(user);
                                    } else {
                                        ips[ip] = { targets: [ user ], ip: ip };
                                        ip_requests.push(
                                            report.bb.ip_users( ip ).then(function(data) {
                                                ips[ip].domain_name = data.domain_name;
                                                ips[ip].non_targets = data.users.filter(function(user) { return !target_ids.hasOwnProperty(user.user_id) });
                                            })
                                        );
                                    }
                                }
                                data.used_ips.forEach(add_ip);
                                if ( !registration_ip_seen ) add_ip(data.registration_ip);
                                return $.when.apply( $, ip_requests );
                            })
                        },
                    }
                })
            )
        ).then(
            new Action(
                'IP address report: build',
                {
                    fire: function() {

                        if ( !skip ) {

                            report._cache_bbcode =
                                '[table]' +
                                '[tr][th]IP address[/th][th]Target accounts for address[/th][th]Non-target accounts for this address[/th][/tr]\n' +
                                Object.keys(ips).sort().map(function(ip) {
                                    ip = ips[ip];
                                    return '[tr][td][URL="' + location.origin + report.bb.url_for.moderation_ipsearch({ ip_address: ip.ip }) + '"]' + ( ip.domain_name || ip.ip ) + '[/URL][/td]' +
                                        '[td]' + ip.    targets.map(user_link_bbcode).join(', ') + '[/td]' +
                                        '[td]' + ip.non_targets.map(user_link_bbcode).join(', ') + '[/td]' +
                                        '[/tr]\n'
                                }).join('') +
                                '[/table]\n' +
                                '([b]Names in bold[/b] were registered from this address)\n';

                            report._cache_html =
                                '<table>' +
                                '<tr><th>IP address</th><th>Target accounts for address</th><th>Non-target accounts for this address</th></tr>\n' +
                                Object.keys(ips).sort().map(function(ip) {
                                    ip = ips[ip];
                                    return '<tr><td><a href="' + report.bb.url_for.moderation_ipsearch({ ip_address: ip.ip }) + '">' + ( ip.domain_name || ip.ip ) + '</a></td>' +
                                        '<td>' + ip.    targets.map(user_link_html).join(', ') + '</td>' +
                                        '<td>' + ip.non_targets.map(user_link_html).join(', ') + '</td>' +
                                        '</tr>\n'
                                }).join('') +
                                '<caption style="caption-side: bottom">(<strong>names in bold</strong> were registered from this address</caption>\n' +
                                '</table>\n';

                            report._cache_timeout = new Date().getTime() + 60000; // one minute

                        }

                        return $.Deferred().resolve({ keys: { 'ip address report': report._cache_bbcode } }).promise();

                    }

                }
            )
        )
    );

}
