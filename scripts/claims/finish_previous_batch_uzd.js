const { ethers } = require('hardhat');

async function main() {
    const claimingStratAddr = '0xa655Aa809D1FE7a55e22425780bb676E8AE0A143';
    const ClaimingStrat = await ethers.getContractFactory('ClaimingStrat');
    const claimingStrat = await ClaimingStrat.attach(claimingStratAddr);
    await claimingStrat.deployed();

    const totalAmount = 534846063501000000000000; // 18 decimals !!
    const daiAmount = 0; // 18 decimasl !!!
    const usdcAmount = 534846063501; // 6 decimals !!!
    const usdtAmount = 0; // 6 decimals !!!

    if(totalAmount !== (daiAmount + usdcAmount * 10 ** 12 + usdtAmount * 10 ** 12)) {
        throw("Total amount is not the same as stables");
    }

    if(totalAmount > Number((await claimingStrat.batchesTotalBalance(2)))) {
        throw("Total amount is not the same with contracts");
    }

    const currentBatch = await claimingStrat.currentBatch();
    const previousBatch = currentBatch.sub(1);
    console.log("Current batch: ", currentBatch.toString());
    console.log("Previous batch: ", previousBatch.toString());
    console.log("Finishing previous batch... ");
    console.log("Amounts: ", [daiAmount,usdcAmount,usdtAmount]);
    // const tx = await claimingStrat.finishPreviousBatch([daiAmount,usdcAmount,usdtAmount]);
    // await tx.wait();
    console.log("Previous batch finished!");
    console.log("Previous batch finished: ", (await claimingStrat.batchesFinished(previousBatch)).toString());
    console.log("Previous batch amounts DAI: ", (await claimingStrat.batchesAmounts(previousBatch, 0)).toString());
    console.log("Previous batch amounts USDC: ", (await claimingStrat.batchesAmounts(previousBatch, 1)).toString());
    console.log("Previous batch amounts USDT: ", (await claimingStrat.batchesAmounts(previousBatch, 2)).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
