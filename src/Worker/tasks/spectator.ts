import { z } from 'zod';
import { DefaultParameters } from '../types';
import { SpectatorSchema } from '$/lib/Riot/schemes';
import { getLocale } from '$/lib/langs';
import { Background } from '$/lib/Imaging/Background';
import {
    AssetType,
    getAsset,
    getMaps,
    getRiotLanguageFromDiscordLocale,
    getRunesReforged,
    getSummonerSpells
} from '$/lib/Assets';
import {
    fixChampName,
    getRune,
    getRuneTree,
    putSumms,
    save,
    spectatorPerksNormalize,
    toMMSS
} from '../utilities';
import { Blank } from '$/lib/Imaging/Blank';
import { Text } from '$/lib/Imaging/Text';
import { Color } from '$/lib/Imaging/types';
import { getChampionsMap } from '$/lib/utilities';
import { Image } from '$/lib/Imaging/Image';

export type SpectatorData = {
    queueId: number;
    gameLength: number;
    mapId: number;
    participants: z.infer<typeof SpectatorSchema>['participants'];
} & DefaultParameters;

export default async (data: SpectatorData) => {
    const lang = getLocale(data.locale);

    const background = new Background(
        (await getAsset(AssetType.OTHER, 'background.png'))!
    );
    const backgroundSize = await background.getSize();

    const HEADER_HEIGHT = 100;
    const HEADER_PADDING = 40;
    const HEADER_WIDTH = backgroundSize.width - HEADER_PADDING * 2;

    const headerBox = new Blank(
        {
            x: HEADER_PADDING,
            y: HEADER_PADDING
        },
        {
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT
        }
    );
    background.addElement(headerBox);

    //Queue name
    const queueName = new Text(
        lang.queues[data.queueId as keyof typeof lang.queues],
        {
            x: 0,
            y: 0
        },
        {
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT
        },
        60,
        Color.WHITE,
        'start',
        'bold',
        true
    );
    headerBox.addElement(queueName);

    const time = new Text(
        toMMSS(data.gameLength),
        {
            x: 0,
            y: 0
        },
        {
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT
        },
        80,
        Color.WHITE,
        'middle',
        'bold',
        true
    );
    headerBox.addElement(time);

    const riotLocale = getRiotLanguageFromDiscordLocale(data.locale);

    const maps = (await getMaps(riotLocale))!;
    const map = maps.data[data.mapId.toString()];

    const mapName = new Text(
        map.MapName,
        {
            x: 0,
            y: 0
        },
        {
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT
        },
        60,
        Color.WHITE,
        'end',
        'bold',
        true
    );
    headerBox.addElement(mapName);

    const mainLayout = new Blank(
        {
            x: 0,
            y: HEADER_HEIGHT + HEADER_PADDING * 2
        },
        {
            width: backgroundSize.width,
            height: backgroundSize.height - HEADER_HEIGHT - HEADER_PADDING * 3
        }
    );
    background.addElement(mainLayout);
    const mainLayoutSize = await mainLayout.getSize();

    //Initialize team blanks
    const padding = 40;
    const teamBlankWidth = Math.floor(backgroundSize.width / 2 - padding);
    const teamHeight = mainLayoutSize.height;
    const teamCount = data.participants.reduce(
        (acc, player) => acc.add(player.teamId),
        new Set<number>()
    ).size;
    const teams = Array.from({ length: teamCount }).map(
        (_, idx) =>
            new Blank(
                {
                    x: idx * teamBlankWidth + padding,
                    y: 0
                },
                {
                    width: teamBlankWidth,
                    height: teamHeight
                }
            )
    );
    mainLayout.addElements(teams);

    //get player count
    const playerCount = data.participants.length;
    const playerHeight = 110;
    const space = Math.floor(
        (teamHeight - (playerCount / 2) * playerHeight) / (playerCount / 2 - 1)
    );

    const runesReforged = (await getRunesReforged(riotLocale))!;
    const summoners = (await getSummonerSpells(riotLocale))!;
    const champions = (await getChampionsMap(riotLocale))!;

    for (let i = 0; i < playerCount; ++i) {
        const player = data.participants[i];
        const teamIdx = player.teamId === 100 ? 0 : 1;
        const team = teams[teamIdx];
        const playerBlank = new Blank(
            {
                x: 0,
                y: (i % (playerCount / 2)) * (playerHeight + space)
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
                fixChampName(champions.get(player.championId)!.id) + '.png'
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

        const imageSize = await image.getSize();

        const [riotIdGameName, riotIdTagline] = player.riotId.split('#');

        //name
        const name = new Text(
            riotIdGameName.toLowerCase(),
            {
                x: imageSize.width,
                y: 0
            },
            {
                width: teamBlankWidth - playerHeight * 0.8,
                height: playerHeight / 2
            },
            30,
            player.puuid === data.puuid ? Color.YELLOW : Color.WHITE,
            teamIdx === 0 ? 'start' : 'end'
        );
        playerBlank.addElement(name);
        const tag = new Text(
            '#' + riotIdTagline,
            {
                x: imageSize.width,
                y: 20
            },
            {
                width: teamBlankWidth - playerHeight * 0.8,
                height: playerHeight / 2
            },
            20,
            player.puuid === data.puuid ? Color.YELLOW : Color.WHITE,
            teamIdx === 0 ? 'start' : 'end'
        );
        playerBlank.addElement(tag);

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
        const normalized = spectatorPerksNormalize(player.perks);
        const perkPlayer = {
            perks: normalized
        };
        const tree = getRuneTree(runesReforged, perkPlayer, 0);
        const mainRune = getRune(tree, perkPlayer, 0, 0);
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
        const secondaryTree = getRuneTree(runesReforged, perkPlayer, 1);

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
            {
                summoner1Id: player.spell1Id,
                summoner2Id: player.spell2Id
            },
            summoners,
            playerHeight,
            imageSpacing,
            RuneSumms,
            playerHeight / 2 + imageSpacing
        );
    }

    return save(background);
};
