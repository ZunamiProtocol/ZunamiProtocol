const { ethers } = require('hardhat');

async function main() {
    const claimingStratAddr = '0x6756EfFa8aABeB9031279e4C71d8c1BD3Ae8f9Ef';
    const ClaimingStrat = await ethers.getContractFactory('ClaimingStrat');
    const claimingStrat = await ClaimingStrat.attach(claimingStratAddr);
    await claimingStrat.deployed();

    const totalAmount = 33149023268605233000; // 18 decimals !!
    const ethAmount = "0"; // 18 decimals !!!
    const wethAmount = "0"; // 18 decimals !!!
    const frxEthAmount = "33149023268605233000"; // 18 decimals !!!
    const amounts = [ethAmount,wethAmount,frxEthAmount];

    if(totalAmount !== (Number(ethAmount) + Number(wethAmount) + Number(frxEthAmount))) {
        throw("Total amount is not the same as stables");
    }

    if(totalAmount > Number((await claimingStrat.batchesTotalBalance(1)))) {
        throw("Total amount is not the same with contracts");
    }

    const currentBatch = await claimingStrat.currentBatch();
    const previousBatch = currentBatch.sub(1);
    console.log("Current batch: ", currentBatch.toString());
    console.log("Previous batch: ", previousBatch.toString());
    console.log("Finishing previous batch... ");
    console.log("Amounts: ", amounts);
    // const tx = await claimingStrat.finishPreviousBatch(amounts);
    // await tx.wait();
    console.log("Previous batch finished!");
    console.log("Previous batch finished: ", (await claimingStrat.batchesFinished(previousBatch)).toString());
    console.log("Previous batch amounts ETH: ", (await claimingStrat.batchesAmounts(previousBatch, 0)).toString());
    console.log("Previous batch amounts wETH: ", (await claimingStrat.batchesAmounts(previousBatch, 1)).toString());
    console.log("Previous batch amounts frxETH: ", (await claimingStrat.batchesAmounts(previousBatch, 2)).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
