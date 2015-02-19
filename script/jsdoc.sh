#!/bin/bash

rm -rf doc
./jsdoc/jsdoc -d doc -c jsdoc-conf.json -t templates/jaguarjs $( echo "console.log($(< conf/settings.json ).contentScriptFiles.join(' '));" | nodejs )

sed -i -e 's/[ \t]*$//' doc/*.html