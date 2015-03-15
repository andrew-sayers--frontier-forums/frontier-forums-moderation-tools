exports.include = ["http://forums.frontier.co.uk/*","https://forums.frontier.co.uk/*","http://forumstest.frontier.co.uk/*","https://forumstest.frontier.co.uk/*"];
exports.contentScriptWhen = "start";
exports.contentScriptFile = ["lib/BabelExt.js","lib/BabelExtResources.js","lib/jquery-2.1.1.min.js","lib/selectionchange.js","lib/Chart.js","src/debug_log.js","src/bulletin_board_api.js","src/cacheable.js","src/widgets/severity_slider.js","src/variables.js","src/violations.js","src/dashboard.js","src/report.js","src/form_keys.js","src/legacy.js","src/main.js"];
exports.contentStyleFile = ["src/widgets/severity_slider.css","src/main.css"];
