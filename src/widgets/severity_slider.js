/**
 * @file Severity Slider
 * @author Andrew Sayers
 * @summary slider indicating the severity of an issue
 */

/**
 * @summary Slider to choose varying levels of severity for a rule violation
 * @constructor
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
 *     default: 0, // index of level selected by default
 *     callback: function(level) { ... } // called with the current level object
 * });
 */
function SeveritySlider( args ) {

    this.input = $('<input type="range" min="0" max="' + (args.levels.length-1) + '">' ).appendTo( $(args.container) );

    this.divs = $(
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

    if ( args.extra_html ) {
        this.extra_html = $(args.extra_html).insertAfter( this.input );
    } else {
        this.divs.insertAfter( this.input );
    }

    var ss = this;
    this.val( args.default );
    var old_value = args.default;
    this.input.on( 'input change', function() {
        var value = $(this).val();
        if ( old_value != value ) {
            old_value = value;
            ss.val( value );
            args.callback( args.levels[ value ] );
        }
    });

}

/**
 * @summary set the slider value
 * @param {Number} value value to set
 */
SeveritySlider.prototype.val = function(value) {
    if ( arguments.length == 0 ) {
        return this.input.val();
    } else {
        this.input.val( value ).attr( 'class', 'severity-slider-level severity-slider-type-' + this.levels[value].type );
        this.divs.hide().eq( value ).show();
        if ( this.extra_html ) {
            if ( value <= this.levels.length / 2 ) {
                this.divs.insertAfter ( this.extra_html.css({ float: 'right' }).last() );
            } else {
                this.divs.insertBefore( this.extra_html.css({ float: 'left'  }).first() );
            }
        }
        return;
    }
}
