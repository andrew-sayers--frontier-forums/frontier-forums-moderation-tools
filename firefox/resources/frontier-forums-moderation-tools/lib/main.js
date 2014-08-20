var data = require("sdk/self").data;
require("sdk/page-mod").PageMod({
  include: "http://forums.frontier.co.uk/*",
  contentScriptFile: [data.url("jquery.min.js"), data.url("contentscript.js")],
  contentScriptWhen: 'end'
});
