#!/bin/sh

VERSION="$1"

if [ -z "$VERSION" ]
then
    echo "Usage: $0 <version-number>"
    exit 1
fi

if ! git diff --quiet
then
    echo "Please commit your changes before running this script."
    exit 1
fi

echo -n "Updating version to '$VERSION'... "

sed -i -e 's/\("version": *"\).*"/\1'"$VERSION"'"/' chrome/manifest.json firefox/harness-options.json
sed -i -e 's/<em:version>.*<\/em:version>/<em:version>'"$VERSION"'<\/em:version>/' firefox/install.rdf

echo done.
echo

git diff

echo
echo "Now do: git commit -a -m 'Updated version number to $VERSION' -m 'Actual command: $0 $VERSION'"
echo