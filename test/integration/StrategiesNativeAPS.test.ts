import { ethers, network, web3 } from 'hardhat';
import { BigNumber, Contract, Signer } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { expect } from 'chai';

import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import { abi as zunamiABI } from '../../artifacts/contracts/Zunami.sol/Zunami.json';
import { abi as uzdABI } from '../../deployment/abi/UZD.json';
import * as addrs from '../address.json';
import * as globalConfig from '../../config.json';

function getMinAmount(): BigNumber {
    return ethers.utils.parseUnits('1', 'ether');
}

const cvxRewardsAbi = [{"inputs":[{"internalType":"uint256","name":"pid_","type":"uint256"},{"internalType":"address","name":"stakingToken_","type":"address"},{"internalType":"address","name":"rewardToken_","type":"address"},{"internalType":"address","name":"operator_","type":"address"},{"internalType":"address","name":"rewardManager_","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"reward","type":"uint256"}],"name":"RewardAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"reward","type":"uint256"}],"name":"RewardPaid","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[{"internalType":"address","name":"_reward","type":"address"}],"name":"addExtraReward","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"clearExtraRewards","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"currentRewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"donate","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"duration","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"earned","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"extraRewards","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"extraRewardsLength","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getReward","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_account","type":"address"},{"internalType":"bool","name":"_claimExtras","type":"bool"}],"name":"getReward","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"historicalRewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastTimeRewardApplicable","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastUpdateTime","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"newRewardRatio","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"operator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"periodFinish","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pid","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewards","type":"uint256"}],"name":"queueNewRewards","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"queuedRewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardManager","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardPerToken","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardPerTokenStored","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardRate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"rewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"stake","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"stakeAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_for","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"stakeFor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"stakingToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userRewardPerTokenPaid","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bool","name":"claim","type":"bool"}],"name":"withdraw","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"claim","type":"bool"}],"name":"withdrawAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"claim","type":"bool"}],"name":"withdrawAllAndUnwrap","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bool","name":"claim","type":"bool"}],"name":"withdrawAndUnwrap","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}];
const crvPool2Abi = [{"stateMutability":"view","type":"function","name":"coins","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"address"}]}];
const zunamiNativeAbi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"pid","type":"uint256"},{"indexed":false,"internalType":"address","name":"strategyAddr","type":"address"},{"indexed":false,"internalType":"uint256","name":"startTime","type":"uint256"}],"name":"AddedPool","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"compoundedValue","type":"uint256"}],"name":"AutoCompoundAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"oldAvailableWithdrawalTypes","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newAvailableWithdrawalTypes","type":"uint256"}],"name":"ChangedAvailableWithdrawalTypes","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"pool","type":"address"},{"indexed":false,"internalType":"bool","name":"newStatus","type":"bool"}],"name":"ChangedPoolEnabledStatus","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"feeValue","type":"uint256"}],"name":"ClaimedAllManagementFee","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositor","type":"address"},{"indexed":false,"internalType":"uint256[5]","name":"amounts","type":"uint256[5]"}],"name":"CreatedPendingDeposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"withdrawer","type":"address"},{"indexed":false,"internalType":"uint256","name":"lpShares","type":"uint256"},{"indexed":false,"internalType":"uint256[5]","name":"tokenAmounts","type":"uint256[5]"}],"name":"CreatedPendingWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositor","type":"address"},{"indexed":false,"internalType":"uint256","name":"depositedValue","type":"uint256"},{"indexed":false,"internalType":"uint256[5]","name":"amounts","type":"uint256[5]"},{"indexed":false,"internalType":"uint256","name":"lpShares","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"pid","type":"uint256"},{"indexed":false,"internalType":"bool","name":"optimized","type":"bool"}],"name":"Deposited","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"withdrawer","type":"address"},{"indexed":false,"internalType":"uint256[5]","name":"amounts","type":"uint256[5]"},{"indexed":false,"internalType":"uint256","name":"lpShares","type":"uint256"},{"indexed":false,"internalType":"enum IStrategy.WithdrawalType","name":"withdrawalType","type":"uint8"},{"indexed":false,"internalType":"uint128","name":"tokenIndex","type":"uint128"}],"name":"FailedWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"oldManagementFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newManagementFee","type":"uint256"}],"name":"ManagementFeeSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositor","type":"address"}],"name":"RemovedPendingDeposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"pid","type":"uint256"}],"name":"SetDefaultDepositPid","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"pid","type":"uint256"}],"name":"SetDefaultWithdrawPid","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"rebalancerAddr","type":"address"}],"name":"SetRebalancer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"tid","type":"uint256"},{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenDecimalMultiplier","type":"uint256"},{"indexed":false,"internalType":"address","name":"tokenOld","type":"address"}],"name":"UpdatedToken","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"withdrawer","type":"address"},{"indexed":false,"internalType":"uint256","name":"lpShares","type":"uint256"},{"indexed":false,"internalType":"enum IStrategy.WithdrawalType","name":"withdrawalType","type":"uint8"},{"indexed":false,"internalType":"uint128","name":"tokenIndex","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"pid","type":"uint256"},{"indexed":false,"internalType":"bool","name":"optimized","type":"bool"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"ALL_WITHDRAWAL_TYPES_MASK","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ETH_MOCK_ADDRESS","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ETH_MOCK_TOKEN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"FEE_DENOMINATOR","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"FUNDS_DENOMINATOR","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"LP_RATIO_MULTIPLIER","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAX_FEE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_LOCK_TIME","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"OPERATOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PAUSER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"POOL_ASSETS","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_strategyAddr","type":"address"}],"name":"addPool","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"_tokens","type":"address[]"},{"internalType":"uint256[]","name":"_tokenDecimalMultipliers","type":"uint256[]"}],"name":"addTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"autoCompoundAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"availableWithdrawalTypes","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"calcManagementFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256[5]","name":"tokenAmounts","type":"uint256[5]"},{"internalType":"bool","name":"isDeposit","type":"bool"}],"name":"calcSharesAmount","outputs":[{"internalType":"uint256","name":"lpShares","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_holdings","type":"uint256"},{"internalType":"uint256","name":"_tokens","type":"uint256"}],"name":"calcTokenPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"lpShares","type":"uint256"},{"internalType":"uint128","name":"tokenIndex","type":"uint128"}],"name":"calcWithdrawOneCoin","outputs":[{"internalType":"uint256","name":"tokenAmount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claimAllManagementFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"userList","type":"address[]"}],"name":"completeDeposits","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"userList","type":"address[]"},{"internalType":"uint256[5]","name":"minAmountsTotal","type":"uint256[5]"}],"name":"completeWithdrawals","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"decimalsMultipliers","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"pid","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"decreasePoolShares","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"defaultDepositPid","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"defaultWithdrawPid","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256[5]","name":"amounts","type":"uint256[5]"}],"name":"delegateDeposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"lpShares","type":"uint256"},{"internalType":"uint256[5]","name":"tokenAmounts","type":"uint256[5]"}],"name":"delegateWithdrawal","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[5]","name":"amounts","type":"uint256[5]"}],"name":"deposit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_pid","type":"uint256"}],"name":"disablePool","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_pid","type":"uint256"}],"name":"enablePool","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"pid","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"increasePoolShares","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"launch","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"launched","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lpPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"managementFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"_strategies","type":"uint256[]"},{"internalType":"uint256[]","name":"withdrawalsPercents","type":"uint256[]"},{"internalType":"uint256","name":"_receiverStrategy","type":"uint256"}],"name":"moveFundsBatch","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"pendingDeposits","outputs":[{"internalType":"uint256[5]","name":"","type":"uint256[5]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"pendingWithdrawals","outputs":[{"components":[{"internalType":"uint256","name":"lpShares","type":"uint256"},{"internalType":"uint256[5]","name":"tokenAmounts","type":"uint256[5]"}],"internalType":"struct ZunamiNative.PendingWithdrawal","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"poolCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"pid","type":"uint256"}],"name":"poolInfo","outputs":[{"components":[{"internalType":"contract IStrategy","name":"strategy","type":"address"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"lpShares","type":"uint256"},{"internalType":"bool","name":"enabled","type":"bool"}],"internalType":"struct ZunamiNative.PoolInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rebalance","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"rebalancer","outputs":[{"internalType":"contract IZunamiRebalancer","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"removePendingDeposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenIndex","type":"uint256"},{"internalType":"address","name":"_token","type":"address"},{"internalType":"uint256","name":"_tokenDecimalMultiplier","type":"uint256"}],"name":"replaceToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint8","name":"newAvailableWithdrawalTypes","type":"uint8"}],"name":"setAvailableWithdrawalTypes","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_newPoolId","type":"uint256"}],"name":"setDefaultDepositPid","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_newPoolId","type":"uint256"}],"name":"setDefaultWithdrawPid","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"newManagementFee","type":"uint256"}],"name":"setManagementFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"rebalancerAddr","type":"address"}],"name":"setRebalancer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tokenCount","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokens","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalDeposited","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalHoldings","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"lpShares","type":"uint256"},{"internalType":"uint256[5]","name":"tokenAmounts","type":"uint256[5]"},{"internalType":"enum IStrategy.WithdrawalType","name":"withdrawalType","type":"uint8"},{"internalType":"uint128","name":"tokenIndex","type":"uint128"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20Metadata","name":"_token","type":"address"}],"name":"withdrawStuckToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];

async function mintZEthAmount(admin: Signer, omnipool: Contract, zStable: Contract) {
    const ethAmount = ethers.utils.parseUnits('1000', 'ether');

    await omnipool.deposit([ethAmount, 0, 0, 0, 0], { value: ethAmount });

    const zlpAmount = await omnipool.balanceOf(admin.getAddress());

    await omnipool.approve(zStable.address, zlpAmount);
    await zStable.deposit(zlpAmount, admin.getAddress());
}

describe('Single strategy tests', () => {
    const strategyNames = [
        'VaultAPSStrat',
        'zEthFrxEthCurveConvex'
    ];

    const configConvexAPS = {
        token: globalConfig.token_eth_aps,
        crv: globalConfig.crv,
        cvx: globalConfig.cvx,
        booster: globalConfig.booster,
    };

    let admin: Signer;
    let alice: Signer;
    let bob: Signer;
    let feeCollector: Signer;
    let zAPS: Contract;
    let zStable: Contract;
    let strategies = Array<Contract>();
    let rewardManager: Contract;
    let converter: Contract;

    before(async () => {
        [admin, alice, bob, feeCollector] = await ethers.getSigners();

        const zOmnipool: Contract = new ethers.Contract(addrs.ethzunami, zunamiNativeAbi, admin);

        zStable = new ethers.Contract(addrs.zeth, uzdABI, admin);

        const FraxEthNativeConverter = await ethers.getContractFactory('FraxEthNativeConverter');
        converter = await FraxEthNativeConverter.deploy();
        await converter.deployed();

        const RewardManagerFactory = await ethers.getContractFactory('CommissionSellingCurveRewardManagerFrxEth');
        rewardManager = await RewardManagerFactory.deploy(converter.address, zStable.address, feeCollector.getAddress());
        await rewardManager.deployed();

        await mintZEthAmount(admin, zOmnipool, zStable);
    });

    beforeEach(async () => {
        const ZunamiApsFactory = await ethers.getContractFactory('ZunamiNativeAPS');
        zAPS = await ZunamiApsFactory.deploy();
        await zAPS.deployed();

        // Init all strategies
        for (const strategyName of strategyNames) {
            const factory = await ethers.getContractFactory(strategyName);

            let strategy;
            if(strategyName.includes("Vault")) {
                strategy = await factory.deploy(zStable.address);
                await strategy.deployed();
            } else {
                const config = strategyName.includes('VaultAPSStrat')
                  ? configConvexAPS.token
                  : configConvexAPS;

                strategy = await factory.deploy(config);
                await strategy.deployed();

                await strategy.setRewardManager(rewardManager.address);
            }

            await strategy.setZunami(zAPS.address);

            strategies.push(strategy);
        }

        for (const user of [alice, bob]) {
            await zStable.connect(user).approve(zAPS.address, parseUnits('10', 'ether'));

            await zStable.transfer(user.getAddress(), ethers.utils.parseUnits('10', 'ether'));
        }
    });

    afterEach(async () => {
        strategies = [];
    });

    it('should deposit assets in optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zAPS.addPool(strategies[poolId].address);
            await zAPS.setDefaultDepositPid(poolId);
            await zAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                const zStableBefore = await zStable.balanceOf(user.getAddress());

                await expect(zAPS.connect(user).delegateDeposit(getMinAmount()))
                    .to.emit(zAPS, 'CreatedPendingDeposit')
                    .withArgs(await user.getAddress(), getMinAmount());

                expect(zStableBefore).to.gt(await zStable.balanceOf(user.getAddress()));
            }
        }

        for (const user of [alice, bob]) {
            expect(await zAPS.balanceOf(user.getAddress())).to.eq(0);
        }

        await expect(zAPS.completeDeposits([alice.getAddress(), bob.getAddress()])).to.emit(
            zAPS,
            'Deposited'
        );

        for (const user of [alice, bob]) {
            expect(await zAPS.balanceOf(user.getAddress())).to.gt(0);
        }
    });

    it('should deposit assets in not optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zAPS.addPool(strategies[poolId].address);
            await zAPS.setDefaultDepositPid(poolId);
            await zAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                const zStableBefore = await zStable.balanceOf(user.getAddress());
                const zlpBefore = await zAPS.balanceOf(user.getAddress());

                await expect(zAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zAPS,
                    'Deposited'
                );

                expect(await zStable.balanceOf(user.getAddress())).to.lt(zStableBefore);
                expect(await zAPS.balanceOf(user.getAddress())).to.gt(zlpBefore);
            }
        }
    });

    it('should withdraw assets in butch mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zAPS.addPool(strategies[poolId].address);
            await zAPS.setDefaultDepositPid(poolId);
            await zAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zAPS,
                    'Deposited'
                );

                const zlpAmount = BigNumber.from(await zAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(zAPS.connect(user).delegateWithdrawal(zlpAmount, 0))
                    .to.emit(zAPS, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, 0);
            }

            await expect(
                zAPS.completeWithdrawals([alice.getAddress(), bob.getAddress()])
            ).to.emit(zAPS, 'Withdrawn');
        }
    });

    it('should withdraw assets in optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zAPS.addPool(strategies[poolId].address);
            await zAPS.setDefaultDepositPid(poolId);
            await zAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zAPS,
                    'Deposited'
                );

                const zlpAmount = BigNumber.from(await zAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(zAPS.connect(user).delegateWithdrawal(zlpAmount, 0))
                    .to.emit(zAPS, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, 0);
            }

            await expect(
                zAPS.completeWithdrawalsOptimized([alice.getAddress(), bob.getAddress()])
            ).to.emit(zAPS, 'Withdrawn');
        }
    });

    it('should withdraw assets in not optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zAPS.addPool(strategies[poolId].address);
            await zAPS.setDefaultDepositPid(poolId);
            await zAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zAPS,
                    'Deposited'
                );

                let zlpAmount = BigNumber.from(await zAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(
                    zAPS.connect(user).withdraw(zlpAmount, 0)
                ).to.emit(zAPS, 'Withdrawn');
                zlpAmount = BigNumber.from(await zAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);
            }
        }
    });

    it('should withdraw assets in one coin mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zAPS.addPool(strategies[poolId].address);
            await zAPS.setDefaultDepositPid(poolId);
            await zAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zAPS,
                    'Deposited'
                );

                let zlpAmount = BigNumber.from(await zAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(
                    zAPS.connect(user).withdraw(zlpAmount, 0)
                ).to.emit(zAPS, 'Withdrawn');

                zlpAmount = BigNumber.from(await zAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);
            }
        }
    });

    it('should sell all tokens and rewards after autocompaund', async () => {
        for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i];
            await zAPS.addPool(strategy.address);

            await zAPS.setDefaultDepositPid(i);
            await zAPS.setDefaultWithdrawPid(i);

            await expect(zAPS.connect(alice).deposit(getMinAmount())).to.emit(
                zAPS,
                'Deposited'
            );
        }

        await ethers.provider.send('evm_increaseTime', [3600 * 24 * 7]);
        await zAPS.autoCompoundAll();

        let tokens;
        let balance;
        for (let strategy of strategies) {
            if(!strategy.token) {
                continue;
            }
            const config = await strategy.config();
            if(config.rewards) {
                tokens = [await strategy.token(), ...config.rewards]
                    .map((token) => new ethers.Contract(token, erc20ABI, admin));
            } else {
                tokens = [await strategy.token(), config.crv, config.cvx]
                    .map((token) => new ethers.Contract(token, erc20ABI, admin));
            }

            for(let token of tokens) {
                balance = await token.balanceOf(strategy.address);
                expect(balance).to.eq(0);
            }
        }

        //TODO: check commission
    });

    describe("inflate/deflate", function () {
        it("should revert if called by a non-owner", async function () {
            const poolId = 1;
            await expect(strategies[poolId].connect(alice).inflate(100, 100)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(strategies[poolId].connect(alice).deflate(100, 100)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should execute successfully", async function () {
            const poolId = 1;

            const REBALANCER_ROLE = "0xccc64574297998b6c3edf6078cc5e01268465ff116954e3af02ff3a70a730f46";
            const zStableAdmin = new ethers.Contract(addrs.zeth, [
                {"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"}
            ], admin);

            const zunamiAdminAddr = "0xb056B9A45f09b006eC7a69770A65339586231a34";
            await admin.sendTransaction({
                to: zunamiAdminAddr,
                value: ethers.utils.parseEther('1'),
            });
            await network.provider.request({
                method: 'hardhat_impersonateAccount',
                params: [zunamiAdminAddr],
            });
            const zunamiAdminSigner: Signer = ethers.provider.getSigner(zunamiAdminAddr);
            await zStableAdmin
                .connect(zunamiAdminSigner)
                .grantRole(REBALANCER_ROLE, strategies[poolId].address);
            await network.provider.request({
                method: 'hardhat_stopImpersonatingAccount',
                params: [zunamiAdminAddr],
            });

            for (let poolId = 0; poolId < strategies.length; poolId++) {
                await zAPS.addPool(strategies[poolId].address);
            }

            await zAPS.setDefaultDepositPid(poolId);
            await zAPS.setDefaultWithdrawPid(poolId);

            const cvxRewardsAddr = await strategies[poolId].cvxRewards();
            const cvxRewards = new ethers.Contract(cvxRewardsAddr, cvxRewardsAbi, admin);

            const poolAddr = await strategies[poolId].frxEthTokenPool();
            const pool = new ethers.Contract(poolAddr, crvPool2Abi, admin);

            const tokenZEthAddr = await pool.coins(0);
            const tokenZEth = new ethers.Contract(tokenZEthAddr, erc20ABI, admin);
            const tokenFrxETHAddr = await pool.coins(1);
            const tokenFrxETH = new ethers.Contract(tokenFrxETHAddr, erc20ABI, admin);

            const big1e18 = BigNumber.from((1e18).toString());
            const approximation = BigNumber.from(1).mul(big1e18); // slippage less XXX ETH

            const poolZEthBalanceInit = await tokenZEth.balanceOf(poolAddr);
            const poolFrxETHBalanceInit = await tokenFrxETH.balanceOf(poolAddr);

            const zStableAmount = getMinAmount();
            await zStable.connect(alice).approve(zAPS.address, zStableAmount);
            await zAPS.connect(alice).deposit(zStableAmount);

            const poolZEthBalanceBefore = await tokenZEth.balanceOf(poolAddr);
            const poolFrxEthBalanceBefore = await tokenFrxETH.balanceOf(poolAddr);

            expect(poolZEthBalanceBefore.sub(poolZEthBalanceInit)).to.eq(zStableAmount);

            const gaugeBalanceBefore = await cvxRewards.balanceOf(strategies[poolId].address);

            expect(gaugeBalanceBefore).to.gt(0);

            const inflationAmount = zStableAmount.mul(20).div(100);

            const percentage = 20;
            const percentageBig = BigNumber.from((percentage / 100 * 1e18).toString());

            await strategies[poolId].connect(admin).inflate(percentageBig, BigNumber.from(18).mul(1e10).mul(1e6));

            const poolZEthBalanceInflate = await tokenZEth.balanceOf(poolAddr);
            const poolFrxEthBalanceInflate = await tokenFrxETH.balanceOf(poolAddr);

            expect(poolZEthBalanceInflate.sub(poolZEthBalanceBefore)).to.gt(inflationAmount.sub(approximation));
            expect(poolFrxEthBalanceBefore.sub(poolFrxEthBalanceInflate)).to.gt(inflationAmount.sub(approximation));

            const gaugeBalanceAfterInflate = await cvxRewards.balanceOf(strategies[poolId].address);

            expect(gaugeBalanceAfterInflate).to.gt(0);
            expect(gaugeBalanceBefore.sub(gaugeBalanceAfterInflate)).to.lt(approximation);

            await strategies[poolId].connect(admin).deflate(percentageBig,  BigNumber.from(18).mul(1e10).mul(1e6));

            const poolZEthBalanceDeflate = await tokenZEth.balanceOf(poolAddr);
            const poolFrxEthBalanceDeflate = await tokenFrxETH.balanceOf(poolAddr);

            expect(poolZEthBalanceInflate.sub(poolZEthBalanceDeflate)).to.gt(inflationAmount.sub(approximation));
            expect(poolFrxEthBalanceDeflate.sub(poolFrxEthBalanceInflate)).to.gt(inflationAmount.sub(approximation));

            const gaugeBalanceAfterDeflate = await cvxRewards.balanceOf(strategies[poolId].address);

            expect(gaugeBalanceAfterDeflate).to.gt(0);
            expect(gaugeBalanceAfterDeflate.sub(gaugeBalanceAfterInflate)).to.lt(approximation);
        });
    });
});
