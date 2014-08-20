var { Cc } = require("chrome"),
    ios = Cc["@mozilla.org/network/io-service;1"]   .getService(Components.interfaces.nsIIOService),
    ssm = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Components.interfaces.nsIScriptSecurityManager),
    dsm = Cc["@mozilla.org/dom/storagemanager;1"]   .getService(Components.interfaces.nsIDOMStorageManager);
    uri = ios.newURI("http://forums.frontier.co.uk", "", null),
    principal = ssm.getCodebasePrincipal(uri),
    forum_storage = dsm.getLocalStorageForPrincipal(principal, "");
