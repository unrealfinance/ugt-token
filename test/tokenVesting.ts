import { BigNumber, Signer } from "ethers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { increaseBlockTime, mineOneBlock, getUnixTimeStamp } from "./utils/common";
import { ethers } from "hardhat";

chai.use(chaiAsPromised);
const { expect } = chai;

const avg_seconds_in_months = 60 * 60 * 24 * 30.8;
describe("Token Vesting", function () {
  const totalSupply = ethers.utils.parseEther("5000000000");

  let unrealToken: any;
  let TokenVesting: any;
  let accounts: Signer[] = [];
  let owner: Signer;
  let immediateRelease = BigNumber.from("0");
  beforeEach(async function () {
    // Deploy UnrealToken
    accounts = await ethers.getSigners();
    owner = accounts[0];
    const UnrealToken = await ethers.getContractFactory("UnrealToken");
    unrealToken = await UnrealToken.deploy(totalSupply);
    await unrealToken.deployed();

    // deploy Vesting
    const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
    TokenVesting = await TokenVestingFactory.deploy(unrealToken.address);
    await TokenVesting.deployed();

    // add token to vesting contract
    await unrealToken.connect(owner).transfer(TokenVesting.address, totalSupply);
  });

  it("should vest linearly ", async function () {
    const amount1 = await ethers.utils.parseEther("0.00000000000001");
    const amount2 = await ethers.utils.parseEther("0.00000000000001");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    let startTime = new Date(blockTime * 1000);
    let endTime = new Date(blockTime * 1000);
    endTime.setMonth(endTime.getMonth() + 3);

    const startTimeStamp = getUnixTimeStamp(startTime);
    const endTimeStamp = getUnixTimeStamp(endTime);

    const account1 = await accounts[1].getAddress();
    const account2 = await accounts[2].getAddress();
    const dummyCommunity = [account1, account2];
    const dummyAmounts = [amount1, amount2];
    immediateRelease = BigNumber.from("0");

    await TokenVesting.connect(accounts[0]).addVestings(
      dummyCommunity,
      dummyAmounts,
      startTimeStamp.toString(),
      endTimeStamp.toString(),
      immediateRelease,
    );

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(0);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[0])).toNumber() / 1000)).to.be.equal(3);
    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[1])).toNumber() / 1000)).to.be.equal(3);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[0])).toNumber() / 1000)).to.be.equal(6);
    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[1])).toNumber() / 1000)).to.be.equal(6);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();
    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(10000);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(10000);
  });

  it("should not vest until start time ", async function () {
    const amount1 = await ethers.utils.parseEther("0.00000000000001");
    const amount2 = await ethers.utils.parseEther("0.00000000000001");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    let startTime = new Date(blockTime * 1000);
    let endTime = new Date(blockTime * 1000);

    // start after 3 months
    startTime.setMonth(startTime.getMonth() + 3);
    // end after 3 months of start
    endTime.setMonth(startTime.getMonth() + 3);

    const startTimeStamp = getUnixTimeStamp(startTime);
    const endTimeStamp = getUnixTimeStamp(endTime);

    const account1 = await accounts[3].getAddress();
    const account2 = await accounts[4].getAddress();
    const dummyCommunity = [account1, account2];
    const dummyAmounts = [amount1, amount2];
    immediateRelease = BigNumber.from("0");

    await TokenVesting.connect(accounts[0]).addVestings(
      dummyCommunity,
      dummyAmounts,
      startTimeStamp.toString(),
      endTimeStamp.toString(),
      immediateRelease,
    );

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(0);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(0);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(0);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[0])).toNumber() / 1000)).to.be.equal(0);
    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[1])).toNumber() / 1000)).to.be.equal(0);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[0])).toNumber() / 1000)).to.be.equal(3);
    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[1])).toNumber() / 1000)).to.be.equal(3);
  });

  it("should vest with immediate Release", async function () {
    const amount1 = await ethers.utils.parseEther("0.00000000000001");
    const amount2 = await ethers.utils.parseEther("0.00000000000001");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    let startTime = new Date(blockTime * 1000);
    let endTime = new Date(blockTime * 1000);

    endTime.setMonth(startTime.getMonth() + 3);

    const startTimeStamp = getUnixTimeStamp(startTime);
    const endTimeStamp = getUnixTimeStamp(endTime);

    const account1 = await accounts[3].getAddress();
    const account2 = await accounts[4].getAddress();
    const dummyCommunity = [account1, account2];
    const dummyAmounts = [amount1, amount2];
    immediateRelease = BigNumber.from("10");

    await TokenVesting.connect(accounts[0]).addVestings(
      dummyCommunity,
      dummyAmounts,
      startTimeStamp.toString(),
      endTimeStamp.toString(),
      immediateRelease,
    );

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(1000);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(1000);
  });

  it("should be able to claim immediate release and claimable should decrease to 0", async function () {
    const amount1 = await ethers.utils.parseEther("0.00000000000001");
    const amount2 = await ethers.utils.parseEther("0.00000000000001");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    let startTime = new Date(blockTime * 1000);
    let endTime = new Date(blockTime * 1000);

    endTime.setMonth(startTime.getMonth() + 3);

    const startTimeStamp = getUnixTimeStamp(startTime);
    const endTimeStamp = getUnixTimeStamp(endTime);

    const account1 = await accounts[3].getAddress();
    const account2 = await accounts[4].getAddress();
    const dummyCommunity = [account1, account2];
    const dummyAmounts = [amount1, amount2];
    immediateRelease = BigNumber.from("10");

    await TokenVesting.connect(accounts[0]).addVestings(
      dummyCommunity,
      dummyAmounts,
      startTimeStamp.toString(),
      endTimeStamp.toString(),
      immediateRelease,
    );
    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(1000);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(1000);

    await TokenVesting.connect(accounts[3]).claim();
    await TokenVesting.connect(accounts[4]).claim();

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(0);
  });

  it("should be not able to claim more tokens after vesting is over", async function () {
    const amount1 = await ethers.utils.parseEther("0.00000000000001");
    const amount2 = await ethers.utils.parseEther("0.00000000000001");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    let startTime = new Date(blockTime * 1000);
    let endTime = new Date(blockTime * 1000);

    endTime.setMonth(startTime.getMonth() + 3);

    const startTimeStamp = getUnixTimeStamp(startTime);
    const endTimeStamp = getUnixTimeStamp(endTime);

    const account1 = await accounts[3].getAddress();
    const account2 = await accounts[4].getAddress();
    const dummyCommunity = [account1, account2];
    const dummyAmounts = [amount1, amount2];
    immediateRelease = BigNumber.from("0");

    await TokenVesting.connect(accounts[0]).addVestings(
      dummyCommunity,
      dummyAmounts,
      startTimeStamp.toString(),
      endTimeStamp.toString(),
      immediateRelease,
    );

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(0);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[0])).toNumber() / 1000)).to.be.equal(3);
    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[1])).toNumber() / 1000)).to.be.equal(3);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();

    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[0])).toNumber() / 1000)).to.be.equal(6);
    expect(Math.floor((await TokenVesting.claimable(dummyCommunity[1])).toNumber() / 1000)).to.be.equal(6);

    await increaseBlockTime(avg_seconds_in_months);
    await mineOneBlock();
    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(10000);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(10000);

    await TokenVesting.connect(accounts[3]).claim();
    await TokenVesting.connect(accounts[4]).claim();

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(0);
  });

  it("should not able to claim when revoked", async function () {
    const amount1 = await ethers.utils.parseEther("0.00000000000001");
    const amount2 = await ethers.utils.parseEther("0.00000000000001");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    let startTime = new Date(blockTime * 1000);
    let endTime = new Date(blockTime * 1000);

    endTime.setMonth(startTime.getMonth() + 3);

    const startTimeStamp = getUnixTimeStamp(startTime);
    const endTimeStamp = getUnixTimeStamp(endTime);

    const account1 = await accounts[3].getAddress();
    const account2 = await accounts[4].getAddress();
    const dummyCommunity = [account1, account2];
    const dummyAmounts = [amount1, amount2];
    immediateRelease = BigNumber.from("10");

    await TokenVesting.connect(accounts[0]).addVestings(
      dummyCommunity,
      dummyAmounts,
      startTimeStamp.toString(),
      endTimeStamp.toString(),
      immediateRelease,
    );

    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(1000);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(1000);
    // revoke access
    await TokenVesting.connect(accounts[0]).toggleRevoked(dummyCommunity[0]);
    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(1000);
    // give access back
    await TokenVesting.connect(accounts[0]).toggleRevoked(dummyCommunity[0]);
    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(1000);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(1000);

    // revoke access
    await TokenVesting.connect(accounts[0]).toggleRevoked(dummyCommunity[0]);
    expect(await TokenVesting.claimable(dummyCommunity[0])).to.be.equal(0);
    expect(await TokenVesting.claimable(dummyCommunity[1])).to.be.equal(1000);
    await expect(TokenVesting.connect(accounts[3]).claim()).to.be.rejectedWith(Error);
    await TokenVesting.connect(accounts[4]).claim();
  });
});
