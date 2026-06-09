#!/bin/bash
# DDRAGON THINGS
cd $(dirname "$0")

# Lock file management for concurrent updates
LOCK_FILE=".update-lock"

# Check if lock file exists
if [ -f "$LOCK_FILE" ]; then
    echo "Update already in progress (lock file exists), exiting..."
    exit 1
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Function to cleanup lock file on exit
cleanup() {
    rm -f "$LOCK_FILE"
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

DDRAGON_VERSION=$(curl https://ddragon.leagueoflegends.com/api/versions.json | jq -r ".[0]")

echo "Latest DDragon version: $DDRAGON_VERSION"

CURRENT_VERSION=$(cat ddragon/.version)
if [ "$CURRENT_VERSION" != "$DDRAGON_VERSION" ]; then
    echo "Downloading version $DDRAGON_VERSION"
    rm -r ddragon
    mkdir ddragon
    wget -q -O ddragon/ddragon.tgz https://ddragon.leagueoflegends.com/cdn/dragontail-$DDRAGON_VERSION.tgz
    cd ddragon
    tar -xzf ddragon.tgz
    mv $DDRAGON_VERSION _ROOT_
    echo $DDRAGON_VERSION > .version
    
    cd ..
fi

echo "DDragon is up to date"

# RANKS

if [ ! -d "ranks" ]; then
    echo "Downloading ranks"
    rm -r ranks
    mkdir ranks
    #URL: https://static.developer.riotgames.com/docs/lol/ranked-emblems-latest.zip
    wget -q -O ranks/ranks.zip https://static.developer.riotgames.com/docs/lol/ranked-emblems-latest.zip
    cd ranks
    unzip -q ranks.zip
    
    cd ..
fi

echo "Ranks are up to date"

# lane-rank-specific icons
# URL: https://static.developer.riotgames.com/docs/lol/ranked-positions.zip
if [ ! -d "lanes" ]; then
    echo "Downloading lane-rank-specific icons"
    rm -r lanes
    mkdir lanes
    wget -q -O lanes/lanes.zip https://static.developer.riotgames.com/docs/lol/ranked-positions.zip
    cd lanes
    unzip -q lanes.zip
fi

echo "Lane-rank-specific icons are up to date"