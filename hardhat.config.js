require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('solidity-coverage');

module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            chainId: 31337,
            forking: {
                url: 'https://eth-mainnet.alchemyapi.io/v2/Dpwj4UKTaHOGzK4UzVNGUxd-EmIM_NaJ',
            },
        },
    },
    namedAccounts: {
        DAI: {
            default: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        },
        USDC: {
            default: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
        USDT: {
            default: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        },
        deployer: {
            default: 0,
        },
        user: {
            default: 0,
        },
        holderUSDC: {
            default: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
        },
        holderDai: {
            default: '0x5A16552f59ea34E44ec81E58b3817833E9fD5436',
        },
        holderUsdt: {
            default: '0x3567Cafb8Bf2A83bBEa4E79f3591142fb4EBe86d',
        },
    },
    mocha: {
        timeout: 300000,
    },
    solidity: '0.8.0',
};
