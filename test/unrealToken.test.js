const { assert } = require("chai");
const { ethers } = require("hardhat");
const { bufferToHex, keccakFromString, ecsign, toBuffer } = require("ethereumjs-util");
const { getPermitHash } = require("./utils/permitUtils");

const privateKey = "0x60df6d3a488272905c7f3892a241b27944400572e68984c3d261ad4c14083604";

async function assertRevert(promise, errorMessage = null) {
  try {
    const tx = await promise;
    const receipt = await ethers.provider.getTransactionReceipt(tx.tx);
    if (receipt.gasUsed >= 6700000) {
      return;
    }
  } catch (error) {
    if (errorMessage) {
      assert(error.message.search(errorMessage) >= 0, `Expected ${errorMessage} `);
    }
    const invalidOpcode = error.message.search("revert") >= 0;
    assert(invalidOpcode, "Expected revert, got '" + error + "' instead");
    return;
  }
  assert.ok(false, 'Error containing "revert" must be returned');
}

describe("UnrealToken", function () {
  let unrealToken;
  let initialBalance = ethers.utils.parseEther("100000000");
  let accounts = [];
  let owner;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    // deploy Token contract
    const UnrealToken = await ethers.getContractFactory("UnrealToken");
    unrealToken = await UnrealToken.deploy(initialBalance);
    await unrealToken.deployed();
  });

  // Setup: totalsupply, permit
  it("returns the total amount of tokens", async function () {
    const total = await unrealToken.totalSupply();
    const balance = await unrealToken.balanceOf(owner.address);
    assert.equal(total.toString(), initialBalance);
    assert.equal(balance.toString(), initialBalance);
  });
  it("returns correct permit hash", async function () {
    assert.equal(
      await unrealToken.PERMIT_TYPEHASH(),
      bufferToHex(
        keccakFromString("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
      ),
    );
  });

  // transfer
  it("should successfully transfer 1 wei", async function () {
    const amount = ethers.utils.parseEther("1");
    await unrealToken.connect(owner).transfer(accounts[1].address, amount);
    const destBalance = await unrealToken.balanceOf(accounts[1].address);
    assert.equal(destBalance.toString(), amount.toString());
  });

  it("should successfully transfer full balance", async function () {
    await unrealToken.connect(owner).transfer(accounts[1].address, initialBalance);
    const destBalance = await unrealToken.balanceOf(accounts[1].address);
    assert.equal(destBalance.toString(), initialBalance.toString());
  });

  it("should fail to transfer amount exceeding balance", async function () {
    const amount = ethers.utils.parseEther("100000001");
    await assertRevert(unrealToken.connect(owner).transfer(accounts[1].address, amount));
  });

  // Rescue funds
  it("Should be able to get accidentally sent tokens back", async function () {
    // deploy USD coin
    const UnrealTokenC = await ethers.getContractFactory("UnrealToken");
    let usdc = await UnrealTokenC.deploy(initialBalance);
    await usdc.deployed();

    const user = accounts[1];
    const amount = ethers.utils.parseEther("100");
    // Transfer 100 usdc to user
    await usdc.transfer(user.address, amount);
    assert.equal((await usdc.balanceOf(user.address)).toString(), amount.toString());
    // User transferred 100 usdc to UnrealToken contract accidentally
    await usdc.connect(user).transfer(unrealToken.address, amount);
    assert.equal((await usdc.balanceOf(unrealToken.address)).toString(), amount.toString());
    assert.equal((await usdc.balanceOf(user.address)).toString(), "0");
    // Rescue user funds
    await unrealToken.connect(owner).rescueTokens(usdc.address, user.address, amount);
    assert.equal((await usdc.balanceOf(user.address)).toString(), amount.toString());
  });
});
