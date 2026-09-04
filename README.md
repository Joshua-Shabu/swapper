# Mini Uniswap

A simplified Uniswap V2-style AMM DEX, built from scratch to learn Solidity, smart-contract testing, and full-stack dApp development — inspired by Uniswap Labs' engineering stack.

## What's in here

- **`contracts/`** — Solidity smart contracts (Hardhat 3 project)
  - `Token.sol` — a minimal ERC-20 token
  - `Pair.sol` — constant-product AMM pair (x\*y=k), with LP-token bookkeeping, mint/burn/swap, and a 0.3% swap fee — modeled on Uniswap V2's core Pair contract
  - `Factory.sol` — deploys and tracks Pair contracts via `CREATE2`
  - `test/` — Mocha/TypeScript tests (ethers v6)
  - `scripts/deploy-local.ts` — deploys Token A/B + Factory, creates a pair, and seeds it with initial liquidity
- **`frontend/`** — React + TypeScript + Vite app for connecting a wallet, swapping tokens, and adding liquidity against the deployed contracts

## Status

- [x] ERC-20 token contract
- [x] Constant-product Pair contract (swap, mint, burn)
- [x] Factory contract
- [x] Unit tests passing
- [x] Deployed to a local Hardhat network
- [x] Frontend: wallet connect, swap, add liquidity — all working end-to-end against the local deployment
- [ ] Deploy to a public testnet (Sepolia)
- [ ] Deploy frontend

## Running it locally

```bash
# 1. Start a local chain
cd contracts
npx hardhat node

# 2. In a second terminal, deploy the contracts
cd contracts
npx hardhat run scripts/deploy-local.ts --network localhost

# 3. Run the contract tests
npx hardhat test mocha

# 4. In a third terminal, start the frontend
cd frontend
npm run dev
```

Then connect MetaMask to `http://127.0.0.1:8545` (chain ID `31337`) using one of the local accounts Hardhat prints out.

## Built with

Solidity, Hardhat 3, ethers.js v6, React, TypeScript, Vite
