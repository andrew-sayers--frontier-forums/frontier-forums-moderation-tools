/**
 * @file Help icon
 * @author Andrew Sayers
 * @summary Help icon
 */

/**
 * @summary Help icon
 * @constructor
 * @extends Widget
 * @param {Object} args widget arguments
 * @example
 *
 * var collapse = new Help({
 *     bb: bb,
 *     v : v,
 *     thread_id: 1234, // clicking the icon will go here
 * });
 *
 */
function Help( args ) {

    Widget.call( this, args, 'help' );

    this.bb = args.bb;

    if ( !Help.css_added ) {
        Help.css_added = true;
        $("head").append(
            "<style type='text/css'>" +
                args.v.parse( BabelExt.resources.get('res/widgets/help.css'), args.bb.css_keys() ) +
            "</style>"
        );
    }

    this.val( args.thread_id );

}

Help.prototype = Object.create(Widget, {
    bb: { writable: true, configurable: false }
});
Help.prototype.constructor = Help;

Help.prototype.val = function( thread_id ) {
    this.element.attr( 'href', this.bb.url_for.thread_show({ thread_id: thread_id }) );
}
