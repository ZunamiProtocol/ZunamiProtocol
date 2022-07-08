const config = require('../../../config.json');


async function main() {
    const gatewayNetworkId = 56;
    const gatewayAddress = "0x65363f1A6cb67fE045bbD2fb3c5cb81bFBEe7902";
    const forwarderAddress = "0x92a08D7079bD6751DFC8e41738C93E2B559860BF";

    const ZunamiForwarder = await ethers.getContractFactory('ZunamiForwarder');
    const forwarder = await ZunamiForwarder.attach(forwarderAddress);
    await forwarder.deployed();
    console.log('ZunamiForwarder: ', forwarder.address);

    const setParams = [
        config["crosschain"][gatewayNetworkId.toString()]["zlChainId"],
        gatewayAddress,
        config["crosschain"][gatewayNetworkId.toString()]["usdtPoolId"],
        config["crosschain"][gatewayNetworkId.toString()]["sgBridge"],
    ];

    await forwarder.setGatewayParams(...setParams);
    console.log("Set gateway params: ", setParams);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
