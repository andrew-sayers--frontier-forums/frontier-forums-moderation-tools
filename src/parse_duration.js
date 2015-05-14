/**
 * @summary parse a duration such as "+1w" (one week)
 * @param {string} duration input duration
 * @return {Object} period, frame, and date
 */
function parse_duration(duration) {
    var ret = null;
    duration.replace( /^\s*\+([0-9]+)([mhdMY])\s*$/, function(match, period, frame) {
        ret = { period: parseInt( period, 10 ), frame: frame, date: new Date() };
        switch ( frame.toLowerCase() ) {
        case 'm': ret.date.setTime ( ret.date.getTime () + ret.period *    60*1000 ); break;
        case 'h': ret.date.setTime ( ret.date.getTime () + ret.period * 60*60*1000 ); break;
        case 'd': ret.date.setDate ( ret.date.getDate () + ret.period              ); break;
        case 'w': ret.date.setDate ( ret.date.getDate () + ret.period * 7          ); break;
        case 'M': ret.date.setMonth( ret.date.getMonth() + ret.period              ); break;
        case 'Y': ret.date.setYear ( ret.date.getYear () + ret.period              ); break;
        }
    });
    return ret;
}
