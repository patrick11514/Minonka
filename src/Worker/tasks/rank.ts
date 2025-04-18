import { Background } from '$/lib/Imaging/Background';
import { _Tier, _Rank, deCapitalize } from '$/lib/Riot/types';
import { DefaultParameters } from '../types';
import { AssetType, getAsset } from '$/lib/Assets';
import { save } from '../utilities';
import { Image } from '$/lib/Imaging/Image';
import { Text } from '$/lib/Imaging/Text';
import { Blank } from '$/lib/Imaging/Blank';
import { getLocale } from '$/lib/langs';
import { Color } from '$/lib/Imaging/types';

export type RankData = {
    ranks: {
        queueType: string;
        wins: number;
        losses: number;
        tier: _Tier;
        rank: _Rank;
        leaguePoints: number;
    }[];
} & DefaultParameters;

const Sort = {
    RANKED_SOLO_5x5: 0,
    RANKED_FLEX_SR: 1
};

export default async (data: RankData) => {
    const lang = getLocale(data.locale);

    const background = new Background(
        (await getAsset(AssetType.OTHER, 'background.png'))!
    );
    const backgroundSize = await background.getSize();

    const profilePart = new Blank(
        {
            x: 0,
            y: 0
        },
        {
            width: 800,
            height: backgroundSize.height
        }
    );

    //PROFILE PART
    const profilePartSize = await profilePart.getSize();
    background.addElement(profilePart);

    //REGION
    const region = new Text(
        lang.regions[data.region],
        {
            x: 'center',
            y: 35
        },
        {
            width: profilePartSize.width,
            height: 40
        },
        40,
        Color.WHITE,
        'middle'
    );
    profilePart.addElement(region);

    //LEVEL
    const levelBackground = new Image((await getAsset(AssetType.OTHER, 'level.png'))!, {
        x: 'center',
        y: 100
    });
    await levelBackground.resize({
        width: 0.75
    });
    const levelBgSize = await levelBackground.getSize();
    profilePart.addElement(levelBackground);

    const levelText = new Text(
        data.level.toString(),
        {
            x: 'center',
            y: 100
        },
        {
            width: levelBgSize.width,
            height: levelBgSize.height
        },
        40,
        Color.WHITE,
        'middle'
    );
    profilePart.addElement(levelText);

    //PROFILE PICTURE
    const profile = new Image(
        (await getAsset(AssetType.DDRAGON_PROFILEICON, data.profileIconId + '.png'))!,
        {
            x: 'center',
            y: 'center'
        }
    );
    await profile.resize({
        width: 360
    });
    profilePart.addElement(profile);

    //NAME
    const name = new Text(
        data.gameName + '#' + data.tagLine,
        {
            x: 'center',
            y: profilePartSize.height - 200
        },
        {
            width: profilePartSize.width,
            height: 120
        },
        50,
        Color.WHITE,
        'middle'
    );
    profilePart.addElement(name);

    //insert ranks
    const ranks = data.ranks.sort((a, b) => {
        return (
            Sort[a.queueType as keyof typeof Sort] -
            Sort[b.queueType as keyof typeof Sort]
        );
    });

    const width = (backgroundSize.width - profilePartSize.width) / ranks.length;
    for (let i = 0; i < ranks.length; ++i) {
        const rank = ranks[i];

        const rankBlank = new Blank(
            {
                x: profilePartSize.width + width * i,
                y: 0
            },
            {
                height: backgroundSize.height,
                width: width
            }
        );
        const blankSize = await rankBlank.getSize();
        background.addElement(rankBlank);

        //QUEUE TYPE
        const queueType = new Text(
            lang.rank.queues[rank.queueType as keyof typeof lang.rank.queues],
            {
                x: 'center',
                y: 40
            },
            {
                width: blankSize.width,
                height: 60
            },
            50,
            Color.WHITE,
            'middle'
        );
        rankBlank.addElement(queueType);

        //rank name
        const text = new Text(
            lang.rank.tiers[rank.tier] + ' ' + rank.rank,
            {
                x: 'center',
                y: 80 + 60
            },
            {
                width: blankSize.width,
                height: 60
            },
            50,
            Color[rank.tier],
            'middle'
        );
        rankBlank.addElement(text);

        //rank icon
        const rankIcon = new Image(
            (await getAsset(AssetType.RANK, 'Rank=' + deCapitalize(rank.tier) + '.png'))!,
            {
                x: 'center',
                y: 180
            }
        );
        await rankIcon.resize({
            width: 0.25
        });
        const iconSize = await rankIcon.getSize();
        rankBlank.addElement(rankIcon);

        //LP
        const lp = new Text(
            rank.leaguePoints + ' LP',
            {
                x: 'center',
                y: iconSize.height + (rankIcon.position.y as number) + 10
            },
            {
                width: blankSize.width,
                height: 60
            },
            50,
            Color.WHITE,
            'middle'
        );
        rankBlank.addElement(lp);

        //WR
        const wr = (rank.wins / (rank.wins + rank.losses)) * 100;
        const WR = new Text(
            'WR: ' + wr.toFixed(2) + '%',
            {
                x: 'center',
                y: (lp.position.y as number) + 60 + 20
            },
            {
                width: blankSize.width,
                height: 60
            },
            50,
            wr >= 50 ? Color.GREEN : Color.RED,
            'middle'
        );
        rankBlank.addElement(WR);

        //WINS
        const wins = new Text(
            lang.rank.wins + ' - ' + rank.wins,
            {
                x: 'center',
                y: (WR.position.y as number) + 60 + 20
            },
            {
                width: blankSize.width,
                height: 60
            },
            50,
            Color.GREEN,
            'middle'
        );
        rankBlank.addElement(wins);

        //LOSSES
        const losses = new Text(
            lang.rank.losses + ' - ' + rank.losses,
            {
                x: 'center',
                y: (wins.position.y as number) + 60
            },
            {
                width: blankSize.width,
                height: 60
            },
            50,
            Color.RED,
            'middle'
        );
        rankBlank.addElement(losses);
    }

    return save(background);
};
