import {
    AssetType,
    getAsset,
    getAssetPath,
    getChallenges,
    getRiotLanguageFromDiscordLocale
} from '$/lib/Assets';
import { Background } from '$/lib/Imaging/Background';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import { Rank } from '$/lib/Riot/types';
import fs from 'node:fs/promises';
import { save } from '../utilities';
import { Image } from '$/lib/Imaging/Image';
import { Text } from '$/lib/Imaging/Text';
import { DefaultParameters } from '../types';
import { Color } from '$/lib/Imaging/types';
import { ChallengeData } from '$/lib/Riot/schemes';
import { getHighestRank } from '$/lib/utilities';

export type SummonerData = {
    titleId?: string;
    crest: number;
    prestigeCrest: number;
    banner: number;
    challenges: number[];
    userChallenges: ChallengeData['challenges'];
} & DefaultParameters;

/*

BANNERS:
- Default: 1
- Ranked: 2 -> zjistit rank a pak rank_banner.png
- Ostatni sedi podle cisla
- Soul fighter: 4
- Hall of legends 2024: Unkillable demon king: 9
- Fracture jinx: 11
- Radian seprent sett: 12 
- Welcome to Noxus: 13 

crests:
- level -> prestige_crest_lvl_XXX.png
- 2 -> ranked -> rank_base.png

*/

export default async (data: SummonerData) => {
    const banners = await fs.readdir(await getAssetPath(AssetType.BANNER, ''));

    const lang = getLocale(data.locale);

    let highestRank;
    if (
        data.crest === 2 ||
        (data.crest == 1 && data.prestigeCrest == 0) ||
        data.banner === 2
    ) {
        highestRank = new Rank(await getHighestRank(data.puuid, data.region, lang));
    }

    let banner: Buffer<ArrayBufferLike>;

    if (data.banner == 2) {
        const asset = await getAsset(
            AssetType.BANNER,
            highestRank!.getTier().toLowerCase() + '_banner.png'
        );
        if (!asset) {
            banner = (await getAsset(AssetType.BANNER, '1_unranked_banner.png'))!;
        } else {
            banner = asset;
        }
    } else {
        const bannerName = banners.find(
            (b) => b.split('_')[0] === data.banner.toString()
        )!;
        if (!bannerName) {
            banner = (await getAsset(AssetType.BANNER, '1_unranked_banner.png'))!;
        } else {
            banner = (await getAsset(AssetType.BANNER, bannerName))!;
        }
    }

    ///BACKGROUND
    const background = new Background(banner);
    const backgroundSize = await background.getSize();
    const levelBackground = new Image((await getAsset(AssetType.OTHER, 'level.png'))!, {
        x: 'center',
        y: 50
    });
    await levelBackground.resize({
        width: 0.3
    });
    background.addElement(levelBackground);

    //REGION
    const region = new Text(
        lang.regions[data.region],
        {
            x: 'center',
            y: 10
        },
        {
            width: 80,
            height: 20
        },
        15,
        Color.WHITE,
        'middle'
    );
    background.addElement(region);

    ///LEVEL
    const levelBgSize = await levelBackground.getSize();
    const text = new Text(
        data.level.toString(),
        {
            x: 'center',
            y: 50
        },
        {
            width: levelBgSize.width,
            height: levelBgSize.height
        },
        18,
        Color.WHITE,
        'middle'
    );
    background.addElement(text);

    //PROFILE PICTURE
    const profileIcon = new Image(
        (await getAsset(AssetType.DDRAGON_PROFILEICON, data.profileIconId + '.png'))!,
        {
            x: 'center',
            y: 120
        }
    );

    await profileIcon.resize({
        width: 100
    });
    await profileIcon.roundify();
    background.addElement(profileIcon);

    //CREST
    if (data.crest === 2 || (data.crest == 1 && data.prestigeCrest == 0)) {
        const crest = new Image(
            (await getAsset(
                AssetType.CREST,
                `${highestRank!.getTier().toLowerCase()}_base.png`
            ))!,
            {
                x: 'center',
                y: -40
            }
        );

        await crest.resize({
            width: 0.8
        });

        background.addElement(crest);

        if (highestRank!.isTiered()) {
            //render Text in crest for division
            const division = highestRank!.getRank();
            const divisionText = new Text(
                division,
                {
                    x: 'center',
                    y: 100
                },
                {
                    width: 40,
                    height: 40
                },
                15,
                Color.WHITE,
                'middle'
            );
            background.addElement(divisionText);
        }
    } else {
        const crest = new Image(
            (await getAsset(
                AssetType.CREST,
                `prestige_crest_lvl_${data.prestigeCrest.toString().padStart(3, '0')}.png`
            ))!,
            {
                x: 'center',
                y: 45
            }
        );
        await crest.resize({
            width: 0.45
        });
        background.addElement(crest);
    }

    //name
    const name = new Text(
        data.gameName + '#' + data.tagLine,
        {
            x: 'center',
            y: Math.floor(backgroundSize.height / 2) - 15
        },
        {
            width: backgroundSize.width,
            height: 40
        },
        20,
        Color.WHITE,
        'middle'
    );
    background.addElement(name);

    //title
    if (data.titleId !== undefined && !isNaN(parseInt(data.titleId))) {
        const lolLang = getRiotLanguageFromDiscordLocale(data.locale);
        const challenges = await getChallenges(lolLang);

        if (!challenges) {
            throw new Error(
                replacePlaceholders(lang.assets.error, lang.assets.challenges)
            );
        }

        const challengeId = parseInt(data.titleId.substring(0, 6));

        const challenge = challenges.find((c) => c.id === challengeId);
        if (challenge && challenge.thresholds !== undefined) {
            const reward = Object.values(challenge.thresholds)
                .find((t) => t.rewards)
                ?.rewards?.find(
                    (reward) => reward.category === 'TITLE' && reward.title !== undefined
                );
            if (!reward) {
                throw new Error(
                    replacePlaceholders(lang.assets.error, lang.assets.challenges)
                );
            }

            const text = new Text(
                reward.title!,
                {
                    x: 'center',
                    y: Math.floor(backgroundSize.height / 2) + 20
                },
                {
                    width: backgroundSize.width,
                    height: 20
                },
                18,
                Color.GRAY,
                'middle',
                'normal'
            );
            background.addElement(text);
        }
    }

    if (data.challenges.length > 0) {
        const center = Math.floor(backgroundSize.width / 2);
        const challengeWidth = 50;
        const challengeSpace = 10;
        const challengeBegin = Math.floor(center - challengeWidth * 1.5 - challengeSpace);

        const images = await Promise.all(
            data.challenges
                .map((challengeId) => {
                    const challenge = data.userChallenges.find(
                        (challenge) => challenge.challengeId === challengeId
                    );
                    if (!challenge) return undefined;
                    return `${challengeId}-${challenge.level}.png`;
                })
                .filter((ch) => ch !== undefined)
                .map(
                    async (challenge) =>
                        await getAsset(AssetType.DDRAGON_CHALLENGES, challenge)
                )
                .filter((ch) => ch !== null)
                .map(async (ch, i) => {
                    const img = new Image((await ch)!, {
                        y: Math.floor(backgroundSize.height / 2 + 60),
                        x: challengeBegin + (challengeWidth + challengeSpace) * i
                    });
                    await img.resize({
                        width: challengeWidth
                    });

                    return img;
                })
        );

        background.addElements(images);
    }

    return await save(background);
};
