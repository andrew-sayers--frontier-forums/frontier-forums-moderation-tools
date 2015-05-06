/**
 * @file manage policy for new accounts
 * @author Andrew Sayers
 * This file defines mod team reply policy in the abstract,
 * but sadly needs to be tightly coupled to the interface.
 */

/**
 * @summary manage policy for official mod team replies to threads
 * @constructor
 * @example
 * var policy = new ModTeamReplyPolicy({
 *
 *     // objects:
 *     v : v, // Variables object
 *     bb: bb, // BulletinBoard object
 *     mod_team_bb: bb, // BulletinBoard object for the moderation team
 *     mc: mc, // MiscellaneousCache object
 *     vi: vi, // Violations object
 *
 *     // configuration:
 *     thread_id     : 1234,
 *     thread_desc   : 'thread description',
 *     loading_html  : 'loading, please wait...',
 *     user          : { username: 'thread creator username', user_id: 12345 }
 *     callback: function( action, summary, template, has_post, has_pm, has_deadline ) { ... };
 *
 *     // widget placement:
 *         post_selector_args: { container: $(    '.post_selector_container') },
 *           pm_selector_args: { container: $(      '.pm_selector_container') },
 *              deadline_args: { container: $(         '.deadline_container') },
 *     template_selector_args: { container: $('.template_selector_container') }
 * });
 */
function ModTeamReplyPolicy(args) {

    // Most actions should be performed under the mod team account:
    var bb = args.bb;
    args.bb = args.mod_team_bb;

    Policy.call( this, args );

    var policy = this;

    var thread = { thread_id: args.thread_id, thread_desc: args.thread_desc };

    var action_data = { thread_id: args.thread_id, template: 'no template' };

    var thread_creator = this.user = $.extend( {}, args.user, { is_target: true } );
    this.default_keys = [
        { type: 'thread'     , name: 'thread'          , value: thread },
        { type: 'username'   , name: 'username'        , value: this.user },
        { type: 'username'   , name: 'thread creator'  , value: this.user },
        { type: 'literal'    , name: 'mod team user id', value: args.mod_team_user.user_id },
        { type: 'action data', name: 'action data'     , value: action_data },
        { type: 'literal'    , name: 'template'        , value: 'no template' }
    ];

    var callback = (
        args.callback
        ? function() {

            action_data.deadline = deadline.val().deadline;

            var actions = [];
            var has_post     = template_selector.find('[name="post"]').prop('checked');
            var has_pm       = template_selector.find('[name="pm"]'  ).prop('checked');
            var has_deadline = deadline.val().deadline != '';
            if ( has_post     ) actions.push( policy.notification_selector_action(post) );
            if ( has_pm       ) actions.push( policy.notification_selector_action(pm  ) );
            if ( has_deadline ) actions.push(
                policy.close_thread().then( policy.deadline_action(deadline) )
            );

            args.callback(
                new Action(
                    'root action',
                    // this has to be split out from the notification actions because they're performed with the mod team account:
                    new Action( 'mod team reply wrapper', actions ).then(new Action( 'add usernote', {
                        fire: function(keys) {
                            if ( !keys.hasOwnProperty(  'pm result') ) keys[  'pm result'] = 'no action';
                            if ( !keys.hasOwnProperty('post result') ) keys['post result'] = 'no action';
                            return bb.usernote_add(
                                thread_creator.user_id,
                                policy.resolve( 'combined note title' , keys ),
                                policy.resolve( 'combined note bbcode', keys )
                            ).then(function() {
                                if ( keys['notification error' ] == 'fail' ) {
                                    var dfd = jQuery.Deferred();
                                    dfd.reject('Notification failed, but the error was postponed so we could add a usernote:\n' + error);
                                    return dfd.promise();
                                }
                            });
                        },
                        description: function() {
                            return [{ type: 'usernote', target: thread_creator }];
                        }
                    }))
                ),
                'official mod team reply for [thread=' + args.thread_id + ']' + args.thread_desc + '[/thread]',
                has_post, has_pm, has_deadline
            );

        }
        : function() {}
    );

    var post = new NotificationSelector(this.notification_selector_args(
        { html: 'post', type: 'post' },
        args.post_selector_args,
        { key_prefix: 'post ' }
    ));

    var pm = new NotificationSelector(this.notification_selector_args(
        { html: 'PM', type: 'PM' },
        args.pm_selector_args,
        { key_prefix: 'PM ' }
    ));

    var deadline = new Deadline(this.deadline_args(null, args.deadline_args, { callback: callback } ));

    var template_selector = $(
        '<div>' +
            '<select name="response_template"><option>No template</option></select>' +
            '<label><input type="checkbox" name="post">post to thread</label><br>' +
            '<label><input type="checkbox" name="pm">PM the thread creator</label>' +
        '</div>'
    ).appendTo(args.template_selector_args.container);

    template_selector.find('select').append(

        this.resolve( 'visible notifications', {}, 'array of items' ).map(function(templates) {
            templates = templates.value.split( /\s*[:,]\s*/g );
            var name = templates.shift();
            var optgroup = $('<optgroup>').attr( 'label', name );
            optgroup.append( templates.map(function(t) { return $('<option>').text(t) }) );
            return optgroup;
        })

    ).change(function() {

        policy.variable_suffix = [action_data.template = $(this).val()];

        policy.default_keys[policy.default_keys.length-1].value = policy.variable_suffix[0];

        template_selector.find('[name="post"]').prop( 'checked', policy.check( [ 'post bbcode' ].concat(policy.variable_suffix) ) );
        post.val( policy.notification_selector_args({ html: 'post', type: 'post' }) );

        template_selector.find('[name="pm"]'  ).prop( 'checked', policy.check( [   'pm bbcode' ].concat(policy.variable_suffix) ) );
        pm  .val( policy.notification_selector_args({ html: 'PM', type: 'PM' }) );

        deadline.val( policy.deadline_args() );

        callback();

    }).change();

    template_selector.find('[name="post"],[name="pm"],[name="reopen-reminder"]').change(callback);

}
ModTeamReplyPolicy.prototype = Object.create(Policy.prototype, {
    _namespace: { writable: false, configurable: false, value: 'mod team replies' },
});
ModTeamReplyPolicy.prototype.constructor = ModTeamReplyPolicy;