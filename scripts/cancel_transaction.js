const { web3, ethers } = require('hardhat');

async function main() {
    const gasPrice = web3.utils.toWei(web3.utils.toBN('20'), 'gwei');

    const nonce = 0;
    const [sender] = await ethers.getSigners();

    const transactionObject = {
        from: sender.address,
        to: sender.address,
        value: 0,
        gasPrice: gasPrice,
        nonce: nonce,
    };

    console.log(JSON.stringify(transactionObject));

    await web3.eth.sendTransaction(transactionObject);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
