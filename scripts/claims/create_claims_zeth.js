const fs = require("fs").promises;
const { ethers } = require('hardhat');


async function readClaimers(path) {
    const rawData = await fs.readFile(path);
    const data = JSON.parse(rawData);
    return [Object.keys(data), Object.values(data)];
}

async function main() {
    const claimingStrategyDataPath = './scripts/results/zunami_zeth_balances.json';
    const claimingStratAddr = '0x6756EfFa8aABeB9031279e4C71d8c1BD3Ae8f9Ef';
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
