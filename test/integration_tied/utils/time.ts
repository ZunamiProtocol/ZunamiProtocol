import { BigNumber as BN } from 'ethers';
import { waffle } from 'hardhat';

const provider = waffle.provider;

export async function advanceBlock() {
    await provider.send('evm_mine', []);
}

export async function advanceBlockTo(blockNum: number) {
    const blockNumber = BN.from(blockNum);
    for (let i = await provider.getBlockNumber(); i < blockNumber.toNumber(); i++) {
        await advanceBlock();
    }
}

export async function increase(value: BN) {
    await provider.send('evm_increaseTime', [value.toNumber()]);
    await advanceBlock();
}

export async function latest() {
    const block = await provider.getBlock('latest');
    return BN.from(block.timestamp);
}

export async function advanceTimeAndBlock(time: BN) {
    await advanceTime(time);
    await advanceBlock();
}

export async function advanceTime(time: BN) {
    await provider.send('evm_increaseTime', [time]);
}

export const duration = {
    seconds: function (val: number) {
        return BN.from(val);
    },
    minutes: function (val: number) {
        return BN.from(val).mul(this.seconds(60));
    },
    hours: function (val: number) {
        return BN.from(val).mul(this.minutes(60));
    },
    days: function (val: number) {
        return BN.from(val).mul(this.hours(24));
    },
    weeks: function (val: number) {
        return BN.from(val).mul(this.days(7));
    },
    years: function (val: number) {
        return BN.from(val).mul(this.days(365));
    },
};
