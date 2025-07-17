#!/bin/bash
# DDRAGON THINGS
cd $(dirname "$0")

DDRAGON_VERSION=$(curl https://ddragon.leagueoflegends.com/api/versions.json | jq -r ".[0]")

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

# Banners
# this should be always updated
# URL: https://raw.communitydragon.org/latest/game/assets/loadouts/regalia/banners/
# JSON URL: https://raw.communitydragon.org/json/latest/game/assets/loadouts/regalia/banners/

BANNER_FILES=$(curl -s https://raw.communitydragon.org/json/latest/game/assets/loadouts/regalia/banners/ | jq -r '.[].name')
if [ ! -d "banners" ]; then
  mkdir banners
else
  rm -r banners/*
fi

for file in $BANNER_FILES; do
    wget -q -O "banners/$file" "https://raw.communitydragon.org/latest/game/assets/loadouts/regalia/banners/$file"
done

# BANNER RENAMES
declare -A BANNER_RENAMES=(
    ["01_iron_banner"]="iron_banner"
    ["02_bronze_banner"]="bronze_banner"
    ["03_silver_banner"]="silver_banner"
    ["04_gold_banner"]="gold_banner"
    ["05_platinum_banner"]="platinum_banner"
    ["06_diamond_banner"]="diamond_banner"
    ["07_master_banner"]="master_banner"
    ["08_grandmaster_banner"]="grandmaster_banner"
    ["09_challenger_banner"]="challenger_banner"
    ["00_unranked_banner"]="1_unranked_banner"
    ["03_lny23_banner"]="3_lny23_banner"
    ["04_sf23_banner"]="4_sf23_banner"
    ["05_be_emporium_banner3"]="5_be_emporium_banner3"
    ["06_winterblessed_noble_banner"]="6_winterblessed_noble_banner"
    ["07_winterblessed_royal_banner"]="7_winterblessed_royal_banner"
    ["08_winterblessed_aurora_banner"]="8_winterblessed_aurora_banner"
    ["09_unkillable_demon_king_banner"]="9_unkillable_demon_king_banner"
)

for old_name in "${!BANNER_RENAMES[@]}"; do
    new_name=${BANNER_RENAMES[$old_name]}
    if [ -f "banners/$old_name.png" ]; then
        mv "banners/$old_name.png" "banners/$new_name.png"
    fi
done

