//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import "./interfaces/layerzero/ILayerZeroReceiver.sol";
import "./interfaces/stargate/IStargateReceiver.sol";
import "./interfaces/stargate/IStargateRouter.sol";
import "./interfaces/layerzero/ILayerZeroEndpoint.sol";


contract ZunamiGateway is ERC20, Pausable, AccessControl, ILayerZeroReceiver, IStargateReceiver {
    using SafeERC20 for IERC20Metadata;

    bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

    struct ProcessingDeposits {
        uint256 totalTokenAmount;
        address[] users;
        uint256[] tokenAmounts;
    }

    struct ProcessingWithdrawals {
        uint256 totalLpShares;
        address[] users;
        uint256[] lpSharesAmounts;
    }

    IStargateRouter stargateRouter;
    ILayerZeroEndpoint layerZeroEndpoint;

    uint8 public constant POOL_ASSETS = 3;
    uint8 public constant USDT_TOKEN_ID = 2;

    address public token;
    uint256 public tokenPoolId;

    uint16 public forwarderChainId;
    address public forwarderAddress;
    uint256 public forwarderTokenPoolId;

    mapping(address => uint256) internal _pendingDeposits;
    mapping(uint256 => ProcessingDeposits) internal _processingDeposits;

    mapping(address => uint256) internal _pendingWithdrawals;
    mapping(uint256 => ProcessingWithdrawals) internal _processingWithdrawals;

    event CreatedPendingDeposit(address indexed depositor, uint256 amount);
    event CreatedPendingWithdrawal(
        address indexed withdrawer,
        uint256 lpShares
    );
    event Deposited(address indexed depositor, uint256 tokenAmount, uint256 lpShares);
    event Withdrawn(
        address indexed withdrawer,
        uint256 tokenAmount,
        uint256 lpShares
    );

    event RemovedPendingDeposit(address indexed depositor);
    event RemovedPendingWithdrawal(address indexed depositor);

    event SetForwarderParams(
        uint256 _chainId,
        address _address,
        uint256 _tokenPoolId
    );

    constructor(
        address _token,
        uint256 _tokenPoolId,
        address _stargateRouter,
        address _layerZeroEndpoint
    ) ERC20('Gateway Zunami LP', 'GZLP') {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);

        token = _token;
        tokenPoolId = _tokenPoolId;

        stargateRouter = IStargateRouter(_stargateRouter);
        layerZeroEndpoint = ILayerZeroEndpoint(_layerZeroEndpoint);
    }

    function setForwarderParams(
        uint16 _chainId,
        address _address,
        uint256 _tokenPoolId
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        forwarderChainId = _chainId;
        forwarderAddress = _address;
        forwarderTokenPoolId =  _tokenPoolId;

        emit SetForwarderParams(_chainId, _address, _tokenPoolId);
    }

    function pendingDeposits(address user) external view returns (uint256) {
        return _pendingDeposits[user];
    }

    function pendingWithdrawals(address user) external view returns (uint256) {
        return _pendingWithdrawals[user];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev in this func user sends funds to the contract and then waits for the completion
     * of the transaction for all users
     * @param amounts - array of deposit amounts by user
     */
    function delegateDeposit(uint256[POOL_ASSETS] memory amounts) external whenNotPaused {
        if (amounts[USDT_TOKEN_ID] > 0) {
            IERC20Metadata(token).safeTransferFrom(_msgSender(), address(this), amounts[USDT_TOKEN_ID]);
            _pendingDeposits[_msgSender()] += amounts[USDT_TOKEN_ID];
        }

        emit CreatedPendingDeposit(_msgSender(), amounts[USDT_TOKEN_ID]);
    }

    /**
     * @dev Zunami protocol owner complete all active pending deposits of users
     * @param userList - dev send array of users from pending to complete
     */
    function completeDeposits(address[] memory userList)
    external
    payable
    onlyRole(OPERATOR_ROLE)
    {
        uint256 depositId = block.number;

        uint256 totalTokenAmount = 0;
        uint256[] memory tokenAmounts = new uint256[](userList.length);
        // 1/ clone all deposits with specific stable (USDT or USDC) - copy to separate mapping and remove from official mapping
        for (uint256 i = 0; i < userList.length; i++) {
            address user = userList[i];
            uint256 deposit = _pendingDeposits[user];
            tokenAmounts[i] = deposit;
            require(deposit > 0, "ZunamiGateway: wrong deposit token amount");
            totalTokenAmount += deposit;
            delete _pendingDeposits[user];
        }
        _processingDeposits[depositId] = ProcessingDeposits(totalTokenAmount, userList, tokenAmounts);

        // 2/ send cloned deposits to forwarder by star gate
        // the msg.value is the "fee" that Stargate needs to pay for the cross chain message
        stargateRouter.swap{value:msg.value}(
            forwarderChainId,                       // LayerZero chainId
            tokenPoolId,                            // source pool id
            forwarderTokenPoolId,                   // dest pool id
            payable(msg.sender),                             // refund adddress. extra gas (if any) is returned to this address
            totalTokenAmount,                       // quantity to swap
            totalTokenAmount,                       // the min qty you would accept on the destination
            IStargateRouter.lzTxObj(0, 0, "0x"),     // 0 additional gasLimit increase, 0 airdrop, at 0x address
            abi.encodePacked(forwarderAddress),     // the address to send the tokens to on the destination
            abi.encode(depositId)          // bytes param, if you wish to send additional payload you can abi.encode() them here
        );
    }

    // @notice LayerZero endpoint will invoke this function to deliver the message on the destination
    // @param _srcChainId - the source endpoint identifier
    // @param _srcAddress - the source sending contract address from the source chain
    // @param _nonce - the ordered message nonce
    // @param _payload - the signed payload is the UA bytes has encoded to be sent
    function lzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) external {
        require(_srcChainId == forwarderChainId, "ZunamiGateway: wrong source chain id");
//        require(_srcAddress == forwarderAddress, "ZunamiGateway: wrong source address");

        // 3/ receive ZLP amount on lzReceive method for sent deposits and mint GZLP to each depositer proportionaly deposits
        (uint256 depositId, uint256 totalLpShares) = abi.decode(_payload, (uint256, uint256));
        ProcessingDeposits memory deposits = _processingDeposits[depositId];
        for (uint256 i = 0; i < deposits.users.length; i++) {
            uint256 tokenAmounts = deposits.tokenAmounts[i];
            uint256 lpShares = (totalLpShares * tokenAmounts) / deposits.totalTokenAmount;
            _mint(deposits.users[i], lpShares);

            emit Deposited(deposits.users[i], tokenAmounts, lpShares);
        }
        delete _processingDeposits[depositId];
    }

    /**
     * @dev user remove his active pending deposit
     */
    function removePendingDeposit() external {
        address depositor = _msgSender();
        if (_pendingDeposits[depositor] > 0) {
            IERC20Metadata(token).safeTransfer(
                _msgSender(),
                _pendingDeposits[depositor]
            );
        }
        delete _pendingDeposits[depositor];

        emit RemovedPendingDeposit(depositor);
    }

    function delegateWithdrawal(uint256 lpShares)
        external
        whenNotPaused
    {
        require(lpShares > 0, 'Zunami: lpAmount must be higher 0');

        address userAddr = _msgSender();
        _pendingWithdrawals[userAddr] = lpShares;

        emit CreatedPendingWithdrawal(userAddr, lpShares);
    }

    function completeWithdrawals(address[] memory userList)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(userList.length > 0, 'Zunami: there are no pending withdrawals requests');

        // 1/ clone withdrawals
        uint256 withdrawalId = block.number;

        uint256 totalLpShares = 0;
        uint256[] memory lpSharesAmounts = new uint256[](userList.length);
        // 1/ clone all deposits with specific stable (USDT or USDC) - copy to separate mapping and remove from official mapping
        for (uint256 i = 0; i < userList.length; i++) {
            address user = userList[i];
            uint256 lpShares = _pendingWithdrawals[user];
            lpSharesAmounts[i] = lpShares;
            require(lpShares > 0, "ZunamiGateway: wrong withdrawal token amount");
            totalLpShares += lpShares;
            delete _pendingWithdrawals[user];
        }
        _processingWithdrawals[withdrawalId] = ProcessingWithdrawals(totalLpShares, userList, lpSharesAmounts);

        // 2/ send withdrawal by zero layer request to forwarder with total withdrawing ZLP amount
        bytes memory payload = abi.encode(withdrawalId, totalLpShares);

        // use adapterParams v1 to specify more gas for the destination
        uint16 version = 1;
        uint gasForDestinationLzReceive = 350000;
        bytes memory adapterParams = abi.encodePacked(version, gasForDestinationLzReceive);

        // get the fees we need to pay to LayerZero for message delivery
        (uint messageFee, ) = layerZeroEndpoint.estimateFees(forwarderChainId, address(this), payload, false, adapterParams);
        require(address(this).balance >= messageFee, "address(this).balance < messageFee. fund this contract with more ether");

        layerZeroEndpoint.send{value: messageFee}( // {value: messageFee} will be paid out of this contract!
            forwarderChainId, // destination chainId
            abi.encodePacked(forwarderAddress), // destination address of PingPong contract
            payload, // abi.encode()'ed bytes
            payable(address(this)), // (msg.sender will be this contract) refund address (LayerZero will refund any extra gas back to caller of send()
            address(0x0), // future param, unused for this example
            adapterParams // v1 adapterParams, specify custom destination gas qty
        );
    }

    function sgReceive(
        uint16 _srcChainId,              // the remote chainId sending the tokens
        bytes memory _srcAddress,        // the remote Bridge address
        uint256 _nonce,
        address _token,                  // the token contract on the local chain
        uint256 _amountLD,                // the qty of local _token contract tokens
        bytes memory _payload
    ) external {
        require(_srcChainId == forwarderChainId, "ZunamiGateway: wrong source chain id");
//        require(_srcAddress == forwarderAddress, "ZunamiGateway: wrong source address");

        // 3/ receive USDC or USDT stables by star gate and transfer to customers
        // 4/ burn GZLP and remove cloned mapping
        (uint256 withdrawalId, uint256 totalTokenAmount) = abi.decode(_payload, (uint256, uint256));
        ProcessingWithdrawals memory withdrawals = _processingWithdrawals[withdrawalId];
        for (uint256 i = 0; i < withdrawals.users.length; i++) {
            uint256 lpShares = withdrawals.lpSharesAmounts[i];
            address user = withdrawals.users[i];
            uint256 tokenAmount = (totalTokenAmount * lpShares) / withdrawals.totalLpShares;
            IERC20Metadata(token).safeTransfer(user, tokenAmount);
            _burn(user, lpShares);
            emit Withdrawn(user, tokenAmount, lpShares);
        }

        delete _processingWithdrawals[withdrawalId];
    }

    function removePendingWithdrawal() external {
        delete _pendingWithdrawals[_msgSender()];
        emit RemovedPendingWithdrawal(_msgSender());
    }

    /**
     * @dev governance can withdraw all stuck funds in emergency case
     * @param _token - IERC20Metadata token that should be fully withdraw from Zunami
     */
    function withdrawStuckToken(IERC20Metadata _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 tokenBalance = _token.balanceOf(address(this));
        if (tokenBalance > 0) {
            _token.safeTransfer(_msgSender(), tokenBalance);
        }
    }
}
