const config = require('../../../config.json');


async function main() {
    const usdtPoolId = 2;

    const networkId = 137;
    const tokens = config.tokens_polygon;

    console.log('Start deploy ZunamiGateway');
    const ZunamiGateway = await ethers.getContractFactory('ZunamiGateway');
    const gatewayParams = [
        tokens[usdtPoolId],
        config["crosschain"][networkId.toString()]["usdtPoolId"],
        config["crosschain"][networkId.toString()]["sgRouter"],
        config["crosschain"][networkId.toString()]["lzRouter"],
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
