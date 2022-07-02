const config = require('../../config.json');


async function main() {
    const forwarderNetworkId = 137;
    const gatewayAddress = "0x8d6a957D8bbE4F5C938D6d5ABa04B84c67e6cB95";
    const forwarderAddress = "0x1db0Fc8933f545648b54A9eE4326209a9A259643";

    const ZunamiGateway = await ethers.getContractFactory('ZunamiGateway');
    const gateway = await ZunamiGateway.attach(gatewayAddress);
    await gateway.deployed();
    console.log('ZunamiGateway: ', gateway.address);

    const setParams = [
        config["crosschain"][forwarderNetworkId.toString()]["chainId"],
        forwarderAddress,
        config["crosschain"][forwarderNetworkId.toString()]["usdtPoolId"]
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
