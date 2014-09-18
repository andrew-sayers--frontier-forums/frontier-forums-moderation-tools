exports.include = ["http://forums.frontier.co.uk/*","https://forums.frontier.co.uk/*"];
exports.contentScriptWhen = "end";
exports.contentScriptFile = ["self.data.url('BabelExt.js')","self.data.url('jquery.min.js')","self.data.url('extension.js')"];
