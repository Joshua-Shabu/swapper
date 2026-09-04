// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Pair.sol";

/// @title Deploys and keeps a registry of Pair contracts, modeled on Uniswap V2's Factory.
contract Factory {
    // token0 => token1 => pair address. Tokens are always stored in sorted order (see
    // createPair below), so this only needs to be checked one way once populated —
    // though we still write it both ways so callers can look it up in either order.
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 pairIndex);

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /// @notice Deploy a new Pair for tokenA/tokenB, if one doesn't already exist.
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "Factory: IDENTICAL_ADDRESSES");

        // Sort the two addresses so that (USDC, ETH) and (ETH, USDC) always resolve to
        // the exact same pair — without this, someone could accidentally create two
        // separate pools for the same pair of tokens depending on argument order.
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Factory: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "Factory: PAIR_EXISTS");

        // CREATE2 (via the `salt:` syntax) deploys to an address that's deterministic —
        // computable off-chain from just the two token addresses, before the pair even
        // exists. Real Uniswap relies on this so other contracts can predict a pair's
        // address without needing to ask the Factory first.
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        pair = address(new Pair{salt: salt}(token0, token1));

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length - 1);
    }
}
