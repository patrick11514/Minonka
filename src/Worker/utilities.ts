import { Background } from '$/lib/Imaging/Background';
import { env } from '$/types/env';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { CherryMatchData } from './tasks/cherryMatch';
import { MatchData } from './tasks/match';
import { ExtractAssetResult } from './types';
import { AssetType, getAsset, getRunesReforged, getSummonerSpells } from '$/lib/Assets';
import { Image } from '$/lib/Imaging/Image';
import { Blank } from '$/lib/Imaging/Blank';
import { Text } from '$/lib/Imaging/Text';
import { Color } from '$/lib/Imaging/types';
import { DePromise, OmitUnion } from '$/types/types';
import { ParticipantSchema } from '$/lib/Riot/schemes';
import { z } from 'zod';

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
    blank: Blank,
    xOffset: number
) => {
    await Promise.all(
        [player.summoner1Id, player.summoner2Id].map(async (summKey, idx) => {
            const summoner = Object.values(summoners.data).find(
                (summ) => summ.key === summKey
            )!;
            const summ = new Image(
                (await getAsset(AssetType.DDRAGON_SPELL, summoner.image.full))!,
                {
                    x: xOffset,
                    y: Math.floor(idx * (playerHeight / 2 + imageSpacing))
                }
            );
            await summ.resize({
                width: Math.floor(playerHeight / 2) - imageSpacing
            });
            blank.addElement(summ);
        })
    );
};

export const putItems = async (
    player: (MatchData | CherryMatchData)['info']['participants'][number],
    begin: number,
    imageWidth: number,
    imageSpacing: number,
    playerBlank: Blank,
    reverse: boolean,
    itemBackground: ExtractAssetResult<typeof getAsset>,
    imageBorder: number
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

export const fixChampName = (champName: string) => {
    //because FiddleSticks is written with capital S, but in files it's lowercase
    if (champName === 'FiddleSticks') {
        return 'Fiddlesticks';
    }
    return champName;
};

export const getRuneTree = (
    runesReforged: OmitUnion<DePromise<ReturnType<typeof getRunesReforged>>, null>,
    player: z.infer<typeof ParticipantSchema>,
    idx: number
) => {
    const root = player.perks.styles[idx];

    const tree = runesReforged.find(
        (rune) =>
            rune.id === root.style ||
            root.selections
                .map((selection) => selection.perk)
                .some((perkId) =>
                    rune.slots
                        .map((slot) => slot.runes.map((rune) => rune.id))
                        .flat()
                        .includes(perkId)
                )
    );

    if (!tree) {
        throw new Error('Failed to find tree');
    }

    return tree;
};

export const getRune = (
    tree: ReturnType<typeof getRuneTree>,
    player: z.infer<typeof ParticipantSchema>,
    idx: number,
    selection: number
) => {
    return tree.slots[0].runes.find(
        (rune) => rune.id === player.perks.styles[idx].selections[selection].perk
    )!;
};
