const config = require('../../../config.json');


async function main() {
    const forwarderNetworkId = 1;
    const gatewayAddress = "0x65363f1A6cb67fE045bbD2fb3c5cb81bFBEe7902";
    const forwarderAddress = "0x92a08D7079bD6751DFC8e41738C93E2B559860BF";

    const ZunamiGateway = await ethers.getContractFactory('ZunamiGateway');
    const gateway = await ZunamiGateway.attach(gatewayAddress);
    await gateway.deployed();
    console.log('ZunamiGateway: ', gateway.address);

    const setParams = [
        config["crosschain"][forwarderNetworkId.toString()]["zlChainId"],
        forwarderAddress,
        config["crosschain"][forwarderNetworkId.toString()]["usdtPoolId"],
        config["crosschain"][gatewayNetworkId.toString()]["sgBridge"],
    ];

    await gateway.setForwarderParams(...setParams);
    console.log("Set forwarder params: ", setParams);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
