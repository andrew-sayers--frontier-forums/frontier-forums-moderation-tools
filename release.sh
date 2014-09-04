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

if git rev-parse --verify --quiet "v$VERSION" > /dev/null
then
    echo "Please pick a new version number.  Here's the output of \`git tag\`:"
    git tag
    exit 1
fi

echo -n "Updating version to '$VERSION'... "
sed -i -e "s/\(version *\).*/\1$VERSION/" lib/config.txt
sed -i -e 's/\("version": *"\).*"/\1'"$VERSION"'"/' Chrome/manifest.json Firefox/package.json
echo done.

echo -n "Committing changes... "
git commit --quiet -a -m "Updated version number to $VERSION" -m "Actual command: $0 $VERSION"
echo done.

echo -n "Adding tag... "
git tag "v$VERSION"
echo done.

echo -n 'Making... '
make --quiet clean default
echo done.

if [ -x './deploy.sh' ]
then
    echo -n 'Deploying... '
    ./deploy.sh
    echo done.
else
    echo "Please deploy the files in the 'build' directory"
    echo "You can create a 'deploy.sh' script to automatically deploy changes"
fi
