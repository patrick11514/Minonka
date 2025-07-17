import {
    AssetType,
    getAsset,
    getRiotLanguageFromDiscordLocale,
    getRunesReforged,
    getSummonerSpells
} from '$/lib/Assets';
import { Background } from '$/lib/Imaging/Background';
import { RegularMatchSchema } from '$/lib/Riot/schemes';
import { Region } from '$/lib/Riot/types';
import { Locale } from 'discord.js';
import { z } from 'zod';
import {
    fixChampName,
    getPersistant,
    getRune,
    getRuneTree,
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
import { getMatchStatus, MatchStatus } from '$/lib/Riot/utilities';
import { conn } from '$/types/connection';
import api from '$/lib/Riot/api';
import { updateLpForUser } from '$/crons/lp';
import { getChampionsMap } from '$/lib/utilities';

export type MatchData = {
    region: Region;
    locale: Locale;
    myPuuid: string;
} & z.infer<typeof RegularMatchSchema>;

export default async (data: MatchData) => {
    const imageName = `${data.metadata.matchId}_${data.myPuuid}_${data.locale}.png`;

    if (persistantExists(imageName)) {
        return getPersistant(imageName);
    }

    const lang = getLocale(data.locale);

    const background = new Background(
        (await getAsset(AssetType.OTHER, 'background.png'))!
    );
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

    //Bans
    const BansHeight = 70;
    const CORNER_OFFSET = 60;
    const riotLanguage = getRiotLanguageFromDiscordLocale(data.locale);
    const champions = (await getChampionsMap(riotLanguage))!;
    const banX = (await getAsset(AssetType.OTHER, 'ban-x.png'))!;

    for (const team of data.info.teams) {
        const first = team.teamId === 100;
        const BANSWidth = Math.floor(
            (mainLayoutSize.width - STATSWidth - CORNER_OFFSET * 2) / 2
        );
        const bans = new Blank(
            {
                x: first ? CORNER_OFFSET : BANSWidth + STATSWidth + CORNER_OFFSET,
                y: CORNER_OFFSET
            },
            {
                width: BANSWidth,
                height: BansHeight
            }
        );
        const banList = team.bans;

        if (first) {
            bans.setReverse();
            banList.reverse();
        }

        mainLayout.addElement(bans);

        bans.addElements(
            (
                await banList.asyncMap(async (ban, idx) => {
                    const champion = champions.get(ban.championId!);
                    const image = champion
                        ? await getAsset(
                              AssetType.DDRAGON_CHAMPION,
                              fixChampName(champion.id) + '.png'
                          )
                        : await getAsset(AssetType.DDRAGON_PROFILEICON, '29.png');

                    const banImage = new Image(image!, {
                        x: idx * (BansHeight + 10),
                        y: 0
                    });

                    await banImage.resize({
                        width: BansHeight,
                        height: BansHeight
                    });

                    const banXImage = new Image(banX, {
                        x: idx * (BansHeight + 10),
                        y: 0
                    });

                    await banXImage.resize({
                        width: BansHeight,
                        height: BansHeight
                    });

                    return [banImage, banXImage];
                })
            ).flat()
        );
    }

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

    const matchStatus = getMatchStatus(data, data.myPuuid);

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
            .innerJoin('account', 'account.id', 'match_lp.accountId')
            .selectAll()
            .where((eb) =>
                eb.and([
                    eb('matchId', '=', data.metadata.matchId),
                    eb('account.puuid', '=', data.myPuuid)
                ])
            )
            .executeTakeFirst();
        let lpGain = null as number | null;

        if (lp) {
            lpGain = lp.gain;
        } else {
            //check if its latest match and if yes, calculate lp for it
            const lastMatch = await api[data.region].match.ids(
                data.info.participants.find((p) => p.puuid === data.myPuuid)!.puuid,
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
                    .where('puuid', '=', data.myPuuid)
                    .executeTakeFirst();
                if (userData) {
                    await updateLpForUser({
                        id: userData.id,
                        region: userData.region,
                        puuid: userData.puuid,
                        gameName: userData.gameName,
                        tagLine: userData.tagLine
                    });

                    //check if db includes LP for this match
                    const lp = await conn
                        .selectFrom('match_lp')
                        .selectAll()
                        .where((eb) =>
                            eb.and([
                                eb('matchId', '=', data.metadata.matchId),
                                eb('accountId', '=', userData.id)
                            ])
                        )
                        .executeTakeFirst(); //should be there now
                    if (lp) {
                        lpGain = lp.gain;
                    }
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
            lpGain === null ? Color.WHITE : lpGain > 0 ? Color.GREEN : Color.RED,
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

    const runesReforged = (await getRunesReforged(riotLocale))!;
    const summoners = (await getSummonerSpells(riotLocale))!;
    const itemBackground = (await getAsset(AssetType.OTHER, 'itemBackground.png'))!;

    const minion = (await getAsset(AssetType.OTHER, 'minion.png'))!;
    const sword = (await getAsset(AssetType.OTHER, 'sword.png'))!;
    const coins = (await getAsset(AssetType.OTHER, 'coins.png'))!;

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
            (await getAsset(
                AssetType.DDRAGON_CHAMPION,
                fixChampName(player.championName) + '.png'
            ))!,
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
            player.puuid === data.myPuuid ? Color.YELLOW : Color.WHITE,
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
            player.puuid === data.myPuuid ? Color.YELLOW : Color.WHITE,
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
        const tree = getRuneTree(runesReforged, player, 0);
        const mainRune = getRune(tree, player, 0, 0);
        const primary = new Image(
            (await getAsset(AssetType.DDRAGON_IMG, mainRune.icon))!,
            {
                x: 0,
                y: 0
            }
        );
        await primary.resize({
            width: Math.floor(playerHeight / 2) - imageSpacing
        });
        RuneSumms.addElement(primary);

        //Secondary
        const secondaryTree = getRuneTree(runesReforged, player, 1);

        const secondary = new Image(
            (await getAsset(AssetType.DDRAGON_IMG, secondaryTree.icon))!,
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
        await putSumms(
            player,
            summoners,
            playerHeight,
            imageSpacing,
            RuneSumms,
            playerHeight / 2 + imageSpacing
        );

        //items
        await putItems(
            player,
            begin,
            imageWidth,
            imageSpacing,
            playerBlank,
            teamIdx > 0,
            itemBackground,
            4
        );

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
