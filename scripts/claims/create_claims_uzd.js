const fs = require("fs").promises;
const { ethers } = require('hardhat');


async function readClaimers(path) {
    const rawData = await fs.readFile(path);
    const data = JSON.parse(rawData);
    return [Object.keys(data), Object.values(data)];
}

async function main() {
    const claimingStrategyDataPath = './scripts/results/zunami_uzd_balances.json';
    const claimingStratAddr = '0xa655Aa809D1FE7a55e22425780bb676E8AE0A143';
    const ClaimingStrat = await ethers.getContractFactory('ClaimingStrat');
    const claimingStrat = await ClaimingStrat.attach(claimingStratAddr);
    await claimingStrat.deployed();

    const [claimers, amounts] = await readClaimers(claimingStrategyDataPath);
    console.log("Creating claims... ", claimers.length, amounts.length);
    // console.log("claimers:", claimers);
    // console.log("amounts:", amounts);
    await claimingStrat.createClaims(claimers, amounts);
    console.log("Claims created!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
