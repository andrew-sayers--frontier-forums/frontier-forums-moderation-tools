/**
 * @file Simple Debugging Log
 * @author Andrew Sayers
 */

var debug_log = {

    div: $('<div style="width: 100%; text-align: center"><hr><h1>Debugging log - please send this to the maintainer if requested</h1><textarea style="width: 80em; max-width: 50%; height: 20em;" placeholder="Moderators\' extension debugging information"></textarea></div>'),

    /**
     * @summary Show the debugging log at the bottom of the current page
     * @description You might want to show the debugging log at page load, or only when a "severe" error occurs
     */
    show: function() {
        $(function() { debug_log.div.appendTo(document.body) });
        this.show = function() { return this };
        return this;
    },

    /**
     * @summary Add values to the debugging log
     */
    log: function() {
        var caller = debug_log.log.caller.name;
        if ( !caller ) {
            caller = debug_log.log.caller.toString();
            if ( caller.length > 110 ) {
                caller = caller.substr(0,100) + '...';
            }
        }
        debug_log.textarea.value +=
            '================================================================================\n' +
            'Date: ' + new Date() + "\n" +
            'Caller: ' + caller + "\n" +
            'Data: ' + JSON.stringify(Array.prototype.slice.call(arguments, 0), null, '    ') + "\n" +
            "\n"
        ;
        return debug_log;
    },

    /**
     * @summary Get the contents of the debug log
     */
    text: function() {
        return '' + debug_log.textarea.value;
    }

};

debug_log.textarea = debug_log.div.find('textarea')[0];
debug_log.textarea.value +=
    '================================================================================\n' +
    'Frame: ' + ( (window.location == window.parent.location) ? 'main document' : 'iFrame' ) + "\n" +
    'Start date: ' + new Date() + "\n" +
    'URL: ' + location.toString() + "\n" +
    'User agent: ' + navigator.userAgent + "\n" +
    'Cookies: ' + (
        ( typeof(navigator.cookieEnabled) == 'undefined' )
        ? 'unknown'
        : ( navigator.cookieEnabled ? 'enabled' : 'disabled' )
    ) + "\n\n";
