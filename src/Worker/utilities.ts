import { AssetType, getAsset, getRunesReforged, getSummonerSpells } from '$/lib/Assets';
import { asyncExists } from '$/lib/fsAsync';
import { Background } from '$/lib/Imaging/Background';
import { Blank } from '$/lib/Imaging/Blank';
import { Image } from '$/lib/Imaging/Image';
import { Text } from '$/lib/Imaging/Text';
import { Color } from '$/lib/Imaging/types';
import { SpectatorSchema } from '$/lib/Riot/schemes';
import { env } from '$/types/env';
import { DePromise, FileResult, OmitUnion } from '$/types/types';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { ExtractAssetResult } from './types';

// Check if we're running in a worker environment (not on main server)
const isRemoteWorker = process.env.WORKER_MODE === 'remote';

// Global websocket reference for remote worker communication
let workerWebSocket: WebSocket | null = null;

export const setWorkerWebSocket = (ws: WebSocket) => {
    workerWebSocket = ws;
};

export const save = async (image: Background): Promise<FileResult> => {
    const renderedImage = await image.render();

    if (isRemoteWorker) {
        // Return base64 data for remote workers
        return {
            type: 'temp',
            data: renderedImage.toString('base64')
        };
    } else {
        // Local mode - save to file and return path (backward compatibility)
        if (!(await asyncExists(env.CACHE_PATH))) {
            await fs.mkdir(env.CACHE_PATH, { recursive: true });
        }

        const name = crypto.randomBytes(16).toString('hex');
        const filePath = `${env.CACHE_PATH}/${name}.png`;

        await fs.writeFile(filePath, renderedImage);

        return {
            type: 'local',
            path: filePath
        };
    }
};

export const persistantExists = async (name: string): Promise<boolean> => {
    if (isRemoteWorker && workerWebSocket) {
        // For remote workers, send a request to check if file exists
        return new Promise((resolve) => {
            const requestId = crypto.randomBytes(16).toString('hex');

            // Set up a one-time listener for the response
            const messageHandler = (message: Buffer) => {
                const str = message.toString();
                if (str.startsWith('persistentResult')) {
                    const [, responseId, exists] = str.split(';');
                    if (responseId === requestId) {
                        workerWebSocket?.off('message', messageHandler);
                        resolve(exists === 'true');
                    }
                }
            };

            workerWebSocket?.on('message', messageHandler);
            workerWebSocket?.send(`checkPersistent;${requestId};${name}`);

            // Timeout after 5 seconds
            setTimeout(() => {
                workerWebSocket?.off('message', messageHandler);
                resolve(false);
            }, 5000);
        });
    } else {
        // Local mode - check filesystem directly
        return asyncExists(`${env.PERSISTANT_CACHE_PATH}/${name}`);
    }
};

export const getPersistant = (name: string): FileResult => {
    if (isRemoteWorker) {
        return {
            type: 'persistent',
            name: name
        };
    } else {
        return {
            type: 'local',
            path: `${env.PERSISTANT_CACHE_PATH}/${name}`
        };
    }
};

export const savePersistant = async (
    image: Background,
    name: string
): Promise<FileResult> => {
    const renderedImage = await image.render();

    if (isRemoteWorker) {
        // Return base64 data for remote workers
        return {
            type: 'persistent',
            data: renderedImage.toString('base64'),
            name: name
        };
    } else {
        // Local mode - save to file and return path (backward compatibility)
        if (!(await asyncExists(env.PERSISTANT_CACHE_PATH))) {
            await fs.mkdir(env.PERSISTANT_CACHE_PATH, { recursive: true });
        }

        const filePath = `${env.PERSISTANT_CACHE_PATH}/${name}`;
        await fs.writeFile(filePath, renderedImage);

        return {
            type: 'local',
            path: filePath
        };
    }
};

export const toMMSS = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
};

export const putSumms = async (
    player: {
        summoner1Id: number;
        summoner2Id: number;
    },
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
    player: {
        item0: number;
        item1: number;
        item2: number;
        item3: number;
        item4: number;
        item5: number;
        item6: number;
        visionScore: number;
    },
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

type NormalizedPerks = {
    styles: {
        style: number;
        selections: { perk: number }[];
    }[];
    statPerks: { defense: number; flex: number; offense: number };
};

export const getRuneTree = (
    runesReforged: OmitUnion<DePromise<ReturnType<typeof getRunesReforged>>, null>,
    player: {
        perks: NormalizedPerks;
    },
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
    player: {
        perks: NormalizedPerks;
    },
    idx: number,
    selection: number
) => {
    return tree.slots[0].runes.find(
        (rune) => rune.id === player.perks.styles[idx].selections[selection].perk
    )!;
};

export const spectatorPerksNormalize = (
    perks: z.infer<typeof SpectatorSchema>['participants'][number]['perks']
): NormalizedPerks => {
    const STYLES = ['primaryStyle', 'subStyle'];
    const STYLES_COUNT = [4, 2];

    const perksSTART = STYLES_COUNT.reduce((acc, curr) => acc + curr, 0);

    return {
        styles: STYLES.map((_, idx) => {
            const previous = STYLES_COUNT[idx - 1] ?? 0;
            const selections = perks.perkIds.slice(
                previous,
                previous + STYLES_COUNT[idx]
            );

            return {
                style:
                    STYLES[idx] === 'primaryStyle' ? perks.perkStyle : perks.perkSubStyle,
                selections: selections.map((perkId) => ({ perk: perkId }))
            };
        }),
        statPerks: {
            offense: perks.perkIds[perksSTART + 0],
            flex: perks.perkIds[perksSTART + 1],
            defense: perks.perkIds[perksSTART + 2]
        }
    };
};
