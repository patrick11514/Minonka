import {
    AssetType,
    getAsset,
    getAugments,
    getRiotLanguageFromDiscordLocale,
    getSummonerSpells
} from '$/lib/Assets';
import { Background } from '$/lib/Imaging/Background';
import { CherryMatchSchema } from '$/lib/Riot/schemes';
import { Region } from '$/lib/Riot/types';
import { Locale } from 'discord.js';
import { z } from 'zod';
import {
    fixChampName,
    getPersistant,
    persistantExists,
    putItems,
    putSumms,
    savePersistant,
    toMMSS
} from '../utilities';
import { Blank } from '$/lib/Imaging/Blank';
import { Text } from '$/lib/Imaging/Text';
import { getLocale } from '$/lib/langs';
import { Color } from '$/lib/Imaging/types';
import { Image } from '$/lib/Imaging/Image';
import { getArenaSubTeamPosition } from '$/lib/Riot/utilities';

export type CherryMatchData = {
    region: Region;
    locale: Locale;
    myPuuid: string;
} & z.infer<typeof CherryMatchSchema>;

export enum SubTeam {
    Poro,
    Minion,
    Scuttle,
    Krug,
    Raptor,
    Sentinel,
    Wolf,
    Gromp
}

const TeamIdToName = (id: number) => {
    switch (id) {
        case 1:
            return SubTeam.Poro;
        case 2:
            return SubTeam.Minion;
        case 3:
            return SubTeam.Scuttle;
        case 4:
            return SubTeam.Krug;
        case 5:
            return SubTeam.Raptor;
        case 6:
            return SubTeam.Sentinel;
        case 7:
            return SubTeam.Wolf;
        case 8:
            return SubTeam.Gromp;
    }

    return SubTeam.Poro;
};

export const subTeamMap = {
    [SubTeam.Poro]: 'poros',
    [SubTeam.Minion]: 'minions',
    [SubTeam.Scuttle]: 'scuttles',
    [SubTeam.Krug]: 'krugs',
    [SubTeam.Raptor]: 'raptors',
    [SubTeam.Sentinel]: 'sentinel',
    [SubTeam.Wolf]: 'wolves',
    [SubTeam.Gromp]: 'gromp'
} as const;

const MapSubTeamToName = (subteam: SubTeam) => {
    return subTeamMap[subteam];
};

