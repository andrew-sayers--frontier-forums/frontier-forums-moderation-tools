/**
 * @file (Un-)collapse a box
 * @author Andrew Sayers
 * @summary (Un-)collapse a box
 */

/**
 * @summary (Un-)collapse a box
 * @constructor
 * @extends Widget
 * @param {Object} args widget arguments
 * @example
 *
 * var collapse = new Collapse({
 *     v : v,
 *     bb: bb,
 *     collapsed: true, // initial state (default: false)
 *     callback: function(collapsed) { ... },
 *     container: collapse_appended_to_this
 * });
 *
 */
function Collapse( args ) {

    Widget.call( this, args, 'collapse' );

    if ( !Collapse.css_added ) {
        Collapse.css_added = true;
        $("head").append(
            "<style type='text/css'>" +
                args.v.parse( BabelExt.resources.get('res/widgets/collapse.css'), args.bb.css_keys() ) +
            "</style>"
        );
    }

    var collapsed = args.collapsed;

    if ( args.collapsed ) $(this.element).addClass('mod-friend-collapsed');

    this.element.click(function(event) {
        $(this).toggleClass('mod-friend-collapsed');
        if ( args.callback ) args.callback( collapsed ^= true );
        event.stopPropagation();
        event.preventDefault();
    });

}

Collapse.prototype = Object.create(Widget);
Collapse.prototype.constructor = Collapse;

Collapse.prototype.val = function( collapse ) {
    if ( $(this.element).hasClass('mod-friend-collapsed') != collapse ) $(this.element).click();
}
