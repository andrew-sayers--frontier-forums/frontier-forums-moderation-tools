// ==UserScript==
// @name        Forum Moderation
// @namespace   http://www.pileofstuff.org/forum_moderation
// @description Tools to make forum moderation easier
// @include     http://forums.frontier.co.uk/*
// @version     1
// ==/UserScript==

(function() {
    var script = document.createElement('script');
    script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js';
    script.type = 'text/javascript';
    document.getElementsByTagName("head")[0].appendChild(script);
})();
