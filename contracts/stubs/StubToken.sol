// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract StubToken is ERC20Burnable {
    uint8 immutable private decimal_;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimal
    ) ERC20(_name, _symbol) {
        decimal_ = (_decimal > 0) ? _decimal : 18;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return decimal_;
    }
}
