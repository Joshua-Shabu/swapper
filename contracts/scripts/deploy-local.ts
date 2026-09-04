import hre from "hardhat";

// This script deploys everything to whichever network you pass via --network,
// e.g. `npx hardhat run scripts/deploy-local.ts --network localhost`
async function main() {
  const { ethers } = await hre.network.create();
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);

  const tokenA = await ethers.deployContract("Token", ["Mini Token A", "MTA", 1_000_000]);
  await tokenA.waitForDeployment();

  const tokenB = await ethers.deployContract("Token", ["Mini Token B", "MTB", 1_000_000]);
  await tokenB.waitForDeployment();

  const factory = await ethers.deployContract("Factory");
  await factory.waitForDeployment();

  const addrA = await tokenA.getAddress();
  const addrB = await tokenB.getAddress();

  const createTx = await factory.createPair(addrA, addrB);
  await createTx.wait();
  const pairAddress = await factory.getPair(addrA, addrB);
  const pair = await ethers.getContractAt("Pair", pairAddress);

  // Seed the pool with some initial liquidity so there's something to see/swap
  // against once the frontend is up.
  const amountA = ethers.parseUnits("10000", 18);
  const amountB = ethers.parseUnits("20000", 18);
  await (await tokenA.transfer(pairAddress, amountA)).wait();
  await (await tokenB.transfer(pairAddress, amountB)).wait();
  await (await pair.mint(deployer.address)).wait();

  console.log("\n--- Deployed addresses (save these!) ---");
  console.log(`Token A: ${addrA}`);
  console.log(`Token B: ${addrB}`);
  console.log(`Factory: ${await factory.getAddress()}`);
  console.log(`Pair:    ${pairAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
