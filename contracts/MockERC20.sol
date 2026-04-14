// SPDX-License-Identifier: MIT

// ////////////////// /////////
// ////////This is a test contract only, not a part of production deployment, strictly for testing purposes



pragma solidity ^0.8.19;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }
}