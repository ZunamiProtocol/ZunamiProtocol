const hre = require('hardhat');

const config = require('../../../config.json');

async function main() {
    const gatewayNetworkId = 56;
    const gatewayAddress = '0xeAC5e2b6F1d7eBF4a715a235e097b59ACa40b786';
    const forwarderNetworkId = 1;
    const forwarderAddress = '0x7bD5ade0975ec1d46D6472bA9dCC2321c4C41311';

    const ZunamiGateway = await ethers.getContractFactory('ZunamiGateway');
    const gateway = await ZunamiGateway.attach(gatewayAddress);
    await gateway.deployed();
    console.log('ZunamiGateway: ', gateway.address);

    const setParams = [
        config['crosschain'][forwarderNetworkId.toString()]['lzChainId'],
        forwarderAddress,
        config['crosschain'][forwarderNetworkId.toString()]['usdtPoolId'],
    ];

    await gateway.setForwarderParams(...setParams);
    console.log('Set forwarder params: ', setParams);

    const gatewayLzChanId = config['crosschain'][gatewayNetworkId.toString()]['lzChainId'];
    const gatewayTrustedAddress = hre.ethers.utils.solidityPack(
        ['address', 'address'],
        [gatewayAddress, forwarderAddress]
    );
    await gateway.setTrustedRemote(gatewayLzChanId.toString(), gatewayTrustedAddress);
    console.log('Set gateway trusted Remote: ', gatewayLzChanId.toString(), gatewayTrustedAddress);

    const forwarderLzChanId = config['crosschain'][forwarderNetworkId.toString()]['lzChainId'];
    const forwarderTrustedAddress = hre.ethers.utils.solidityPack(
        ['address', 'address'],
        [forwarderAddress, gatewayAddress]
    );
    await gateway.setTrustedRemote(forwarderLzChanId.toString(), forwarderTrustedAddress);
    console.log(
        'Set gateway trusted Remote: ',
        forwarderLzChanId.toString(),
        forwarderTrustedAddress
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
