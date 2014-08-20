.PHONY: default clean

NAME=frontier-forums-moderation-tools

default: build/$(NAME).user.js build/$(NAME).crx build/$(NAME).xpi

clean:
	rm -f build/$(NAME).user.js build/$(NAME).crx build/$(NAME).xpi

build/$(NAME).user.js: userscript/header.js shared/contentscript.js
	cat $^ > $@

build/$(NAME).crx: shared/* chrome.pem
	cp shared/contentscript.js shared/jquery.min.js chrome/
	google-chrome --pack-extension=chrome --pack-extension-key=chrome.pem > /dev/null
	mv chrome.crx $@

build/$(NAME).xpi: shared/*
	mkdir -p firefox/resources/addon-sdk/lib firefox/resources/$(NAME)/tests firefox/locale
	cd firefox && zip -rq ../$@ .

chrome.pem:
	google-chrome --pack-extension=chrome > /dev/null
