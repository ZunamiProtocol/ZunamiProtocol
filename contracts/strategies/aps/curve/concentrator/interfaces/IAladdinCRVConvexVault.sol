//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAladdinCRVConvexVault {
    enum ClaimOption {
        None,
        Claim,
        ClaimAsCvxCRV,
        ClaimAsCRV,
        ClaimAsCVX,
        ClaimAsETH
    }

    /// @notice Return the amount of pending AladdinCRV rewards for specific pool.
    /// @param _pid - The pool id.
    /// @param _account - The address of user.
    function pendingReward(uint256 _pid, address _account) external view returns (uint256);

    /// @notice Return the user share for specific user.
    /// @param _pid The pool id to query.
    /// @param _account The address of user.
    function getUserShare(uint256 _pid, address _account) external view returns (uint256);

    /// @notice Return the total underlying token deposited.
    /// @param _pid The pool id to query.
    function getTotalUnderlying(uint256 _pid) external view returns (uint256);

    /// @notice Return the total pool share deposited.
    /// @param _pid The pool id to query.
    function getTotalShare(uint256 _pid) external view returns (uint256);

    /// @notice Deposit some token to specific pool for someone.
    /// @param _pid The pool id.
    /// @param _recipient The address of recipient who will recieve the token.
    /// @param _amount The amount of token to deposit.
    /// @return share The amount of share after deposit.
    function deposit(
        uint256 _pid,
        address _recipient,
        uint256 _amount
    ) external returns (uint256 share);

    /// @notice Deposit all token of the caller to specific pool for someone.
    /// @param _pid The pool id.
    /// @param _recipient The address of recipient who will recieve the token.
    /// @return share The amount of share after deposit.
    function depositAll(uint256 _pid, address _recipient) external returns (uint256 share);

    /// @notice Withdraw some token from specific pool and claim pending rewards.
    /// @param _pid - The pool id.
    /// @param _shares - The share of token want to withdraw.
    /// @param _minOut - The minimum amount of pending reward to receive.
    /// @param _option - The claim option (don't claim, as aCRV, cvxCRV, CRV, CVX, or ETH)
    /// @return withdrawn - The amount of token sent to caller.
    /// @return claimed - The amount of reward sent to caller.
    function withdrawAndClaim(
        uint256 _pid,
        uint256 _shares,
        uint256 _minOut,
        ClaimOption _option
    ) external returns (uint256, uint256);

    /// @notice Withdraw all share of token from specific pool and claim pending rewards.
    /// @param _pid - The pool id.
    /// @param _minOut - The minimum amount of pending reward to receive.
    /// @param _option - The claim option (as aCRV, cvxCRV, CRV, CVX, or ETH)
    /// @return withdrawn - The amount of token sent to caller.
    /// @return claimed - The amount of reward sent to caller.
    function withdrawAllAndClaim(
        uint256 _pid,
        uint256 _minOut,
        ClaimOption _option
    ) external returns (uint256, uint256);

    /// @notice claim pending rewards from specific pool.
    /// @param _pid - The pool id.
    /// @param _minOut - The minimum amount of pending reward to receive.
    /// @param _option - The claim option (as aCRV, cvxCRV, CRV, CVX, or ETH)
    /// @return claimed - The amount of reward sent to caller.
    function claim(
        uint256 _pid,
        uint256 _minOut,
        ClaimOption _option
    ) external returns (uint256);
}
