#!/bin/sh

./jsdoc-3.2.2/jsdoc -d doc -c jsdoc-conf.json -t templates/jaguarjs-jsdoc-master $( sed -n '/contentScriptFiles/ { s/^.*\[ *"*\|"* *\].*$\|", "/ /g ; p }' conf/settings.json )
