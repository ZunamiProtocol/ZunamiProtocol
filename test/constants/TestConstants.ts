const { time } = require('@openzeppelin/test-helpers');

export const TestConstants = {
    MIN_LOCK_TIME: time.duration.seconds(86405),
    BLOCKS: 1000,
    SKIP_TIMES: 10,
    daiAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdtAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};
