const fs = require("fs").promises;
const { ethers } = require('hardhat');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function readClaimers(path) {
  const rawData = await fs.readFile(path);
  const data = JSON.parse(rawData);
  return [Object.keys(data), Object.values(data)];
}

const baseFixed = ethers.FixedNumber.from((Math.pow(10,18)).toString());
function toDecimalStringified(amount) {
  return ethers.FixedNumber.fromString(amount.toString()).divUnsafe(baseFixed).toString();
}

async function getClaims(claimers, claimStrat) {
  const claimsAsync = claimers.map((holder) => claimStrat.claims(holder));

  const claims = [];
  const chunkSize = 50;
  for (let i = 0; i < claimsAsync.length; i += chunkSize) {
    const chunk = claimsAsync.slice(i, i + chunkSize);
    const claimsChunk = await Promise.all(chunk);
    for (let j = 0; j < claimsChunk.length; j++) {
      const claim = claimsChunk[j];
        claims.push({
          claimer: claimers[i+j],
          balance: Number(toDecimalStringified(claim.balance)),
          batch: Number(claim.batch),
          withdrew: claim.withdrew
        });
    }
  }
  return claims;
}
async function main() {
  const claimingStrategyDataPath = './scripts/results/zunami_uzd_balances.json';
  const claimingStratAddr = '0xa655Aa809D1FE7a55e22425780bb676E8AE0A143';
  const ClaimingStrat = await ethers.getContractFactory('ClaimingStrat');
  const claimingStrat = await ClaimingStrat.attach(claimingStratAddr);
  await claimingStrat.deployed();

  const [claimers, amounts] = await readClaimers(claimingStrategyDataPath);
  console.log("Claimers count: ", claimers.length, amounts.length);
  console.log("Claiming total: ", amounts.reduce((accumulator, currentValue) => accumulator + Number(toDecimalStringified(currentValue)),0));
  const claims = await getClaims(claimers, claimingStrat);

  const batchStat = {};
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const batch = batchStat[claim.batch] || {};
    batchStat["total"] = (batchStat["total"] || 0) + claim.balance;
    if(claim.withdrew) {
      batch.withdrew = (batch.withdrew || 0) + claim.balance;
      batchStat["withdrew_total"] = (batchStat["withdrew_total"] || 0) + claim.balance;
    } else {
      if(claim.batch === 0) {
        batch.not_requested = (batch.not_requested || 0) + claim.balance;
        batchStat["not_requested_total"] = (batchStat["not_requested_total"] || 0) + claim.balance;
      } else {
        batch.requested = (batch.requested || 0) + claim.balance;
        batchStat["requested_total"] = (batchStat["requested_total"] || 0) + claim.balance;
      }
    }
    batchStat[claim.batch] = batch;
  }
  console.log(batchStat);

  console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
