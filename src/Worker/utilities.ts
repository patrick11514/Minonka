import { Background } from '$/lib/Imaging/Background';
import { env } from '$/types/env';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { CherryMatchData } from './tasks/cherryMatch';
import { MatchData } from './tasks/match';
import { ExtractAssetResult } from './types';
import { AssetType, getAsset, getSummonerSpells } from '$/lib/Assets';
import { Image } from '$/lib/Imaging/Image';
import { Blank } from '$/lib/Imaging/Blank';
import { Text } from '$/lib/Imaging/Text';
import { Color } from '$/lib/Imaging/types';

export const save = async (image: Background) => {
    if (!fs.existsSync(env.CACHE_PATH)) {
        fs.mkdirSync(env.CACHE_PATH);
    }

    const name = crypto.randomBytes(16).toString('hex');

    fs.writeFileSync(`${env.CACHE_PATH}/${name}.png`, await image.render());
    return `${env.CACHE_PATH}/${name}.png`;
};

export const persistantExists = (name: string) => {
    return fs.existsSync(`${env.PERSISTANT_CACHE_PATH}/${name}`);
};

export const getPersistant = (name: string) => {
    return `${env.PERSISTANT_CACHE_PATH}/${name}`;
};

export const savePersistant = async (image: Background, name: string) => {
    if (!fs.existsSync(env.PERSISTANT_CACHE_PATH)) {
        fs.mkdirSync(env.PERSISTANT_CACHE_PATH);
    }

    fs.writeFileSync(`${env.PERSISTANT_CACHE_PATH}/${name}`, await image.render());
    return `${env.PERSISTANT_CACHE_PATH}/${name}`;
};

export const toMMSS = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
};

export const putSumms = async (
    player: (MatchData | CherryMatchData)['info']['participants'][number],
    summoners: ExtractAssetResult<typeof getSummonerSpells>,
    playerHeight: number,
    imageSpacing: number,
    blank: Blank
) => {
    [player.summoner1Id, player.summoner2Id].forEach(async (summKey, idx) => {
        const summoner = Object.values(summoners.data).find(
            (summ) => summ.key === summKey
        )!;
        const summ = new Image(
            (await getAsset(AssetType.DDRAGON_SPELL, summoner.image.full))!,
            {
                x: playerHeight / 2 + imageSpacing,
                y: idx * (playerHeight / 2 + imageSpacing)
            }
        );
        await summ.resize({
            width: Math.floor(playerHeight / 2) - imageSpacing
        });
        blank.addElement(summ);
    });
};

export const putItems = async (
    player: (MatchData | CherryMatchData)['info']['participants'][number],
    begin: number,
    imageWidth: number,
    imageSpacing: number,
    playerBlank: Blank,
    reverse: boolean,
    itemBackground: ExtractAssetResult<typeof getAsset>
) => {
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
    if (reverse) {
        items.setReverse();
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
            (await getAsset(AssetType.DDRAGON_ITEM, item + '.png'))!,
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
};