export default async (data: CherryMatchData) => {
    const imageName = `${data.metadata.matchId}_${data.myPuuid}_${data.locale}.png`;

    if (await persistantExists(imageName)) {
        return getPersistant(imageName);
    }

    const lang = getLocale(data.locale);

    const background = new Background(
        (await getAsset(AssetType.OTHER, 'background.png'))!
    );
    const backgroundSize = await background.getSize();

    const DateHeight = 80;
    //
    const mainLayout = new Blank(
        {
            x: 0,
            y: 0
        },
        {
            width: backgroundSize.width,
            height: backgroundSize.height - DateHeight
        }
    );
    const mainLayoutSize = await mainLayout.getSize();
    background.addElement(mainLayout);

    const date = new Text(
        new Date(data.info.gameEndTimestamp).toLocaleString(),
        {
            x: 'center',
            y: backgroundSize.height - DateHeight
        },
        {
            width: backgroundSize.width,
            height: DateHeight
        },
        35,
        Color.WHITE,
        'middle'
    );
    background.addElement(date);

    //Main layout
    // TEAM 1 | STATS | TEAM 2 (IN REVERSE)
    // TEAM 1:
    // 1. PLAYER: (champion + lvl) NAME/KDA  RUNE1/RUNE2 SUMM1/SUMM2 ITEMS+WARD/MINIONS+DAMAGE+GOLD
    // ....
    //
    // STATS:
    // Victory/Lose Mode Duration (LP)
    //
    // TEAM 2:
    // 1. PLAYER: WARD+ITEMS/GOLD+DAMAGE+MINIONS SUMM1/SUMM2 RUNE1/RUNE2 KDA NAME (champion + lvl)
    // ....

    const STATSWidth = 500;
    const Stats = new Blank(
        {
            x: Math.floor((mainLayoutSize.width - STATSWidth) / 2),
            y: 0
        },
        {
            width: STATSWidth,
            height: mainLayoutSize.height - DateHeight
        }
    );
    mainLayout.addElement(Stats);

    const teamPosition = getArenaSubTeamPosition(data, data.myPuuid);

    //Place
    const SubTeamPosition = new Text(
        `${teamPosition}. ${lang.match.place}`,
        {
            x: 'center',
            y: 40
        },
        {
            width: STATSWidth,
            height: 100
        },
        100,
        teamPosition < 5 ? Color.GREEN : Color.RED,
        'middle'
    );
    const SubTeamPositionSize = await SubTeamPosition.getSize();
    Stats.addElement(SubTeamPosition);

    const otherSize = 50;
    const spacing = 10;

    //QUEUE
    const queue = new Text(
        lang.queues[data.info.queueId as keyof typeof lang.queues] ||
            `Queue ${data.info.queueId}`,
        {
            x: 'center',
            y:
                (SubTeamPosition.position.y as number) +
                SubTeamPositionSize.height +
                spacing
        },
        {
            width: STATSWidth,
            height: otherSize
        },
        otherSize,
        Color.WHITE,
        'middle'
    );
    Stats.addElement(queue);

    //TIME
    const time = new Text(
        toMMSS(data.info.gameDuration),
        {
            x: 'center',
            y: (queue.position.y as number) + otherSize + spacing
        },
        {
            width: STATSWidth,
            height: otherSize
        },
        otherSize,
        Color.WHITE,
        'middle'
    );
    Stats.addElement(time);

    const teams: CherryMatchData['info']['participants'][] = Array.from({
        length: 8
    }).map(() => []);

    for (const participant of data.info.participants) {
        teams[participant.playerSubteamId - 1].push(participant);
    }

    teams.sort((a, b) => {
        if (a.length === 0) {
            return 1;
        }
        if (b.length === 0) {
            return -1;
        }

        return a[0].subteamPlacement - b[0].subteamPlacement;
    });

    const padding = 20;
    const teamBlankWidth = Math.floor((backgroundSize.width - STATSWidth) / 2 - padding);
    const teamHeight = Math.floor(
        (mainLayoutSize.height - padding * 2) / (teams.length / 2)
    );
    const teamBlanks = teams.map(
        (_, idx) =>
            new Blank(
                {
                    x: Math.floor(idx / 4) * (teamBlankWidth + STATSWidth) + padding,
                    y: padding + padding * ((idx % 4) + 1) + (idx % 4) * teamHeight
                },
                {
                    width: teamBlankWidth,
                    height: teamHeight
                }
            )
    );

    background.addElements(teamBlanks);

    const riotLocale = getRiotLanguageFromDiscordLocale(data.locale);
    const augmentsData = (await getAugments(riotLocale))!;
    const summoners = (await getSummonerSpells(riotLocale))!;
    const itemBackground = (await getAsset(AssetType.OTHER, 'itemBackground.png'))!;

    const sword = (await getAsset(AssetType.OTHER, 'sword.png'))!;
    const coins = (await getAsset(AssetType.OTHER, 'coins.png'))!;

    const playerPadding = 10;
    const beginOffset = 150;
    for (const _teamIdx in teams) {
        const teamIdx = parseInt(_teamIdx);
        const team = teams[teamIdx];
        const blank = teamBlanks[teamIdx];

        if (team.length === 0) {
            continue;
        }

        const playerHeight = Math.floor(teamHeight / 2) - playerPadding;

        //Create player blanks
        const playerBlanks = team.map(
            (_, idx) =>
                new Blank(
                    {
                        x: beginOffset,
                        y: idx * playerHeight + idx * playerPadding
                    },
                    {
                        width: teamBlankWidth - beginOffset,
                        height: playerHeight
                    }
                )
        );

        const reverse = teamIdx > 3;

        if (reverse) {
            blank.setReverse();
            playerBlanks.map((blank) => blank.setReverse());
        }

        blank.addElements(playerBlanks);

        const teamType = TeamIdToName(team[0].playerSubteamId);
        const teamId = MapSubTeamToName(teamType);

        //addTeam Icon
        const iconSize = 80;
        const icon = new Image(
            (await getAsset(
                AssetType.COMMUNITY_DDRAGON,
                `game/assets/ux/cherry/teamicons/team${teamId}.png`
            ))!,
            {
                x: Math.floor((beginOffset - iconSize) / 2),
                y: 0
            }
        );
        await icon.resize({
            width: iconSize
        });
        blank.addElement(icon);

        const textSize = 25;
        const textColor = team.find((p) => p.puuid === data.myPuuid)
            ? Color.YELLOW
            : Color.WHITE;

        //position
        const position = new Text(
            `${teamIdx + 1}.`,
            {
                x: 0,
                y: iconSize
            },
            {
                width: beginOffset,
                height: 40
            },
            textSize,
            textColor,
            'middle',
            'bold',
            true
        );
        blank.addElement(position);

        //team text
        const text = new Text(
            lang.match.team,
            {
                x: 0,
                y: iconSize + textSize
            },
            {
                width: beginOffset,
                height: 40
            },
            textSize,
            textColor,
            'middle',
            'bold',
            true
        );
        blank.addElement(text);
        //team name text
        const name = new Text(
            lang.match.subTeam[teamId],
            {
                x: 0,
                y: iconSize + textSize * 2
            },
            {
                width: beginOffset,
                height: 40
            },
            textSize,
            textColor,
            'middle',
            'bold',
            true
        );
        blank.addElement(name);

        for (const playerIdx in team) {
            const player = team[playerIdx];
            const playerBlank = playerBlanks[playerIdx];
            const blankSize = await playerBlank.getSize();

            const eight = Math.floor(playerHeight * 0.8);
            const two = Math.floor(playerHeight * 0.2);

            //image + lvl
            const image = new Blank(
                {
                    x: 0,
                    y: 0
                },
                {
                    width: eight,
                    height: playerHeight
                }
            );
            playerBlank.addElement(image);
            const imageSize = await image.getSize();

            //champion
            const champion = new Image(
                (await getAsset(
                    AssetType.DDRAGON_CHAMPION,
                    fixChampName(player.championName) + '.png'
                ))!,
                {
                    x: 0,
                    y: Math.floor(two / 2)
                }
            );
            await champion.resize({
                height: eight
            });
            image.addElement(champion);

            //Level
            const level = new Text(
                player.champLevel.toString(),
                {
                    x: 'center',
                    y: eight
                },
                {
                    width: eight,
                    height: two
                },
                20,
                Color.WHITE,
                'middle',
                'bold',
                true
            );
            image.addElement(level);

            //name
            const name = new Text(
                player.riotIdGameName.toLowerCase(),
                {
                    x: imageSize.width,
                    y: 0
                },
                {
                    width: blankSize.width - imageSize.width,
                    height: Math.floor(playerHeight / 2)
                },
                20,
                player.puuid === data.myPuuid ? Color.YELLOW : Color.WHITE,
                teamIdx < 4 ? 'start' : 'end'
            );
            playerBlank.addElement(name);
            const tagLine = new Text(
                `#${player.riotIdTagline}`,
                {
                    x: imageSize.width,
                    y: 15
                },
                {
                    width: blankSize.width - imageSize.width,
                    height: Math.floor(playerHeight / 2)
                },
                15,
                player.puuid === data.myPuuid ? Color.YELLOW : Color.WHITE,
                teamIdx < 4 ? 'start' : 'end'
            );
            playerBlank.addElement(tagLine);

            //KDA
            const kda = new Text(
                `${player.kills}/${player.deaths}/${player.assists}`,
                {
                    x: imageSize.width,
                    y: Math.floor(playerHeight / 2)
                },
                {
                    width: blankSize.width - imageSize.width,
                    height: Math.floor(playerHeight / 2)
                },
                20,
                Color.WHITE,
                teamIdx < 4 ? 'start' : 'end'
            );
            playerBlank.addElement(kda);

            const imageSpacing = 2;
            const imageWidth = Math.floor(blankSize.height * 0.6);
            const begin = Math.floor(blankSize.width - imageWidth * 7 - imageSpacing * 6);
            const augmentWidth = Math.floor(blankSize.height / 2 - imageSpacing);

            //augments + summs
            const augmentsStartOffset = augmentWidth * 4 + imageSpacing * (4 + 2);
            const augments = new Blank(
                {
                    x: begin - augmentsStartOffset,
                    y: 0
                },
                {
                    width: augmentsStartOffset,
                    height: blankSize.height
                }
            );
            playerBlank.addElement(augments);
            if (reverse) {
                augments.setReverse();
            }

            const imageBorder = 2;
            for (let i = 1 as 1 | 2 | 3 | 4 | 5 | 6; i < 7; ++i) {
                const augment = player[`playerAugment${i}`];
                const augmentImageX = ((i - 1) % 3) * (augmentWidth + imageSpacing);
                const augmentImageY = i < 4 ? 0 : augmentWidth + imageSpacing;

                const background = new Image(itemBackground, {
                    x: augmentImageX,
                    y: augmentImageY
                });
                await background.resize({
                    width: augmentWidth
                });
                augments.addElement(background);

                const augmentData = augmentsData.augments.find(
                    (aug) => aug.id === augment
                );

                if (augmentData) {
                    const image = new Image(
                        (await getAsset(
                            AssetType.COMMUNITY_DDRAGON,
                            `game/${augmentData.iconLarge}`
                        ))!,
                        {
                            x: augmentImageX + imageBorder,
                            y: augmentImageY + imageBorder
                        }
                    );
                    await image.resize({
                        width: augmentWidth - imageBorder * 2
                    });
                    augments.addElement(image);
                }
            }

            //summoners
            await putSumms(
                player,
                summoners,
                blankSize.height,
                imageSpacing,
                augments,
                augmentWidth * 3 + imageSpacing * 4
            );

            //items + stats
            const itemStats = new Blank(
                {
                    x: begin,
                    y: 0
                },
                {
                    width: blankSize.width - begin,
                    height: blankSize.height
                }
            );
            playerBlank.addElement(itemStats);

            await putItems(
                player,
                begin,
                imageWidth,
                imageSpacing,
                playerBlank,
                reverse,
                itemBackground,
                imageBorder
            );

            const stats = new Blank(
                {
                    x: begin,
                    y: imageWidth
                },
                {
                    width: imageWidth * 7 + imageSpacing * 6,
                    height: playerHeight - imageWidth
                }
            );
            const statsSize = await stats.getSize();
            playerBlank.addElement(stats);

            if (reverse) {
                stats.setReverse();
            }

            const statList = [
                [sword, player.totalDamageDealt],
                [coins, player.goldEarned]
            ] as const;
            const statWidth = 150;
            const spacing = Math.floor(
                (statsSize.width - statWidth * statList.length) / (statList.length + 1)
            );

            let i2 = 0;
            const border = 6;
            const intl = new Intl.NumberFormat('cs-cz');

            for (const stat of statList) {
                const statBlank = new Blank(
                    {
                        x: spacing + i2 * (statWidth + spacing),
                        y: 0
                    },
                    {
                        width: statWidth,
                        height: statsSize.height
                    }
                );

                const image = new Image(stat[0], {
                    x: 0,
                    y: border
                });
                await image.resize({
                    height: statsSize.height - border * 2
                });
                const imageSize = await image.getSize();
                statBlank.addElement(image);

                const statText = new Text(
                    intl.format(stat[1]),
                    {
                        x: imageSize.width,
                        y: 0
                    },
                    {
                        width: statWidth,
                        height: statsSize.height
                    },
                    25,
                    Color.WHITE,
                    'start'
                );
                statBlank.addElement(statText);

                stats.addElement(statBlank);

                ++i2;
            }
        }
    }

    return savePersistant(background, imageName);
};
