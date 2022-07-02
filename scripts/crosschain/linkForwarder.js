const config = require('../../config.json');


async function main() {
    const gatewayNetworkId = 56;
    const gatewayAddress = "0x8d6a957D8bbE4F5C938D6d5ABa04B84c67e6cB95";
    const forwarderAddress = "0x1db0Fc8933f545648b54A9eE4326209a9A259643";

    const ZunamiForwarder = await ethers.getContractFactory('ZunamiForwarder');
    const forwarder = await ZunamiForwarder.attach(forwarderAddress);
    await forwarder.deployed();
    console.log('ZunamiForwarder: ', forwarder.address);

    const setParams = [
        config["crosschain"][gatewayNetworkId.toString()]["chainId"],
        gatewayAddress,
        config["crosschain"][gatewayNetworkId.toString()]["usdtPoolId"]
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
