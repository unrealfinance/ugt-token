const { assert } = require("chai");
const { ethers } = require("hardhat");


async function increaseBlockTime(seconds) {
    return ethers.provider.send("evm_increaseTime", [seconds])
}

async function mineOneBlock() {
    return ethers.provider.send("evm_mine")
}

async function assertRevert(promise, errorMessage = null) {
    try {
        const tx = await promise
        const receipt = await ethers.provider.getTransactionReceipt(tx.tx)
        if (receipt.gasUsed >= 6700000) {
            return
        }
    } catch (error) {
        if (errorMessage) {
            assert(
                error.message.search(errorMessage) >= 0,
                `Expected ${errorMessage} `
            )
        }
        const invalidOpcode = error.message.search("revert") >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        return
    }
    assert.ok(false, 'Error containing "revert" must be returned')
}


describe("UnrealToken Vesting", function (){
    const vestedSupply = ethers.utils.parseEther("1080000");
    const vestingSupply = ethers.utils.parseEther("8920000");
    const totalSupply = vestedSupply.add(vestingSupply);
    let unrealToken;
    let unrealTokenVesting;
    let accounts = [];
    let owner;
    beforeEach(async function() {
        // Deploy UnrealToken
        accounts = await ethers.getSigners();
        owner = accounts[0];
        const UnrealToken = await ethers.getContractFactory("UnrealToken");
        unrealToken = await UnrealToken.deploy(totalSupply);
        await unrealToken.deployed();
        
        // deploy Vesting
        const UnrealTokenVesting = await ethers.getContractFactory("UnrealTokenVesting");
        unrealTokenVesting = await UnrealTokenVesting.deploy(unrealToken.address);
        await unrealTokenVesting.deployed();
        
    });
    
    it("should test token vesting for userX", async function(){
        const amount = await ethers.utils.parseEther("10");
        let block = await ethers.provider.getBlock("latest");
        let blockTime = block.timestamp;
        let time = new Date(blockTime);
        time.setMinutes(time.getMinutes() + 6);
        time = +time;
        let result = await unrealTokenVesting.connect(accounts[0]).addVesting(
            accounts[1].address,
            time.toString(),
            amount
        )
        // retrieve vesting Id from events args
        const receipt = await result.wait();
        const vestingId = receipt.events[0].args.vestingId;

        await unrealToken.transfer(unrealTokenVesting.address, amount)
        let balance = await unrealTokenVesting.vestingAmount(
            vestingId
        )
        assert.equal(balance.toString(), amount.toString())

        // "Tokens have not vested yet"
        await assertRevert(
            unrealTokenVesting.release(vestingId),
            "Tokens have not vested yet"
        )
        // Time travel
        let seconds = 60 * 6000;
        await increaseBlockTime(seconds);
        await mineOneBlock();
        // test release
        await unrealTokenVesting.release(vestingId);
        balance = await unrealToken.balanceOf(accounts[1].address)
        assert.equal(balance.toString(), amount.toString())
    });

    it("should test addVesting data", async function() {
        const vestingAmount = await ethers.utils.parseEther("10");
        const beneficiary = accounts[1]
        const block = await ethers.provider.getBlock("latest");
        const blockTime = block.timestamp
        let time = new Date(blockTime)
        time.setMinutes(time.getMinutes() + 6)
        time = +time
        let result = await unrealTokenVesting.connect(accounts[0]).addVesting(
            accounts[1].address,
            time.toString(),
            vestingAmount
        )
        // retrieve vesting Id from events args
        const receipt = await result.wait();
        const vestingId = receipt.events[0].args.vestingId;

        assert.equal((await unrealTokenVesting.vestingAmount(vestingId)).toString(), vestingAmount.toString());
        assert.equal((await unrealTokenVesting.releaseTime(vestingId)).toString(), time);
        assert.equal(await unrealTokenVesting.beneficiary(vestingId), beneficiary.address);
    });

    


});
