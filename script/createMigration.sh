#!/bin/bash

# Check first argument for name
if [ -n "$1" ]; then
  NAME="$1"
else
  read -p "Enter migration name: " NAME
fi


# Convert name to lowercase and replace spaces with underscores
FILENAME=$(date +"%Y%m%d%H%M%S")_$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_').ts

# Create the file inside migrations directory
mkdir -p migrations
cat <<EOL > "migrations/$FILENAME"
/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely } from 'kysely';

export const up = async (conn: Kysely<any>) => {
  // Add migration logic here
}

export const down = async (conn: Kysely<any>) => {
  // Add rollback logic here
}
EOL

echo "Created migration: migrations/$FILENAME"
