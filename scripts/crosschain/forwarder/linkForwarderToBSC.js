const hre = require("hardhat");

const config = require('../../../config.json');

async function main() {
    const gatewayNetworkId = 56;
    const gatewayAddress = "0xFEdcBA60B3842e3F9Ed8BC56De171da5426AF8CF";
    const forwarderNetworkId = 1;
    const forwarderAddress = "0xd06712108dAcEe3BfEa6BaCe8f6ee8C06491b843";

    const ZunamiForwarder = await ethers.getContractFactory('ZunamiForwarder');
    const forwarder = await ZunamiForwarder.attach(forwarderAddress);
    await forwarder.deployed();
    console.log('ZunamiForwarder: ', forwarder.address);

    const setParams = [
        config["crosschain"][gatewayNetworkId.toString()]["lzChainId"],
        gatewaAddress,
        config["crosschain"][gatewayNetworkId.toString()]["usdtPoolId"],
        config["crosschain"][gatewayNetworkId.toString()]["sgBridge"],
    ];

    await forwarder.setGatewayParams(...setParams);
    console.log("Set gateway params: ", setParams);

    const gatewayTrustedAddress = hre.ethers.utils.solidityPack(['address','address'],[gatewayAddress, forwarderAddress]);
    await forwarder.setTrustedRemote(gatewayNetworkId.toString(), gatewayTrustedAddress);
    console.log("Set gateway trusted Remote: ", gatewayNetworkId.toString(), gatewayTrustedAddress);

    const forwarderTrustedAddress = hre.ethers.utils.solidityPack(['address','address'],[forwarderAddress, gatewayAddress]);
    await forwarder.setTrustedRemote(forwarderNetworkId.toString(), gatewayTrustedAddress);
    console.log("Set gateway trusted Remote: ", forwarderNetworkId.toString(), forwarderTrustedAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
