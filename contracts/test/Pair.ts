import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();

describe("Pair", function () {
  it("lets you add liquidity and then swap", async function () {
    const [deployer] = await ethers.getSigners();

    // Deploy two tokens to trade between
    const tokenA = await ethers.deployContract("Token", ["Token A", "TKA", 1_000_000]);
    const tokenB = await ethers.deployContract("Token", ["Token B", "TKB", 1_000_000]);

    // Deploy the pair itself
    const pair = await ethers.deployContract("Pair", [
      await tokenA.getAddress(),
      await tokenB.getAddress(),
    ]);
    const pairAddress = await pair.getAddress();

    // --- Add liquidity: 10,000 TKA + 20,000 TKB (an arbitrary starting price of 1 TKA = 2 TKB) ---
    const amountA = ethers.parseUnits("10000", 18);
    const amountB = ethers.parseUnits("20000", 18);

    await tokenA.transfer(pairAddress, amountA);
    await tokenB.transfer(pairAddress, amountB);
    await pair.mint(deployer.address);

    const lpBalance = await pair.balanceOf(deployer.address);
    expect(lpBalance).to.be.gt(0n);

    let [reserveA, reserveB] = await pair.getReserves();
    expect(reserveA).to.equal(amountA);
    expect(reserveB).to.equal(amountB);

    // --- Swap: send 100 TKA in, and expect back exactly what the constant-product
    // formula (with the 0.3% fee) says we should get — computed here independently of
    // the contract, so the test actually proves the contract's math is correct.
    const amountIn = ethers.parseUnits("100", 18);
    const amountInWithFee = (amountIn * 997n) / 1000n;
    const expectedOut = (amountInWithFee * reserveB) / (reserveA + amountInWithFee);

    await tokenA.transfer(pairAddress, amountIn);
    await pair.swap(0, expectedOut, deployer.address);

    [reserveA, reserveB] = await pair.getReserves();
    expect(reserveA).to.equal(amountA + amountIn);
    expect(reserveB).to.equal(amountB - expectedOut);
  });
});
