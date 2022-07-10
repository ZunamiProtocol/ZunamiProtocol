const config = require('../../../config.json');


async function main() {
    const forwarderNetworkId = 1;
    const gatewayAddress = "0x4F1ed6687c6C70B9Fb717c496D1d869d78e9B094";
    const forwarderAddress = "0xF5BD12b1E7cd789756d3f922c149C7821B991Ce3";

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
