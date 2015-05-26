/**
 * @file Handle a report
 * @author Andrew Sayers
 */

/**
 * @summary Handle a report
 * @param {Object} args report arguments
 * @constructor
 * @description Reports just handle the actual report thread itself.
 * Actions stemming from the report are handled elsewhere.
 *
 * @example
 * var report = new Report({
 *     v: variables,
 *     bb: bulletin_board,
 *     thread_id: 123,
 *     title: 'Reported post by <name> [TID: 456] [PID: 7890] [ASSIGNED: J. Random Moderator]'
 * });
 */

function Report(args) {

    if ( args.title ) {
        args.title.replace(     /\[PID: ([0-9]+)\]/, function(match, pid ) { args.target_post_id   = parseInt( pid, 10 ) });
        args.title.replace(     /\[TID: ([0-9]+)\]/, function(match, tid ) { args.target_thread_id = parseInt( tid, 10 ) });
        args.title.replace( /\[ASSIGNED: ([^)]+)\]/, function(match, name) { args.assigned         = name });
    }

    this.v  = args.v;
    this.bb = args.bb;

    this.title            = args.title;
    this.thread_id        = args.thread_id;
    this.target_thread_id = args.target_thread_id;
    this.target_post_id   = args.target_post_id;
    this.assigned         = args.assigned;

}

Report.prototype.constructor = Report;
Report.prototype = Object.create(Object, {

    v : { writable: true, configurable: false },
    bb: { writable: true, configurable: false },

    thread_id       : { writable: true, configurable: false },
    target_thread_id: { writable: true, configurable: false },
    target_post_id  : { writable: true, configurable: false },
    assigned        : { writable: true, configurable: false }

});

/*
 * @summary Take a report thread
 * @param {string}   name          name of the moderator who will take the thread
 * @param {boolean=} thread_closed whether to open or close the thread
 *
 * This will load the thread in the current page after taking it.
 */
Report.prototype.take = function( name, thread_closed ) {

    var report = this;
    var expected_title_suffix = report.v.resolve('report process', 'report title suffix', { moderator: name });
    var new_title = this.title.replace(
        new RegExp(
            report.v.resolve('report process', 'report title suffix', { moderator: "\uE000" })
             .replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1") // escape special characters: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
             .replace( "\uE000", '.*?' )
             + '$'
        )
    ) + expected_title_suffix;

    report.bb.thread_edit({
        thread_id: report.thread_id,
        title: new_title,
        notes: 'thread taken by ' + name,
        close_thread: thread_closed
    }).then(function() {
        report.bb.thread_reply({
            thread_id: report.thread_id,
            title    : report.v.resolve('report process', 'post title: take report', {}, 'string', undefined, report.thread_id ),
            bbcode   : report.v.resolve('report process', 'post body: take report' , {}, 'string', undefined, report.thread_id ),
            url      : report.bb.url_for.thread_show({ thread_id: report.thread_id, goto: 'newpost' }),
            flip_thread_openness: false
        });
    });

}
