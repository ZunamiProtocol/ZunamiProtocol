const hre = require("hardhat");

const config = require('../../../config.json');

async function main() {
    const gatewayNetworkId = 137;
    const gatewayAddress = "";
    const forwarderNetworkId = 1;
    const forwarderAddress = "";

    const ZunamiForwarder = await ethers.getContractFactory('ZunamiForwarder');
    const forwarder = await ZunamiForwarder.attach(forwarderAddress);
    await forwarder.deployed();
    console.log('ZunamiForwarder: ', forwarder.address);

    const setParams = [
        config["crosschain"][gatewayNetworkId.toString()]["lzChainId"],
        gatewayAddress,
        config["crosschain"][gatewayNetworkId.toString()]["usdtPoolId"],
    ];

    await forwarder.setGatewayParams(...setParams);
    console.log("Set gateway params: ", setParams);

    const gatewayLzChanId = config["crosschain"][gatewayNetworkId.toString()]["lzChainId"];
    const gatewayTrustedAddress = hre.ethers.utils.solidityPack(['address','address'],[gatewayAddress, forwarderAddress]);
    await forwarder.setTrustedRemote(gatewayLzChanId.toString(), gatewayTrustedAddress);
    console.log("Set gateway trusted Remote: ", gatewayLzChanId.toString(), gatewayTrustedAddress);

    const forwarderLzChanId = config["crosschain"][forwarderNetworkId.toString()]["lzChainId"];
    const forwarderTrustedAddress = hre.ethers.utils.solidityPack(['address','address'],[forwarderAddress, gatewayAddress]);
    await forwarder.setTrustedRemote(forwarderLzChanId.toString(), forwarderTrustedAddress);
    console.log("Set gateway trusted Remote: ", forwarderLzChanId.toString(), forwarderTrustedAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
