import { waffle } from 'hardhat';

const { time } = require('@openzeppelin/test-helpers');

export const provider = waffle.provider;
export const MIN_LOCK_TIME = time.duration.seconds(86405);
export const BLOCKS = 1000;
export const SKIP_TIMES = 10;
export const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
export const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
export const daiAccount: string = '0x6F6C07d80D0D433ca389D336e6D1feBEA2489264';
export const usdcAccount: string = '0x6BB273bF25220D13C9b46c6eD3a5408A3bA9Bcc6';
export const usdtAccount: string = '0x67aB29354a70732CDC97f372Be81d657ce8822cd';
export const testCheckSumm = 2950; // 3000 base

export const DEBUG_MODE = false;
