const config = require('../../../config.json');


async function main() {
    const forwarderNetworkId = 1;
    const gatewayAddress = "0x02a228D826Cbb1C0E8765A6DB6E7AB64EAA80BFD";
    const forwarderAddress = "0x82BE83e303eD594dF25166BF485a57C4cFaAF775";

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
