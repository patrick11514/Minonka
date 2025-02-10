#!/bin/bash
# DDRAGON THINGS
DDRAGON_VERSION=$(curl https://ddragon.leagueoflegends.com/api/versions.json | jq -r ".[0]")
echo "Downloading version $DDRAGON_VERSION"
rm -r ddragon
mkdir ddragon
wget -q -O ddragon/ddragon.tgz https://ddragon.leagueoflegends.com/cdn/dragontail-$DDRAGON_VERSION.tgz
cd ddragon
tar -xzf ddragon.tgz

cd ..

# RANKS
echo "Downloading ranks"
rm -r ranks
mkdir ranks
#URL: https://static.developer.riotgames.com/docs/lol/ranked-emblems-latest.zip
wget -q -O ranks/ranks.zip https://static.developer.riotgames.com/docs/lol/ranked-emblems-latest.zip
cd ranks
unzip -q ranks.zip

cd ..

# lane-rank-specific icons
# URL: https://static.developer.riotgames.com/docs/lol/ranked-positions.zip
echo "Downloading lane-rank-specific icons"
rm -r lanes
mkdir lanes
wget -q -O lanes/lanes.zip https://static.developer.riotgames.com/docs/lol/ranked-positions.zip
cd lanes
unzip -q lanes.zip
