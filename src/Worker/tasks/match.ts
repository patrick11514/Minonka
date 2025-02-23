import {
    AssetType,
    getAsset,
    getRiotLanguageFromDiscordLocale,
    getRunesReforged,
    getSummonerSpells
} from '$/lib/Assets';
import { Background } from '$/lib/Imaging/Background';
import { MatchSchema } from '$/lib/Riot/schemes';
import { Region } from '$/lib/Riot/types';
import { Locale } from 'discord.js';
import { z } from 'zod';
import { getPersistant, persistantExists, savePersistant, toMMSS } from '../utilities';
import { Blank } from '$/lib/Imaging/Blank';
import { Text } from '$/lib/Imaging/Text';
import { getLocale } from '$/lib/langs';
import { Color } from '$/lib/Imaging/types';
import { Image } from '$/lib/Imaging/Image';
import { getMatchStatus, MatchStatus } from '$/lib/Riot/utilities';
import { conn } from '$/types/connection';
import api from '$/lib/Riot/api';
import { updateLpForUser } from '$/crons/lp';

export type MatchData = {
    region: Region;
    locale: Locale;
    mySummonerId: string;
} & z.infer<typeof MatchSchema>;

export default async (data: MatchData) => {
    const imageName = data.metadata.matchId + '.png';

    if (persistantExists(imageName)) {
        return getPersistant(imageName);
    }

    const lang = getLocale(data.locale);

    const background = new Background(getAsset(AssetType.OTHER, 'background.png')!);
    const backgroundSize = await background.getSize();
    //MAIN LAYOUT have date at the bottom
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

    //@TODO MAKE LAYOUT FOR ARENAS AND ALSO CHANGE SCHEMA FOR THEM, BECAUSE MORE TEAMS, AND NO POSITIONS LIKE UTILITY, TOP....

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

    const matchStatus = getMatchStatus(data, data.mySummonerId);

    //Victory/Loss Text
    const VictoryLoss = new Text(
        lang.match.results[matchStatus],
        {
            x: 'center',
            y: 40
        },
        {
            width: STATSWidth,
            height: 100
        },
        100,
        matchStatus === MatchStatus.Win
            ? Color.GREEN
            : matchStatus === MatchStatus.Loss
              ? Color.RED
              : Color.GRAY,
        'middle'
    );
    const VictorySize = await VictoryLoss.getSize();
    Stats.addElement(VictoryLoss);

    const otherSize = 50;
    const spacing = 10;

    //QUEUE
    const queue = new Text(
        lang.queues[data.info.queueId],
        {
            x: 'center',
            y: (VictoryLoss.position.y as number) + VictorySize.height + spacing
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

    //LP
    //ranked
    if (data.info.queueId === 420 || data.info.queueId === 440) {
        //check if db includes LP for this match
        const lp = await conn
            .selectFrom('match_lp')
            .selectAll()
            .where('matchId', '=', data.metadata.matchId)
            .executeTakeFirst();
        let lpGain = null as number | null;

        if (lp) {
            lpGain = lp.gain;
        } else {
            //check if its latest match and if yes, calculate lp for it
            const lastMatch = await api[data.region].match.ids(
                data.info.participants.find((p) => p.summonerId === data.mySummonerId)!
                    .puuid,
                {
                    start: 0,
                    count: 1,
                    queue: data.info.queueId.toString()
                }
            );

            if (lastMatch.status && lastMatch.data[0] === data.metadata.matchId) {
                const userData = await conn
                    .selectFrom('account')
                    .selectAll()
                    .where('summoner_id', '=', data.mySummonerId)
                    .executeTakeFirst();
                if (!userData) return;

                await updateLpForUser({
                    id: userData.id,
                    region: userData.region,
                    summoner_id: userData.summoner_id,
                    puuid: userData.puuid,
                    gameName: userData.gameName,
                    tagLine: userData.tagLine
                });

                //check if db includes LP for this match
                const lp = await conn
                    .selectFrom('match_lp')
                    .selectAll()
                    .where('matchId', '=', data.metadata.matchId)
                    .executeTakeFirst(); //should be there now
                if (lp) {
                    lpGain = lp.gain;
                }
            }
        }

        //LP
        const lpText = new Text(
            `${lpGain === null ? '?' : lpGain} LP`,
            {
                x: 'center',
                y: (time.position.y as number) + otherSize + spacing
            },
            {
                width: STATSWidth,
                height: otherSize
            },
            otherSize,
            Color.WHITE,
            'middle'
        );
        Stats.addElement(lpText);
    }

    //Initialize team blanks
    const padding = 40;
    const teamBlankWidth = Math.floor((backgroundSize.width - STATSWidth) / 2 - padding);
    const teamHeight = mainLayoutSize.height - DateHeight;
    const teams = data.info.teams.map(
        (_, idx) =>
            new Blank(
                {
                    x: idx * (teamBlankWidth + STATSWidth) + padding,
                    y: padding * 2
                },
                {
                    width: teamBlankWidth,
                    height: teamHeight
                }
            )
    );
    background.addElements(teams);

    //get player count
    const playerCount = data.info.participants.length;
    const playerHeight = 110;
    const space = Math.floor(
        (teamHeight - DateHeight - (playerCount / 2) * playerHeight) /
            (playerCount / 2 - 1)
    );

    const riotLocale = getRiotLanguageFromDiscordLocale(data.locale);

    const runesReforged = getRunesReforged(riotLocale)!;
    const summoners = getSummonerSpells(riotLocale)!;
    const itemBackground = getAsset(AssetType.OTHER, 'itemBackground.png')!;

    const minion = getAsset(AssetType.OTHER, 'minion.png')!;
    const sword = getAsset(AssetType.OTHER, 'sword.png')!;
    const coins = getAsset(AssetType.OTHER, 'coins.png')!;

    for (let i = 0; i < playerCount; ++i) {
        const player = data.info.participants[i];
        const teamIdx = player.teamId === 100 ? 0 : 1;
        const team = teams[teamIdx];
        const playerBlank = new Blank(
            {
                x: 0,
                y: (i % (playerCount / 2)) * (playerHeight + space) + DateHeight
            },
            {
                width: teamBlankWidth,
                height: playerHeight
            }
        );
        if (teamIdx > 0) {
            playerBlank.setReverse();
        }

        team.addElement(playerBlank);

        //image + lvl
        const image = new Blank(
            {
                x: 0,
                y: 0
            },
            {
                width: playerHeight * 0.8,
                height: playerHeight
            }
        );
        playerBlank.addElement(image);

        //champion
        const champion = new Image(
            getAsset(AssetType.DDRAGON_CHAMPION, player.championName + '.png')!,
            {
                x: 0,
                y: (playerHeight * 0.2) / 2
            }
        );
        await champion.resize({
            height: playerHeight * 0.8
        });
        image.addElement(champion);

        //Level
        const level = new Text(
            player.champLevel.toString(),
            {
                x: 'center',
                y: playerHeight * 0.8
            },
            {
                width: playerHeight * 0.8,
                height: playerHeight * 0.2
            },
            23,
            Color.WHITE,
            'middle',
            'bold',
            true
        );
        image.addElement(level);

        const imageSize = await image.getSize();

        //name
        const name = new Text(
            player.riotIdGameName.toLowerCase(),
            {
                x: imageSize.width,
                y: 0
            },
            {
                width: teamBlankWidth - playerHeight * 0.8,
                height: playerHeight / 2
            },
            30,
            player.summonerId === data.mySummonerId ? Color.YELLOW : Color.WHITE,
            teamIdx === 0 ? 'start' : 'end'
        );
        playerBlank.addElement(name);
        const tag = new Text(
            '#' + player.riotIdTagline,
            {
                x: imageSize.width,
                y: 20
            },
            {
                width: teamBlankWidth - playerHeight * 0.8,
                height: playerHeight / 2
            },
            20,
            player.summonerId === data.mySummonerId ? Color.YELLOW : Color.WHITE,
            teamIdx === 0 ? 'start' : 'end'
        );
        playerBlank.addElement(tag);

        //KDA
        const kda = new Text(
            `${player.kills}/${player.deaths}/${player.assists}`,
            {
                x: imageSize.width,
                y: playerHeight / 2
            },
            {
                width: teamBlankWidth - playerHeight * 0.8,
                height: playerHeight / 2
            },
            30,
            Color.WHITE,
            teamIdx === 0 ? 'start' : 'end'
        );
        playerBlank.addElement(kda);

        const imageSpacing = 5;
        const imageWidth = playerHeight * 0.6;
        const begin = teamBlankWidth - (imageWidth * 7 + imageSpacing * 6);

        //Runes + Summs
        const RuneSumms = new Blank(
            {
                x: begin - (playerHeight + imageSpacing * 2),
                y: 0
            },
            {
                width: playerHeight,
                height: playerHeight
            }
        );
        playerBlank.addElement(RuneSumms);
        if (teamIdx > 0) {
            RuneSumms.setReverse();
        }

        //Runes
        //Primary
        const tree = runesReforged.find(
            (tree) => tree.id == player.perks.styles[0].style
        )!;
        const mainRune = tree.slots[0].runes.find(
            (rune) => rune.id === player.perks.styles[0].selections[0].perk
        )!;
        const primary = new Image(getAsset(AssetType.DDRAGON_IMG, mainRune.icon)!, {
            x: 0,
            y: 0
        });
        await primary.resize({
            width: Math.floor(playerHeight / 2) - imageSpacing
        });
        RuneSumms.addElement(primary);

        //Secondary
        const secondaryTree = runesReforged.find(
            (tree) => tree.id == player.perks.styles[1].style
        )!;
        const secondary = new Image(
            getAsset(AssetType.DDRAGON_IMG, secondaryTree.icon)!,
            {
                x: imageSpacing * 2,
                y: Math.floor(playerHeight / 2) + imageSpacing * 3
            }
        );
        await secondary.resize({
            width: Math.floor(playerHeight / 2) - imageSpacing * 5
        });
        RuneSumms.addElement(secondary);

        //Summs
        [player.summoner1Id, player.summoner2Id].forEach(async (summKey, idx) => {
            const summoner = Object.values(summoners.data).find(
                (summ) => summ.key === summKey
            )!;
            const summ = new Image(
                getAsset(AssetType.DDRAGON_SPELL, summoner.image.full)!,
                {
                    x: playerHeight / 2 + imageSpacing,
                    y: idx * (playerHeight / 2 + imageSpacing)
                }
            );
            await summ.resize({
                width: Math.floor(playerHeight / 2) - imageSpacing
            });
            RuneSumms.addElement(summ);
        });

        //items
        const items = new Blank(
            {
                x: begin,
                y: 0
            },
            {
                width: imageWidth * 7 + imageSpacing * 6,
                height: imageWidth
            }
        );
        playerBlank.addElement(items);
        if (teamIdx > 0) {
            items.setReverse();
        }

        //stats
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

        if (teamIdx > 0) {
            stats.setReverse();
        }

        //items
        for (let i = 0 as 0 | 1 | 2 | 3 | 4 | 5 | 6; i < 7; ++i) {
            const item = player[`item${i}`];
            const background = new Image(itemBackground, {
                x: i * (imageWidth + imageSpacing),
                y: 0
            });
            await background.resize({
                width: imageWidth,
                height: imageWidth
            });
            items.addElement(background);

            if (item === 0) continue;
            const imageBorder = 4;

            const itemImage = new Image(
                getAsset(AssetType.DDRAGON_ITEM, item + '.png')!,
                {
                    x: i * (imageWidth + imageSpacing) + imageBorder,
                    y: imageBorder
                }
            );
            await itemImage.resize({
                width: imageWidth - imageBorder * 2,
                height: imageWidth - imageBorder * 2
            });
            items.addElement(itemImage);

            //add vision score
            if (i === 6) {
                const vision = new Text(
                    player.visionScore.toString(),
                    {
                        x: i * (imageWidth + imageSpacing),
                        y: 0
                    },
                    {
                        width: imageWidth,
                        height: imageWidth
                    },
                    30,
                    Color.WHITE,
                    'middle',
                    'bold',
                    true
                );
                items.addElement(vision);
            }
        }

        //stats
        const statList = [
            [minion, player.totalMinionsKilled],
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

    return savePersistant(background, imageName);
};
