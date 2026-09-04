// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title A minimal ERC-20 token, written from scratch (no imported libraries)
/// @notice This intentionally does NOT import OpenZeppelin's ERC-20 — the goal right now
/// is to see exactly what the ERC-20 standard requires under the hood. Once this project
/// has real tooling installed, production code should generally use the audited
/// OpenZeppelin implementation instead of a hand-rolled one like this.
contract Token {
    // --- Standard ERC-20 metadata (not strictly required by the standard, but expected by wallets/apps) ---
    string public name;
    string public symbol;
    uint8 public decimals = 18; // 18 decimals is the convention ETH itself uses

    // --- Core ERC-20 state ---
    uint256 public totalSupply;

    // Every address's token balance
    mapping(address => uint256) public balanceOf;

    // owner => spender => amount the spender is allowed to move on the owner's behalf
    // (this is what lets, e.g., our future AMM contract pull tokens out of your wallet
    // when you approve it to do so)
    mapping(address => mapping(address => uint256)) public allowance;

    // --- Events every ERC-20 must emit, so wallets/explorers/apps can track activity ---
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @param _name Full token name, e.g. "Mini Uniswap Token"
    /// @param _symbol Ticker, e.g. "MINI"
    /// @param _initialSupply Amount to mint to the deployer, in whole tokens (not wei)
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;

        uint256 amount = _initialSupply * (10 ** uint256(decimals));
        totalSupply = amount;
        balanceOf[msg.sender] = amount;

        // Minting is conventionally announced as a Transfer from the zero address
        emit Transfer(address(0), msg.sender, amount);
    }

    /// @notice Move `value` of your own tokens to `to`
    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    /// @notice Allow `spender` to move up to `value` of YOUR tokens later (e.g. so a DEX
    /// contract can pull tokens from you when you swap or add liquidity)
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /// @notice Move `value` tokens from `from` to `to`, spending part of an allowance.
    /// This is what lets a contract you've approved (like our future AMM) move your
    /// tokens without needing your private key.
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "ERC20: transfer exceeds allowance");
        if (allowed != type(uint256).max) {
            // don't burn down an "infinite" approval
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "ERC20: transfer to zero address");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: transfer exceeds balance");

        balanceOf[from] = fromBalance - value;
        balanceOf[to] += value;

        emit Transfer(from, to, value);
    }
}
