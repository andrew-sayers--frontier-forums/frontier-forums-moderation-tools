#!/bin/sh

rm -rf doc
./jsdoc/jsdoc -d doc -c jsdoc-conf.json -t templates/jaguarjs $( sed -n '/contentScriptFiles/ { s/^.*\[ *"*\|"* *\].*$\|", "/ /g ; p }' conf/settings.json )
