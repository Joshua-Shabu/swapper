import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Hardhat Ignition is Hardhat 3's built-in deployment system — it replaces writing
// ad-hoc "deploy.ts" scripts by hand. A module like this declares WHAT to deploy;
// Ignition figures out how to run it, and safely remembers what's already been
// deployed if you re-run it (so you don't accidentally deploy duplicates).
const TokenModule = buildModule("TokenModule", (m) => {
  const token = m.contract("Token", [
    "Mini Uniswap Token", // name
    "MINI", // symbol
    1_000_000, // initial supply, in whole tokens
  ]);

  return { token };
});

export default TokenModule;
