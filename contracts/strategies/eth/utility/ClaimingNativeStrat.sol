//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../../utils/Constants.sol';
import '../../../interfaces/IZunami.sol';
import '../../../interfaces/IStrategy.sol';

//import "hardhat/console.sol";

contract ClaimingNativeStrat is Ownable {
    using SafeERC20 for IERC20Metadata;

    enum WithdrawalType {
        Base,
        OneCoin
    }

    uint8 public constant POOL_ASSETS = 5;
    uint8 public constant STRATEGY_ASSETS = 3;

    address public constant ETH_MOCK_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IZunami public zunami;
    IERC20Metadata[STRATEGY_ASSETS] public tokens;

    uint256 public managementFees = 0;

    struct Claim {
        address claimer;
        uint256 balance;
        uint256 batch;
        bool withdrew;
    }

    uint256 public totalBalance;
    uint256 public currentBatch = 1;

    mapping(address => Claim) public claims;

    mapping(uint256 => uint256) public batchesTotalBalance;
    mapping(uint256 => bool) public batchesFinished;
    mapping(uint256 => uint256[STRATEGY_ASSETS]) public batchesAmounts;

    event NewBatchStarted(uint256 previousBatch, uint256 newBatch);
    event BatchFinished(uint256 batchFinished, uint256[STRATEGY_ASSETS] totalBatchAmounts);

    event ClaimCreated(address indexed claimer, uint256 balance);
    event ClaimRequested(address indexed claimer, uint256 inBatch);
    event ClaimWithdrew(address indexed claimer, uint256[STRATEGY_ASSETS] tokenAmounts);

    modifier onlyZunami() {
        require(_msgSender() == address(zunami), 'must be called by Zunami contract');
        _;
    }

    constructor(IERC20Metadata[STRATEGY_ASSETS] memory _tokens) {
        tokens = _tokens;
    }

    receive() external payable {
        // receive ETH after unwrap
    }

    function startNewBatch() external onlyOwner {
        require(
            currentBatch == 1 || (currentBatch > 1 && batchesFinished[currentBatch - 1]),
            "Not finished previous batch"
        );
        currentBatch += 1;
        emit NewBatchStarted(currentBatch - 1, currentBatch);
    }

    function finishPreviousBatch(uint256[STRATEGY_ASSETS] memory _batchAmounts) external onlyOwner {
        require(_batchAmounts[0] > 0 || _batchAmounts[1] > 0 || _batchAmounts[2] > 0, "Wrong amounts");
        uint256 previousBatch = currentBatch - 1;
        require(currentBatch > 1 && !batchesFinished[previousBatch], "Not started second or already finished");
        batchesFinished[previousBatch] = true;
        batchesAmounts[previousBatch] = _batchAmounts;
        emit BatchFinished(previousBatch, _batchAmounts);
    }

    function createClaims(address[] memory _claimers, uint256[] memory _balances) external onlyOwner {
        require(_claimers.length == _balances.length, "Wrong length");
        for(uint256 i = 0; i < _claimers.length; i++) {
            address claimer = _claimers[i];
            uint256 balance = _balances[i];
            require(claims[claimer].balance == 0, "Doubled claim");
            require(balance > 0, "Zero balance");
            require(claimer != address(0), "Zero claimer");
            totalBalance += balance;
            claims[claimer] = Claim(claimer, balance, 0, false);
            emit ClaimCreated(claimer, balance);
        }
    }

    function requestClaim() external {
        address claimer = msg.sender;
        Claim storage claim = claims[claimer];
        require(claim.balance != 0, "Wrong claimer");
        require(claim.batch == 0, "Requested claim");
        claim.batch = currentBatch;
        batchesTotalBalance[currentBatch] += claim.balance;
        emit ClaimRequested(claimer, currentBatch);
    }

    function canWithdrawClaim() external view returns(bool) {
        address claimer = msg.sender;
        Claim memory claim = claims[claimer];
        return (claim.balance != 0)
            && (claim.batch != 0)
            && (!claim.withdrew)
            && (batchesFinished[claim.batch]);
    }

    function withdrawClaim() external {
        address claimer = msg.sender;
        Claim storage claim = claims[claimer];
        require(claim.balance != 0, "Wrong claimer");
        require(claim.batch != 0, "Not requested claim");
        require(!claim.withdrew, "Claim was withdrew");
        require(batchesFinished[claim.batch], "Not finished batch");
        claim.withdrew = true;
        uint256[STRATEGY_ASSETS] memory tokenAmounts = transferPortionTokensToBatch(
            claimer,
            claim.batch,
            Math.mulDiv(claim.balance, 1e18, batchesTotalBalance[claim.batch], Math.Rounding.Down)
        );

        emit ClaimWithdrew(claimer, tokenAmounts);
    }

    function transferPortionTokensToBatch(address claimer, uint256 batch, uint256 batchProportion) internal returns(uint256[3] memory transfersAmountOut){
        uint256[STRATEGY_ASSETS] memory batchAmounts = batchesAmounts[batch];
        for (uint256 i = 0; i < 3; i++) {
            uint256 batchAmount = batchAmounts[i];
            if(batchAmount == 0) continue;
            transfersAmountOut[i] = Math.mulDiv(batchAmount, batchProportion, 1e18, Math.Rounding.Down);
            if (transfersAmountOut[i] > 0) {
                safeTransferNative(tokens[i], claimer, transfersAmountOut[i]);
            }
        }
    }



    // Zunami strategy interface
    function withdrawAll() external onlyZunami {
        transferAllTokensTo(address(zunami));
    }

    function transferAllTokensTo(address withdrawer) internal {
        uint256 tokenStratBalance;
        IERC20Metadata token_;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            token_ = tokens[i];
            tokenStratBalance = balanceOfNative(token_);
            if (tokenStratBalance > 0) {
                safeTransferNative(token_, withdrawer, tokenStratBalance);
            }
        }
    }

    function deposit(uint256[POOL_ASSETS] memory amounts) external payable returns (uint256) {
        uint256 depositedAmount;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            if (amounts[i] > 0) {
                depositedAmount += amounts[i];
            }
        }

        return depositedAmount;
    }

    function withdraw(
        address withdrawer,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[POOL_ASSETS] memory,
        WithdrawalType,
        uint128
    ) external virtual onlyZunami returns (bool) {
        revert();
    }

    function autoCompound() public onlyZunami returns (uint256) {
        return 0;
    }

    function totalHoldings() public view virtual returns (uint256) {
        uint256 tokensHoldings = 0;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            tokensHoldings += balanceOfNative(tokens[i]);
        }
        return tokensHoldings;
    }

    function renounceOwnership() public view override onlyOwner {
        revert('The strategy must have an owner');
    }

    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = IZunami(zunamiAddr);
    }

    function withdrawStuckToken(IERC20Metadata _token) external onlyOwner {
        uint256 tokenBalance = balanceOfNative(_token);
        if (tokenBalance > 0) {
            safeTransferNative(_token, _msgSender(), tokenBalance);
        }
    }

    function claimManagementFees() external returns (uint256) {
        return 0;
    }

    function balanceOfNative(IERC20Metadata token_) internal view returns (uint256) {
        if (address(token_) == ETH_MOCK_ADDRESS) {
            return address(this).balance;
        } else {
            return token_.balanceOf(address(this));
        }
    }

    function safeTransferNative(
        IERC20Metadata token,
        address receiver,
        uint256 amount
    ) internal {
        if (address(token) == ETH_MOCK_ADDRESS) {
            receiver.call{ value: amount }(''); // don't fail if user contract doesn't accept ETH
        } else {
            token.safeTransfer(receiver, amount);
        }
    }
}
