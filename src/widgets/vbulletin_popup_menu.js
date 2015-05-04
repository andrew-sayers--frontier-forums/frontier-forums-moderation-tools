/**
 * @file Popup Menu
 * @author Andrew Sayers
 * @summary Item in a list of popup menus (vBulletin-specific)
 */

/**
 * @summary Popup Menu
 * @constructor
 * @extends Widget
 * @param {Object} args widget arguments
 * @example
 *
 * var menu = new VbulletinPopupMenu({
 *     title: 'text to show in menu popup',
 *     build: function(element) { // called the first time the menu is shown
 *         $(element).add_necessary_stuff();
 *     },
 *     insertBefore: slider_inserted_before_this
 * });
 *
 */
function VbulletinPopupMenu( args ) {

    Widget.call( this, args, 'vbulletin_popup_menu' );

    var body = this.element.find('.popupbody');

    this.element.find('h6 a')
        .text( args.title )
        .one( 'mouseover click', function() {
            if ( body ) { // will fire once on mouseover then again once on click
                args.build( body );
                body = null;
            }
        })
        .click(function() {
            // Sometimes YUI handles this itself, sometimes it fails to bind the handler
            if ( $(this).hasClass('mod-friend-active') ) {
                $(this).removeClass( 'active mod-friend-active' );
                $(this.parentNode.nextElementSibling).hide();
            } else {
                $(this).addClass( 'active mod-friend-active' );
                $(this.parentNode.nextElementSibling).show();
            }
        });

}

VbulletinPopupMenu.prototype = Object.create(Widget);
VbulletinPopupMenu.prototype.constructor = VbulletinPopupMenu;
