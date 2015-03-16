/**
 * @file Severity Slider
 * @author Andrew Sayers
 * @summary slider indicating the severity of an issue
 */

/**
 * @summary Slider to choose varying levels of severity for a rule violation
 * @constructor
 * @extends Widget
 * @param {Object} args slider arguments
 * @example
 *
 * var slider = new SeveritySlider({
 *     levels: [
 *         {
 *             html: 'no action', // shown when this level is selected
 *             type: 'none', // or "PM" or "warning" or "infraction"
 *             data: ..., // optional
 *         },
 *         ...
 *     ],
 *     value: 'no action', // HTML of default level
 *     callback: function(level) { ... }, // called with the current level object
 *     container: slider_appended_to_this
 * });
 *
 * @description the container element will be set with a class of
 * "slider-left" or "slider-right" depending on whether the slider is
 * currently in the left- or right-hand side of the range.
 */
function SeveritySlider( args ) {

    // Override default callback handling:
    var callback = args.callback;
    delete args.callback;

    Widget.call( this, args, 'severity_slider' );

    this.element.attr( 'max', args.levels.length-1 );

    var divs = this.divs = $(
        args.levels.map(function(level, index, array) {
            var location = index / (array.length-1) * 100;
            var style;
            if ( location <= 50 ) {
                style =  'float: left; margin-left: '  + location + '%; transform: translateX(-' + location + '%)';
            } else {
                location = 100 - location;
                style = 'float: right; margin-right: ' + location + '%; transform: translateX('  + location + '%)';
            }
            return '<div class="severity-slider-level-text" style="' + style + '">' + level.html + '</div>'
        }).join('')
    );

    this.levels = args.levels;

    // legacy use only - can be removed once legacy.js is no more:
    var extra_html;
    if ( args.extra_html ) {
        extra_html = $(args.extra_html).insertAfter( this.element );
    } else {
        this.divs.insertAfter( this.element );
    }

    var old_value = -1;
    this.element.on( 'input change', function() {
        var value = this.value;
        if (  old_value != value ) {
            old_value = value;
            $(args.container).removeClass('slider-left slider-right').addClass( ( value <= (args.levels.length-1)/2 ) ? 'slider-left' : 'slider-right' );
            this.className = 'severity-slider-level severity-slider-type-' + args.levels[value].type;
            divs.hide().eq( value ).show();
            if ( extra_html ) {
                if ( value <= args.levels.length / 2 ) {
                    divs.insertAfter ( extra_html.css({ float: 'right' }).last() );
                } else {
                    divs.insertBefore( extra_html.css({ float: 'left'  }).first() );
                }
            }
            if ( callback ) callback( args.levels[value] );
        }
    });

    this.val( args.value );

}

SeveritySlider.prototype = Object.create(Widget, {
    divs      : { writable: true, configurable: false },
    levels    : { writable: true, configurable: false },
});
SeveritySlider.prototype.constructor = SeveritySlider;


/**
 * @summary set the slider value
 * @param {string} value value to set
 * @return {Object} new level
 */
SeveritySlider.prototype.val = function(value) {
    if ( arguments.length ) {
        var element = this.element;
        this.levels.forEach(function(level, index) {
            if ( level.html == value ) element.val(index).change();
        });
    }

    return this.levels[ this.element.val() ];
}
