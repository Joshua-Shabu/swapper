// Addresses from our local deploy (scripts/deploy-local.ts). If you redeploy, these
// will change — Hardhat's local node assigns addresses deterministically based on the
// deployer's nonce, so as long as you deploy the same things in the same order from a
// fresh node, you'll get these same addresses back.
export const TOKEN_A_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const TOKEN_B_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const FACTORY_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
export const PAIR_ADDRESS = "0xcF70CcAd086e02445Dc6eEf13E8b030e8775bC54";

// Minimal ABI fragments — just the functions our frontend actually needs to call.
// (A full ABI is normally generated automatically by Hardhat; we're hand-writing a
// trimmed one here since we're not wiring up that artifact-import pipeline yet.)
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1)",
  "function swap(uint256 amount0Out, uint256 amount1Out, address to)",
  "function mint(address to) returns (uint256 liquidity)",
  "function balanceOf(address) view returns (uint256)",
];
