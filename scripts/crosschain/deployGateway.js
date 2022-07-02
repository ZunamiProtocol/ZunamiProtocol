const config = require('../../config.json');


async function main() {
    const usdtPoolId = 2;

    const networkId = 56;
    const tokens = config.tokens_bsc;

    console.log('Start deploy ZunamiGateway');
    const ZunamiGateway = await ethers.getContractFactory('ZunamiGateway');
    const gatewayParams = [
        tokens[usdtPoolId],
        config["crosschain"][networkId.toString()]["usdtPoolId"],
        config["crosschain"][networkId.toString()]["stargate"],
        config["crosschain"][networkId.toString()]["layerzero"],
    ];
    const gateway = await ZunamiGateway.deploy(
      ...gatewayParams
    );
    await gateway.deployed();
    console.log('ZunamiGateway deployed to:', gateway.address, gatewayParams);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
