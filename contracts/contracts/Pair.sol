// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Minimal {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/// @title A minimal constant-product AMM pair, modeled on Uniswap V2's core Pair contract.
/// @notice Holds reserves of two ERC-20 tokens and lets anyone swap between them, or
/// deposit/withdraw liquidity. The Pair contract is ALSO an LP token itself: providing
/// liquidity mints you Pair tokens representing your share of the pool — exactly like
/// real Uniswap V2 (this contract is a deliberately simplified version of it: no price
/// oracle accumulation, no flash-swap callback, no fee-on-transfer token handling).
contract Pair {
    // Permanently locked into address(0xdead) on the very first deposit. Without this,
    // the very first liquidity provider could mint a tiny (even 1-wei) amount of LP
    // tokens for a huge deposit, then manipulate the price against later depositors —
    // burning a fixed minimum makes that attack uneconomical.
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    address public token0;
    address public token1;

    uint112 private reserve0;
    uint112 private reserve1;

    // --- Minimal embedded ERC-20 bookkeeping, for the LP shares this contract itself issues ---
    string public constant name = "Mini Uniswap LP";
    string public constant symbol = "MINI-LP";
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Reentrancy guard: blocks a token with malicious callback logic (or any bug) from
    // calling back into this contract mid-operation.
    bool private locked;
    modifier lock() {
        require(!locked, "Pair: LOCKED");
        locked = true;
        _;
        locked = false;
    }

    constructor(address _token0, address _token1) {
        require(_token0 != _token1, "Pair: IDENTICAL_TOKENS");
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1) {
        return (reserve0, reserve1);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "Pair: OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        emit Sync(reserve0, reserve1);
    }

    function _mintLP(address to, uint256 amount) private {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burnLP(address from, uint256 amount) private {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    // Newton's method integer square root — used once, to size the very first LP mint.
    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /// @notice Deposit liquidity. The CALLER must already have transferred token0 and
    /// token1 into this contract before calling mint (real Uniswap has a separate
    /// "Router" contract that does the transfer-then-mint for you atomically — we'll add
    /// that convenience layer later; for now we do it in two steps ourselves).
    function mint(address to) external lock returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        uint256 balance0 = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Minimal(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        if (totalSupply == 0) {
            // First-ever deposit: liquidity = sqrt(amount0 * amount1). Using the geometric
            // mean like this means the INITIAL price you set (amount0/amount1) doesn't
            // bias how many LP tokens you get — only the "value" of what you deposited does.
            liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mintLP(address(0xdead), MINIMUM_LIQUIDITY);
        } else {
            // Subsequent deposits: you get LP tokens proportional to how much you grew the
            // pool, using whichever token gives the more conservative (smaller) answer —
            // this protects existing LPs if you deposit an imbalanced ratio.
            liquidity = _min((amount0 * totalSupply) / _reserve0, (amount1 * totalSupply) / _reserve1);
        }
        require(liquidity > 0, "Pair: INSUFFICIENT_LIQUIDITY_MINTED");
        _mintLP(to, liquidity);

        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    /// @notice Withdraw liquidity. The CALLER must already have transferred their LP
    /// tokens to this contract (i.e. sent them to the pair's own address) before calling burn.
    function burn(address to) external lock returns (uint256 amount0, uint256 amount1) {
        uint256 balance0 = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Minimal(token1).balanceOf(address(this));
        uint256 liquidity = balanceOf[address(this)];

        amount0 = (liquidity * balance0) / totalSupply;
        amount1 = (liquidity * balance1) / totalSupply;
        require(amount0 > 0 && amount1 > 0, "Pair: INSUFFICIENT_LIQUIDITY_BURNED");

        _burnLP(address(this), liquidity);
        IERC20Minimal(token0).transfer(to, amount0);
        IERC20Minimal(token1).transfer(to, amount1);

        balance0 = IERC20Minimal(token0).balanceOf(address(this));
        balance1 = IERC20Minimal(token1).balanceOf(address(this));
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /// @notice The core trade function — this is the entire "engine" of a Uniswap-style DEX.
    /// The CALLER must already have transferred the input token into this contract; you
    /// specify how much of the OUTPUT token you want (normally only one of amount0Out /
    /// amount1Out is nonzero — the other is 0).
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external lock {
        require(amount0Out > 0 || amount1Out > 0, "Pair: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "Pair: INSUFFICIENT_LIQUIDITY");

        if (amount0Out > 0) IERC20Minimal(token0).transfer(to, amount0Out);
        if (amount1Out > 0) IERC20Minimal(token1).transfer(to, amount1Out);

        uint256 balance0 = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Minimal(token1).balanceOf(address(this));

        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "Pair: INSUFFICIENT_INPUT_AMOUNT");

        // The heart of the whole formula: x*y=k must hold AFTER the trade, once a 0.3%
        // fee is taken out of whatever was paid in (997/1000 = 99.7% of the input actually
        // "counts" toward the new balances the invariant is checked against).
        uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
        uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
        require(
            balance0Adjusted * balance1Adjusted >= uint256(_reserve0) * uint256(_reserve1) * 1000 * 1000,
            "Pair: K"
        );

        _update(balance0, balance1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
}
