import { AssetType, getAsset } from '$/lib/Assets';
import { Background } from '$/lib/Imaging/Background';
import { Text } from '$/lib/Imaging/Text';
import { _Rank, _Tier } from '$/lib/Riot/types';
import { save } from '../utilities';
import { Color, Position } from '$/lib/Imaging/types';
import { Image } from '$/lib/Imaging/Image';
import { Blank } from '$/lib/Imaging/Blank';
import { Locale } from 'discord.js';
import { getLocale } from '$/lib/langs';

export type TeamData = {
    abbreviation: string;
    name: string;
    iconId: number;
    tier: number;
    captain: string;
    players: {
        summonerId: string;
        puuid: string;
        position:
        | 'UNSELECTED'
        | 'FILL'
        | 'TOP'
        | 'JUNGLE'
        | 'MIDDLE'
        | 'BOTTOM'
        | 'UTILITY';
        role: 'CAPTAIN' | 'MEMBER';
        profileIconId: number;
        level: number;
        highestRank: {
            tier: _Tier;
            rank: _Rank;
        } | null;
        gameName: string;
        tagLine: string;
    }[];
    locale: Locale;
};

export default async (data: TeamData) => {
    const lang = getLocale(data.locale);

    const background = new Background(
        (await getAsset(AssetType.OTHER, 'background.png'))!
    );
    const backgroundSize = await background.getSize();

    const text = `${data.abbreviation} | ${data.name}`.toUpperCase();
    const name = new Text(
        text,
        {
            x: 'center',
            y: 40
        },
        {
            width: backgroundSize.width,
            height: 80
        },
        50,
        Color.WHITE,
        'middle'
    );
    background.addElement(name);

    //NAME + ICON
    const nameSize = await name.getTextSize();

    const icon = new Image(
        (await getAsset(AssetType.OTHER, `clash/${data.iconId}.png`))!,
        {
            x: backgroundSize.width / 2 - nameSize.width / 2 - /*spacing*/ (100 + 20),
            y: 30
        }
    );
    await icon.resize({
        height: 100
    });
    background.addElement(icon);

    //CAPTAIN
    const captain = data.players.find(
        (player) => player.role === 'CAPTAIN' && data.captain === player.summonerId
    )!;

    const renderPlayer = async (
        container: Background | Blank,
        player: TeamData['players'][number],
        position: Position
    ) => {
        const containerSize = await container.getSize();
        //NAME
        const playerName = new Text(
            `${player.gameName}#${player.tagLine}`,
            {
                x: position.x,
                y: position.y
            },
            {
                width: 400,
                height: 40
            },
            30,
            Color.WHITE,
            'middle'
        );
        const playerNameSize = await playerName.getTextSize();
        container.addElement(playerName);

        //PROFILE ICON
        const x = Math.floor(
            position.x === 'center' ? containerSize.width / 2 : position.x
        );
        const textStart = Math.floor(x - playerNameSize.width / 2);
        const iconBox = new Blank(
            {
                x: textStart - 120 - 15,
                y: (position.y as number) - 15
            },
            {
                width: 130,
                height: 130
            }
        );
        container.addElement(iconBox);

        const icon = new Image(
            (await getAsset(
                AssetType.DDRAGON_PROFILEICON,
                `${player.profileIconId}.png`
            ))!,
            {
                x: 15,
                y: 30
            }
        );
        await icon.resize({
            height: 100
        });
        iconBox.addElement(icon);

        const lvlBackground = new Image((await getAsset(AssetType.OTHER, 'level.png'))!, {
            x: 'center',
            y: 30 - 26 / 2
        });
        await lvlBackground.resize({
            height: 26
        });
        iconBox.addElement(lvlBackground);

        const lvl = new Text(
            player.level.toString(),
            {
                x: 'center',
                y: 30 - 26 / 2
            },
            {
                width: 130,
                height: 26
            },
            20,
            Color.WHITE,
            'middle'
        );
        iconBox.addElement(lvl);

        if (player.role === 'CAPTAIN') {
            const captainIcon = new Image(
                (await getAsset(AssetType.OTHER, 'crown.png'))!,
                {
                    x: 'center',
                    y: 0
                }
            );
            await captainIcon.resize({
                width: 26
            });
            iconBox.addElement(captainIcon);
        }

        //RANK
        const rank = new Text(
            player.highestRank === null
                ? lang.unranked
                : lang.rank.tiers[player.highestRank.tier] +
                ' ' +
                player.highestRank.rank,
            {
                x: textStart,
                y: (position.y as number) + 40
            },
            {
                width: 400,
                height: 40
            },
            30,
            player.highestRank === null ? Color.GRAY : Color[player.highestRank.tier],
            'start',
            'bold',
            false,
            0
        );
        container.addElement(rank);

        //Position
        const _position = new Text(
            lang.clash.positions[player.position],
            {
                x: textStart,
                y: (position.y as number) + 80
            },
            {
                width: 400,
                height: 40
            },
            30,
            Color.WHITE,
            'start',
            'bold',
            false,
            0
        );
        container.addElement(_position);
    };

    await renderPlayer(background, captain, { x: 'center', y: 140 });

    const beginY = 200;

    const nonCaptainPlayers = data.players.filter((p) => p.role === 'MEMBER');
    const maxHeight = backgroundSize.height - beginY - /*padding from bottom*/ 100;

    for (let i = 0; i < nonCaptainPlayers.length; ++i) {
        const blank = new Blank(
            {
                x: Math.floor(((i % 2) * backgroundSize.width) / 2),
                y: Math.floor(beginY + ((i > 1 ? 1 : 0) * maxHeight) / 2)
            },
            {
                width: Math.floor(backgroundSize.width / 2),
                height: Math.floor(maxHeight / 2)
            }
        );
        await renderPlayer(blank, nonCaptainPlayers[i], { x: 'center', y: 40 });

        background.addElement(blank);
    }

    return save(background);
};
