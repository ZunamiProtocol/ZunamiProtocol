const config = require('../../../config.json');


async function main() {
    const forwarderNetworkId = 1;
    const gatewayAddress = "0xFEdcBA60B3842e3F9Ed8BC56De171da5426AF8CF";
    const forwarderAddress = "0xd06712108dAcEe3BfEa6BaCe8f6ee8C06491b843";

    const ZunamiGateway = await ethers.getContractFactory('ZunamiGateway');
    const gateway = await ZunamiGateway.attach(gatewayAddress);
    await gateway.deployed();
    console.log('ZunamiGateway: ', gateway.address);

    const setParams = [
        config["crosschain"][forwarderNetworkId.toString()]["lzChainId"],
        forwarderAddress,
        config["crosschain"][forwarderNetworkId.toString()]["usdtPoolId"],
        config["crosschain"][forwarderNetworkId.toString()]["sgBridge"],
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
