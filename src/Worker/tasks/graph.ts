import { Background } from '$/lib/Imaging/Background';
import { Blank } from '$/lib/Imaging/Blank';
import { Text } from '$/lib/Imaging/Text';
import { Color } from '$/lib/Imaging/types';
import { getLocale } from '$/lib/langs';
import { _Rank, _Tier, Rank } from '$/lib/Riot/types';
import { AssetType, getAsset } from '$/lib/Assets';
import { save } from '../utilities';
import { DefaultParameters } from '../types';
import sharp from 'sharp';

export type GraphData = {
    lpHistory: {
        time: Date;
        LP: number;
        tier: _Tier;
        rank: _Rank;
    }[];
    queue: string;
} & DefaultParameters;

const GRAPH_WIDTH = 1200;
const GRAPH_HEIGHT = 800;
const PADDING = 80;
const GRAPH_AREA_WIDTH = GRAPH_WIDTH - PADDING * 2;
const GRAPH_AREA_HEIGHT = GRAPH_HEIGHT - PADDING * 2;

export default async (data: GraphData) => {
    const lang = getLocale(data.locale);

    if (data.lpHistory.length === 0) {
        // Return error image or simple message
        const background = new Background(
            (await getAsset(AssetType.OTHER, 'background.png'))!
        );
        const errorText = new Text(
            'No LP history data available',
            { x: 'center', y: 'center' },
            { width: GRAPH_WIDTH, height: 100 },
            40,
            Color.WHITE,
            'middle'
        );
        background.addElement(errorText);
        return save(background);
    }

    // Create blank canvas for the graph
    const background = new Background(
        (await getAsset(AssetType.OTHER, 'background.png'))!
    );

    // Calculate LP values for the graph
    const lpValues = data.lpHistory.map((entry) => {
        return new Rank({
            tier: entry.tier,
            rank: entry.rank,
            leaguePoints: entry.LP
        }).getTotalLp();
    });

    const minLp = Math.min(...lpValues);
    const maxLp = Math.max(...lpValues);
    const lpRange = maxLp - minLp || 100; // Avoid division by zero

    // Title
    const queueName =
        lang.rank.queues[data.queue as keyof typeof lang.rank.queues] || data.queue;
    const title = new Text(
        `${data.gameName}#${data.tagLine} - ${queueName}`,
        { x: 'center', y: 20 },
        { width: GRAPH_WIDTH, height: 50 },
        40,
        Color.WHITE,
        'middle'
    );
    background.addElement(title);

    // Draw axes
    const graphArea = new Blank(
        { x: PADDING, y: PADDING },
        { width: GRAPH_AREA_WIDTH, height: GRAPH_AREA_HEIGHT }
    );
    background.addElement(graphArea);

    // Create SVG for the line graph
    const points = data.lpHistory.map((entry, index) => {
        const x = (index / (data.lpHistory.length - 1 || 1)) * GRAPH_AREA_WIDTH;
        const lpValue = lpValues[index];
        const y = GRAPH_AREA_HEIGHT - ((lpValue - minLp) / lpRange) * GRAPH_AREA_HEIGHT;
        return { x, y };
    });

    // Build SVG path
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathData += ` L ${points[i].x} ${points[i].y}`;
    }

    // Create gradient fill
    let fillPathData = pathData;
    fillPathData += ` L ${points[points.length - 1].x} ${GRAPH_AREA_HEIGHT}`;
    fillPathData += ` L ${points[0].x} ${GRAPH_AREA_HEIGHT} Z`;

    const svg = `
        <svg width="${GRAPH_AREA_WIDTH}" height="${GRAPH_AREA_HEIGHT}">
            <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:rgb(0,200,255);stop-opacity:0.6" />
                    <stop offset="100%" style="stop-color:rgb(0,100,200);stop-opacity:0.1" />
                </linearGradient>
            </defs>
            <path d="${fillPathData}" fill="url(#lineGradient)" />
            <path d="${pathData}" stroke="rgb(0,200,255)" stroke-width="3" fill="none" />
            ${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="rgb(0,200,255)" />`).join('\n')}
        </svg>
    `;

    const svgBuffer = Buffer.from(svg);
    const graphImage = await sharp(svgBuffer).png().toBuffer();

    // Y-axis labels (LP values)
    const numLabels = 5;
    for (let i = 0; i <= numLabels; i++) {
        const lp = minLp + (lpRange * i) / numLabels;
        const y = PADDING + GRAPH_AREA_HEIGHT - (i / numLabels) * GRAPH_AREA_HEIGHT;

        const label = new Text(
            Math.round(lp).toString(),
            { x: 10, y: y - 15 },
            { width: PADDING - 20, height: 30 },
            20,
            Color.WHITE,
            'middle'
        );
        background.addElement(label);
    }

    // X-axis labels (dates)
    const numDateLabels = Math.min(5, data.lpHistory.length);
    for (let i = 0; i < numDateLabels; i++) {
        const index = Math.floor(
            (i / (numDateLabels - 1 || 1)) * (data.lpHistory.length - 1)
        );
        const entry = data.lpHistory[index];
        const date = new Date(entry.time);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

        const x = PADDING + (index / (data.lpHistory.length - 1 || 1)) * GRAPH_AREA_WIDTH;

        const label = new Text(
            dateStr,
            { x: x - 30, y: GRAPH_HEIGHT - PADDING + 10 },
            { width: 60, height: 30 },
            20,
            Color.WHITE,
            'middle'
        );
        background.addElement(label);
    }

    // Current LP info
    const latestEntry = data.lpHistory[data.lpHistory.length - 1];
    const currentRank = new Rank({
        tier: latestEntry.tier,
        rank: latestEntry.rank,
        leaguePoints: latestEntry.LP
    });
    const infoText = new Text(
        `Current: ${currentRank.toString(lang)} (${latestEntry.LP} LP)`,
        { x: 'center', y: GRAPH_HEIGHT - 30 },
        { width: GRAPH_WIDTH, height: 30 },
        25,
        Color[latestEntry.tier],
        'middle'
    );
    background.addElement(infoText);

    // Render the background first
    const baseImage = await background.render();

    // Now composite the graph SVG on top
    const finalImage = await sharp(baseImage)
        .composite([
            {
                input: graphImage,
                top: PADDING,
                left: PADDING
            }
        ])
        .toBuffer();

    // Save to file
    const tempPath = `/tmp/graph_${Date.now()}.png`;
    await sharp(finalImage).toFile(tempPath);

    return {
        path: tempPath,
        name: `graph_${data.gameName}_${data.tagLine}_${data.queue}.png`
    };
};
