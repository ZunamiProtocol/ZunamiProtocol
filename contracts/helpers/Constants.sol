//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Constants {
    bytes32 internal constant USDC_TICKER = "usdc";
    bytes32 internal constant USDT_TICKER = "usdt";
    bytes32 internal constant DAI_TICKER = "dai";
    bytes32 internal constant CRV_TICKER = "a3CRV";

    uint256 internal constant CVX_AAVE_PID = 24;
    uint256 internal constant TRADE_DEADLINE = 2000;

    address internal constant USDC_ADDRESS =
        0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant USDT_ADDRESS =
        0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address internal constant DAI_ADDRESS =
        0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address internal constant WETH_ADDRESS =
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant CRV_AAVE_ADDRESS =
        0xDeBF20617708857ebe4F679508E7b7863a8A8EeE;
    address internal constant CRV_AAVE_GAUGE_ADDRESS =
        0xd662908ADA2Ea1916B3318327A97eB18aD588b5d;
    address internal constant CRV_AAVE_LP_ADDRESS =
        0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900;
    address internal constant CRV_ADDRESS =
        0xD533a949740bb3306d119CC777fa900bA034cd52;
    address internal constant SUSHI_CRV_WETH_ADDRESS =
        0x58Dc5a51fE44589BEb22E8CE67720B5BC5378009;
    address internal constant SUSHI_WETH_CVX_ADDRESS =
        0x05767d9EF41dC40689678fFca0608878fb3dE906;
    address internal constant SUSHI_WETH_USDT_ADDRESS =
        0x06da0fd433C1A5d7a4faa01111c044910A184553;
    address internal constant SUSHI_ROUTER_ADDRESS =
        0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    address internal constant CVX_BOOSTER_ADDRESS =
        0xF403C135812408BFbE8713b5A23a04b3D48AAE31;
    address internal constant CVX_REWARDS_ADDRESS =
        0xE82c1eB4BC6F92f85BF7EB6421ab3b882C3F5a7B;
    address internal constant CVX_ADDRESS =
        0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;
}
