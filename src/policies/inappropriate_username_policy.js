/**
 * @file handle users with inappropriate names
 * @author Andrew Sayers
 */

/**
 * @summary inappropirate name policy
 * @constructor
 * @example
 * var policy = new InappropriateUsernamePolicy({
 *     // objects:
 *     v : v, // Variables object
 *     bb: bb, // BulletinBoard object
 *     mc: mc, // MiscellaneousCache object
 *     vi: vi, // Violations object
 *
 *     // configuration:
 *     loading_html  : 'loading, please wait...',
 *     user          : { username: 'thread creator username', user_id: 12345 }
 *     callback: function( action, summary, header ) { ... };
 *
 *     // widget placement:
 *     notification_selector_args: { container: $('.notification_selector_container') },
 *                extra_post_args: { container: $(           '.extra_post_container') },
 *           severity_slider_args: { container: $(      '.severity_slider_container') },
 *             mode_switcher_args: { container: $(        '.mode_switcher_container') }
 * });
 */
function InappropriateUsernamePolicy(args) {

    args.severity = 1;
    Policy.call( this, args );

    this.user = $.extend( {}, args.user, { is_target: true } );
    this.default_keys = [
        { type: 'username'   , name: 'username', value: this.user },
        { type: 'action data', name: 'action data', value: { deadline: '+7d', user: { username: this.user.username, user_id: this.user.user_id } } },
        { type: 'literal'    , name: 'name', value: this.user.username } // DEPRECATED: use "username" in new code
    ];

    var policy = this;

    var callback = function() {};

    var notification =
        new NotificationSelector(this.notification_selector_args( null, args.notification_selector_args ));
    var extra_post =
        new ExtraPost(this.extra_post_args(
            null,
            { container: notification.extra_block() },
            args.extra_post_args,
            { callback : callback }
        ));
    new SeveritySlider(this.severity_slider_args(null, args.severity_slider_args, {
        callback: function(level) {
            policy.severity_level = level;
            notification.val(policy.notification_selector_args());
            extra_post  .val(policy.extra_post_args());
            callback();
        }
    }));

    $(args.mode_switcher_args.container).append(notification.mode_switcher());

    if ( args.callback )
        callback = function() {
            args.callback(
                new Action(
                    policy.name + ' wrapper',
                    policy.extra_post_action(extra_post).then( policy.notification_selector_action(notification) )
                ),
                '[img]' + policy.severity_icon() + '[/img]:eek: ' + policy.user_link() + ' is an inappropriate username' + policy.severity_text(),
                '<img src="' + policy.severity_icon() + '"><img src="/images/smilies/vbsmileys/eek.png">'
            );
        }

    callback();

}

InappropriateUsernamePolicy.prototype = Object.create(Policy.prototype, {
    _namespace: { writable: false, configurable: false, value: 'newbie actions' },
    name      : { writable: false, configurable: false, value: ['inappropriate username'] },
});
InappropriateUsernamePolicy.prototype.constructor = InappropriateUsernamePolicy;
