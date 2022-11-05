const config = require('../../../config.json');


async function main() {
    const networkId = 137;
    const zunami = "0x9B43E47BEc96A9345cd26fDDE7EFa5F8C06e126c";
    const curvePool = "0x445FE580eF8d70FF569aB36e80c647af338db351";
    const tokens = config.tokens_polygon;

    console.log('Start deploy ZunamiForwarder');
    const ZunamiForwarder = await ethers.getContractFactory('ZunamiForwarder');
    const forwarderParams = [tokens,
        config["crosschain"][networkId.toString()]["usdtPoolId"],
        zunami,
        curvePool,
        config["crosschain"][networkId.toString()]["sgRouter"],
        config["crosschain"][networkId.toString()]["lzRouter"]
    ];

    const forwarder = await ZunamiForwarder.deploy(...forwarderParams);
    await forwarder.deployed();
    console.log('ZunamiForwarder deployed to:', forwarder.address, forwarderParams);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
