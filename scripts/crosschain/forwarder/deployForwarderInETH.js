const config = require('../../../config.json');


async function main() {
    const networkId = 1;
    const zunami = "0x2ffCC661011beC72e1A9524E12060983E74D14ce";
    const curvePool = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
    const tokens = config.tokens;

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
    // const forwarder = await ZunamiForwarder.attach("0x7b608af1Ab97204B348277090619Aa43b6033dE0");
    await forwarder.deployed();
    console.log('ZunamiForwarder deployed to:', forwarder.address, forwarderParams);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
