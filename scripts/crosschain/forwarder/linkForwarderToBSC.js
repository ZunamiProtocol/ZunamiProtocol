const config = require('../../../config.json');


async function main() {
    const gatewayNetworkId = 56;
    const gatewayAddress = "0x4F1ed6687c6C70B9Fb717c496D1d869d78e9B094";
    const forwarderAddress = "0xF5BD12b1E7cd789756d3f922c149C7821B991Ce3";

    const ZunamiForwarder = await ethers.getContractFactory('ZunamiForwarder');
    const forwarder = await ZunamiForwarder.attach(forwarderAddress);
    await forwarder.deployed();
    console.log('ZunamiForwarder: ', forwarder.address);

    const setParams = [
        config["crosschain"][gatewayNetworkId.toString()]["lzChainId"],
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
