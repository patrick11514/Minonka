export type Position = {
    x: number | 'center';
    y: number | 'center';
};

export type Size = {
    width: number;
    height: number;
};

export const Color = {
    //RANK
    IRON: '#99978b',
    BRONZE: '#966502',
    SILVER: '#99978b',
    GOLD: '#e6c41c',
    PLATINUM: '#49ebaa',
    EMERALD: '#1b9627',
    DIAMOND: '#5149eb',
    MASTER: '#8117b3',
    GRANDMASTER: '#9e0606',
    CHALLENGER: '#e5f051',

    //OTHER
    GREEN: '#1fed18',
    RED: '#ff0000',
    YELLOW: '#fff000',
    GRAY: '#8A8578',
    WHITE: '#FFFFFF'
} as const;
