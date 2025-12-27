import { Background } from '$/lib/Imaging/Background';
import { Blank } from '$/lib/Imaging/Blank';
import { Image } from '$/lib/Imaging/Image';
import { Text } from '$/lib/Imaging/Text';
import { Color } from '$/lib/Imaging/types';
import { getLocale } from '$/lib/langs';
import { _Rank, _Tier, Rank, tier } from '$/lib/Riot/types';
import { conn } from '$/types/connection';
import { AssetType, getAsset } from '$/lib/Assets';
import { DefaultParameters } from '../types';
import { save } from '../utilities';
import sharp from 'sharp';

export type GraphData = {
    queue: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR';
} & DefaultParameters;

type LpDataPoint = {
    time: Date;
    tier: _Tier;
    rank: _Rank;
    lp: number;
    totalLp: number;
};

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 400;
const GRAPH_PADDING_LEFT = 80;
const GRAPH_PADDING_RIGHT = 40;
const GRAPH_PADDING_TOP = 40;
const GRAPH_PADDING_BOTTOM = 60;

const getTierColor = (t: _Tier): string => {
    return Color[t] || Color.WHITE;
};

const formatDate = (date: Date, locale: string): string => {
    return date.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric'
    });
};

const generateGraphSvg = (
    dataPoints: LpDataPoint[],
    width: number,
    height: number,
    locale: string
): string => {
    if (dataPoints.length === 0) {
        return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="white" font-size="24">No LP data available</text>
        </svg>`;
    }

    const graphWidth = width - GRAPH_PADDING_LEFT - GRAPH_PADDING_RIGHT;
    const graphHeight = height - GRAPH_PADDING_TOP - GRAPH_PADDING_BOTTOM;

    // Calculate min/max LP for scaling
    const totalLps = dataPoints.map((d) => d.totalLp);
    const minLp = Math.min(...totalLps);
    const maxLp = Math.max(...totalLps);
    const lpRange = maxLp - minLp || 100; // Avoid division by zero

    // Add some padding to the range
    const paddedMin = Math.max(0, minLp - lpRange * 0.1);
    const paddedMax = maxLp + lpRange * 0.1;
    const paddedRange = paddedMax - paddedMin;

    // Scale functions
    const scaleX = (index: number) =>
        GRAPH_PADDING_LEFT + (index / Math.max(1, dataPoints.length - 1)) * graphWidth;
    const scaleY = (lp: number) =>
        GRAPH_PADDING_TOP + graphHeight - ((lp - paddedMin) / paddedRange) * graphHeight;

    // Generate path for the line
    const pathPoints = dataPoints
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.totalLp)}`)
        .join(' ');

    // Generate gradient fill path
    const fillPath = `${pathPoints} L ${scaleX(dataPoints.length - 1)} ${GRAPH_PADDING_TOP + graphHeight} L ${GRAPH_PADDING_LEFT} ${GRAPH_PADDING_TOP + graphHeight} Z`;

    // Calculate tier boundaries for horizontal lines
    const tierBoundaries: { lp: number; label: string; color: string }[] = [];
    for (let i = 0; i < tier.length; i++) {
        const baseLp = i * 400;
        if (baseLp >= paddedMin && baseLp <= paddedMax) {
            tierBoundaries.push({
                lp: baseLp,
                label: tier[i],
                color: getTierColor(tier[i])
            });
        }
    }

    // Generate x-axis labels (show up to 6 dates)
    const xLabels: { x: number; label: string }[] = [];
    const labelCount = Math.min(6, dataPoints.length);
    for (let i = 0; i < labelCount; i++) {
        const index = Math.floor((i / (labelCount - 1 || 1)) * (dataPoints.length - 1));
        xLabels.push({
            x: scaleX(index),
            label: formatDate(dataPoints[index].time, locale)
        });
    }

    // Generate Y-axis labels
    const yLabelCount = 5;
    const yLabels: { y: number; label: string }[] = [];
    for (let i = 0; i < yLabelCount; i++) {
        const lp = paddedMin + (i / (yLabelCount - 1)) * paddedRange;
        yLabels.push({
            y: scaleY(lp),
            label: Math.round(lp).toString()
        });
    }

    // Generate data point circles with tier colors
    const circles = dataPoints
        .map(
            (d, i) =>
                `<circle cx="${scaleX(i)}" cy="${scaleY(d.totalLp)}" r="4" fill="${getTierColor(d.tier)}" stroke="white" stroke-width="1"/>`
        )
        .join('\n');

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                ${dataPoints.map((d, i) => `<stop offset="${(i / (dataPoints.length - 1 || 1)) * 100}%" stop-color="${getTierColor(d.tier)}"/>`).join('\n')}
            </linearGradient>
            <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="rgba(255,255,255,0.2)"/>
                <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
            </linearGradient>
        </defs>

        <!-- Grid lines -->
        ${tierBoundaries.map((b) => `<line x1="${GRAPH_PADDING_LEFT}" y1="${scaleY(b.lp)}" x2="${width - GRAPH_PADDING_RIGHT}" y2="${scaleY(b.lp)}" stroke="${b.color}" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="5,5"/>`).join('\n')}

        <!-- Axes -->
        <line x1="${GRAPH_PADDING_LEFT}" y1="${GRAPH_PADDING_TOP}" x2="${GRAPH_PADDING_LEFT}" y2="${GRAPH_PADDING_TOP + graphHeight}" stroke="white" stroke-width="2"/>
        <line x1="${GRAPH_PADDING_LEFT}" y1="${GRAPH_PADDING_TOP + graphHeight}" x2="${width - GRAPH_PADDING_RIGHT}" y2="${GRAPH_PADDING_TOP + graphHeight}" stroke="white" stroke-width="2"/>

        <!-- Fill area -->
        <path d="${fillPath}" fill="url(#fillGradient)"/>

        <!-- Line -->
        <path d="${pathPoints}" fill="none" stroke="url(#lineGradient)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Data points -->
        ${circles}

        <!-- Y-axis labels -->
        ${yLabels.map((l) => `<text x="${GRAPH_PADDING_LEFT - 10}" y="${l.y + 5}" text-anchor="end" fill="white" font-size="12" font-family="sans-serif">${l.label}</text>`).join('\n')}

        <!-- X-axis labels -->
        ${xLabels.map((l) => `<text x="${l.x}" y="${GRAPH_PADDING_TOP + graphHeight + 25}" text-anchor="middle" fill="white" font-size="12" font-family="sans-serif">${l.label}</text>`).join('\n')}

        <!-- Tier labels on the right -->
        ${tierBoundaries.map((b) => `<text x="${width - GRAPH_PADDING_RIGHT + 10}" y="${scaleY(b.lp) + 4}" text-anchor="start" fill="${b.color}" font-size="10" font-family="sans-serif">${b.label}</text>`).join('\n')}
    </svg>`;
};

export default async (data: GraphData) => {
    const lang = getLocale(data.locale);

    // Get account ID from puuid
    const account = await conn
        .selectFrom('account')
        .select(['id'])
        .where('puuid', '=', data.puuid)
        .executeTakeFirst();

    if (!account) {
        throw new Error('Account not found in database');
    }

    // Fetch LP history
    const lpHistory = await conn
        .selectFrom('lp')
        .select(['LP', 'queue', 'rank', 'tier', 'time'])
        .where('account_id', '=', account.id)
        .where('queue', '=', data.queue)
        .orderBy('time', 'asc')
        .execute();

    // Convert to data points with total LP
    const dataPoints: LpDataPoint[] = lpHistory.map((lp) => ({
        time: lp.time,
        tier: lp.tier as _Tier,
        rank: lp.rank as _Rank,
        lp: lp.LP,
        totalLp: new Rank({
            tier: lp.tier as _Tier,
            rank: lp.rank as _Rank,
            leaguePoints: lp.LP
        }).getTotalLp()
    }));

    // Create background
    const background = new Background(
        (await getAsset(AssetType.OTHER, 'background.png'))!
    );
    const backgroundSize = await background.getSize();

    // Header section
    const headerBlank = new Blank(
        { x: 0, y: 0 },
        { width: backgroundSize.width, height: 120 }
    );
    background.addElement(headerBlank);

    // Region
    const region = new Text(
        lang.regions[data.region],
        { x: 'center', y: 20 },
        { width: backgroundSize.width, height: 30 },
        30,
        Color.WHITE,
        'middle'
    );
    headerBlank.addElement(region);

    // Player name
    const playerName = new Text(
        `${data.gameName}#${data.tagLine}`,
        { x: 'center', y: 55 },
        { width: backgroundSize.width, height: 40 },
        40,
        Color.WHITE,
        'middle'
    );
    headerBlank.addElement(playerName);

    // Queue type
    const queueName =
        lang.rank.queues[data.queue as keyof typeof lang.rank.queues] || data.queue;
    const queueTitle = new Text(
        `${lang.graph.title} - ${queueName}`,
        { x: 'center', y: 90 },
        { width: backgroundSize.width, height: 30 },
        25,
        Color.GRAY,
        'middle'
    );
    headerBlank.addElement(queueTitle);

    // Generate graph SVG
    const graphSvg = generateGraphSvg(dataPoints, GRAPH_WIDTH, GRAPH_HEIGHT, data.locale);

    // Convert SVG to image buffer
    const graphBuffer = await sharp(Buffer.from(graphSvg)).png().toBuffer();

    // Add graph as image
    const graphImage = new Image(graphBuffer, {
        x: 'center',
        y: 140
    });
    background.addElement(graphImage);

    // Stats section at the bottom
    if (dataPoints.length > 0) {
        const firstPoint = dataPoints[0];
        const lastPoint = dataPoints[dataPoints.length - 1];
        const lpChange = lastPoint.totalLp - firstPoint.totalLp;

        const statsY = 560;

        // Current rank
        const currentRankText = new Rank({
            tier: lastPoint.tier,
            rank: lastPoint.rank,
            leaguePoints: lastPoint.lp
        }).toString(lang);

        const currentRank = new Text(
            `${lang.graph.currentRank}: ${currentRankText} (${lastPoint.lp} LP)`,
            { x: 'center', y: statsY },
            { width: backgroundSize.width, height: 30 },
            24,
            getTierColor(lastPoint.tier),
            'middle'
        );
        background.addElement(currentRank);

        // LP change
        const changeColor = lpChange >= 0 ? Color.GREEN : Color.RED;
        const changeSign = lpChange >= 0 ? '+' : '';
        const lpChangeText = new Text(
            `${lang.graph.change}: ${changeSign}${lpChange} LP`,
            { x: 'center', y: statsY + 35 },
            { width: backgroundSize.width, height: 25 },
            20,
            changeColor,
            'middle'
        );
        background.addElement(lpChangeText);

        // Data points count
        const dataPointsText = new Text(
            `${lang.graph.dataPoints}: ${dataPoints.length}`,
            { x: 'center', y: statsY + 65 },
            { width: backgroundSize.width, height: 25 },
            18,
            Color.GRAY,
            'middle'
        );
        background.addElement(dataPointsText);
    } else {
        // No data message
        const noDataText = new Text(
            lang.graph.noData,
            { x: 'center', y: 350 },
            { width: backgroundSize.width, height: 40 },
            30,
            Color.GRAY,
            'middle'
        );
        background.addElement(noDataText);
    }

    return save(background);
};
