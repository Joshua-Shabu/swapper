import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();

describe("Factory", function () {
  it("creates a pair, registers it both ways, and sorts token0/token1", async function () {
    const factory = await ethers.deployContract("Factory");

    const tokenA = await ethers.deployContract("Token", ["Token A", "TKA", 1_000_000]);
    const tokenB = await ethers.deployContract("Token", ["Token B", "TKB", 1_000_000]);
    const addrA = await tokenA.getAddress();
    const addrB = await tokenB.getAddress();

    await expect(factory.createPair(addrA, addrB)).to.emit(factory, "PairCreated");

    expect(await factory.allPairsLength()).to.equal(1n);

    // Lookup works in either order
    const pairFromAB = await factory.getPair(addrA, addrB);
    const pairFromBA = await factory.getPair(addrB, addrA);
    expect(pairFromAB).to.equal(pairFromBA);
    expect(pairFromAB).to.not.equal(ethers.ZeroAddress);

    // token0/token1 on the deployed Pair should be sorted (lower address first)
    const pair = await ethers.getContractAt("Pair", pairFromAB);
    const [expectedToken0, expectedToken1] =
      addrA.toLowerCase() < addrB.toLowerCase() ? [addrA, addrB] : [addrB, addrA];
    expect(await pair.token0()).to.equal(expectedToken0);
    expect(await pair.token1()).to.equal(expectedToken1);
  });

  it("won't create the same pair twice, or a pair of a token with itself", async function () {
    const factory = await ethers.deployContract("Factory");
    const tokenA = await ethers.deployContract("Token", ["Token A", "TKA", 1_000_000]);
    const tokenB = await ethers.deployContract("Token", ["Token B", "TKB", 1_000_000]);
    const addrA = await tokenA.getAddress();
    const addrB = await tokenB.getAddress();

    await factory.createPair(addrA, addrB);

    await expect(factory.createPair(addrA, addrB)).to.be.revertedWith("Factory: PAIR_EXISTS");
    await expect(factory.createPair(addrB, addrA)).to.be.revertedWith("Factory: PAIR_EXISTS");
    await expect(factory.createPair(addrA, addrA)).to.be.revertedWith("Factory: IDENTICAL_ADDRESSES");
  });
});
