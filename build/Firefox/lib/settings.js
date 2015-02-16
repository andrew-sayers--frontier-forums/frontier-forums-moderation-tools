exports.include = ["http://forums.frontier.co.uk/*","https://forums.frontier.co.uk/*","http://forumstest.frontier.co.uk/*","https://forumstest.frontier.co.uk/*"];
exports.contentScriptWhen = "start";
exports.contentScriptFile = ["lib/BabelExt.js","lib/jquery-2.1.1.min.js","lib/selectionchange.js","src/bulletin_board_api.js","src/cacheable.js","src/variables.js","src/dashboard.js","src/legacy.js","src/main.js"];
exports.contentStyleFile = ["src/main.css"];
