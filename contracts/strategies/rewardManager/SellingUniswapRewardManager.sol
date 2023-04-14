//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../utils/Constants.sol';
import '../../interfaces/IUniswapRouter.sol';
import '../../interfaces/IRewardManager.sol';
import './AggregatorV2V3Interface.sol';

contract SellingUniswapRewardManager is IRewardManager {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant SLIPPAGE_DENOMINATOR = 10_000;

    uint256 public constant defaultSlippage = 300; // 3%

    IUniswapRouter public immutable router;
    address public immutable middleSwapToken;

    mapping(address => address) public rewardUsdChainlinkOracles;

    constructor(address routerAddr, address middleSwapTokenAddr) {
        require(routerAddr != address(0), 'Zero router');
        require(middleSwapTokenAddr != address(0), 'Zero middle swap token');
        router = IUniswapRouter(routerAddr);
        middleSwapToken = middleSwapTokenAddr;

        rewardUsdChainlinkOracles[
            Constants.CVX_ADDRESS
        ] = 0xd962fC30A72A84cE50161031391756Bf2876Af5D; // https://data.chain.link/ethereum/mainnet/crypto-usd/cvx-usd
        rewardUsdChainlinkOracles[
            Constants.CRV_ADDRESS
        ] = 0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f; // https://data.chain.link/ethereum/mainnet/crypto-usd/crv-usd
        rewardUsdChainlinkOracles[
            Constants.FXS_ADDRESS
        ] = 0x6Ebc52C8C1089be9eB3945C4350B68B8E4C2233f; // https://data.chain.link/ethereum/mainnet/crypto-usd/fxs-usd
        rewardUsdChainlinkOracles[
            Constants.SPELL_ADDRESS
        ] = 0x8c110B94C5f1d347fAcF5E1E938AB2db60E3c9a8; // https://data.chain.link/ethereum/mainnet/crypto-usd/spell-usd
    }

    function handle(
        address reward,
        uint256 amount,
        address feeToken
    ) public {
        if (amount == 0) return;

        IERC20Metadata(reward).safeIncreaseAllowance(address(router), amount);

        uint256[] memory amounts = router.swapExactTokensForTokens(
            amount,
            0,
            fromAddressArr3([reward, middleSwapToken, feeToken]),
            msg.sender,
            block.timestamp + Constants.TRADE_DEADLINE
        );

        checkSlippage(reward, amount, amounts[amounts.length - 1]);
    }

    function valuate(
        address reward,
        uint256 amount,
        address feeToken
    ) public view returns (uint256) {
        if (amount == 0) return 0;

        return priceTokenByExchange(amount, fromAddressArr3([reward, middleSwapToken, feeToken]));
    }

    function priceTokenByExchange(uint256 amount, address[] memory exchangePath)
        internal
        view
        returns (uint256)
    {
        if (amount == 0) return 0;
        uint256[] memory amounts = router.getAmountsOut(amount, exchangePath);
        return amounts[amounts.length - 1];
    }

    function checkSlippage(
        address reward,
        uint256 amount,
        uint256 feeTokenAmount
    ) internal view {
        AggregatorV2V3Interface oracle = AggregatorV2V3Interface(rewardUsdChainlinkOracles[reward]);
        (, int256 answer, , , ) = oracle.latestRoundData();

        uint256 feeTokenAmountByOracle = (uint256(answer) * amount) / 1e20; // reward decimals 18 + oracle decimals 2 (8 - 6)
        uint256 feeTokenAmountByOracleWithSlippage = (feeTokenAmountByOracle *
        (SLIPPAGE_DENOMINATOR - defaultSlippage)) / SLIPPAGE_DENOMINATOR;

        require(feeTokenAmount >= feeTokenAmountByOracleWithSlippage, 'Wrong slippage');
    }

    function fromAddressArr3(address[3] memory arr)
        internal
        pure
        returns (address[] memory arrInf)
    {
        arrInf = new address[](3);
        arrInf[0] = arr[0];
        arrInf[1] = arr[1];
        arrInf[2] = arr[2];
    }
}
