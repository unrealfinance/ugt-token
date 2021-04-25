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
    const vestedSupply = ethers.utils.parseEther("1080000000");
    const vestingSupply = ethers.utils.parseEther("3230085552");
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

        // add token to vesting contract
        await unrealToken.connect(owner).transfer(unrealTokenVesting.address, vestingSupply);
        
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
        );
        // retrieve vesting Id from events args
        const receipt = await result.wait();
        const vestingId = receipt.events[0].args.vestingId;

        await unrealToken.transfer(unrealTokenVesting.address, amount);
        let balance = await unrealTokenVesting.vestingAmount(
            vestingId
        );
        assert.equal(balance.toString(), amount.toString());

        // "Tokens have not vested yet"
        await assertRevert(
            unrealTokenVesting.release(vestingId),
            "Tokens have not vested yet"
        );
        // Time travel
        let seconds = 60 * 6000;
        await increaseBlockTime(seconds);
        await mineOneBlock();
        // test release
        await unrealTokenVesting.release(vestingId);
        balance = await unrealToken.balanceOf(accounts[1].address);
        assert.equal(balance.toString(), amount.toString());
    });

    it("should test addVesting data", async function() {
        const vestingAmount = await ethers.utils.parseEther("10");
        const beneficiary = accounts[1];
        const block = await ethers.provider.getBlock("latest");
        const blockTime = block.timestamp;
        let time = new Date(blockTime);
        time.setMinutes(time.getMinutes() + 6);
        time = +time;
        let result = await unrealTokenVesting.connect(accounts[0]).addVesting(
            accounts[1].address,
            time.toString(),
            vestingAmount
        );
        // retrieve vesting Id from events args
        const receipt = await result.wait();
        const vestingId = receipt.events[0].args.vestingId;
        assert.equal((await unrealTokenVesting.vestingAmount(vestingId)).toString(), vestingAmount.toString());
        assert.equal((await unrealTokenVesting.releaseTime(vestingId)).toString(), time);
        assert.equal(await unrealTokenVesting.beneficiary(vestingId), beneficiary.address);
    });

    it("Removing a vesting entry with the owner account", async function() {
        let result = await unrealTokenVesting.connect(owner).removeVesting(1);
        const receipt = await result.wait();
        const excessTokens = receipt.events[0].args["2"];
        let balance = await unrealToken.balanceOf(owner.address);
        assert.equal(balance.toString(), vestedSupply.toString()); // initial tokens

        await unrealTokenVesting.connect(owner).retrieveExcessTokens(excessTokens);
        const expectedBalance = excessTokens.add(balance).toString();
        balance = await unrealToken.balanceOf(owner.address);
        assert.equal(balance.toString(), expectedBalance);
    });
    
    it("Removing a vesting entry with a non-owner account", async function() {
        await assertRevert(unrealTokenVesting.connect(accounts[1]).removeVesting(4)); 
    });
  
    it("Trying to remove a non-existent vesting entry", async function() {
        await assertRevert(
          unrealTokenVesting.connect(owner).removeVesting(53),
          "Invalid vesting id"
        )
    });

    it("Trying to release an already released vesting entry", async function() {
        // Time travel
        let seconds = 30 * 86400 * 1000;
        await increaseBlockTime(seconds);
        await mineOneBlock();
        await unrealTokenVesting.connect(owner).release(1);
        await assertRevert(
          unrealTokenVesting.connect(owner).release(1),
          "Vesting already released"
        );
    });

    it("Trying to remove an already removed vesting entry", async function() {
        await unrealTokenVesting.connect(owner).removeVesting(1);
        await assertRevert(
          unrealTokenVesting.connect(owner).removeVesting(1),
          "Vesting already released"
        );
    });

    it("Trying to add a vesting entry from a non-owner account", async function() {
        const amount = ethers.utils.parseEther("10")
        let block = await ethers.provider.getBlock("latest")
        let blockTime = block.timestamp
        let time = new Date(blockTime)
        time.setMinutes(time.getMinutes() + 6)
        time = +time
        await assertRevert(
            unrealTokenVesting.connect(accounts[1]).addVesting(accounts[1].address, time.toString(), amount)
        );
    });
    
    it("should test token vesting for amount greater then balance of vesting contract", async function() {
        const amount = ethers.utils.parseEther((10 ** 11).toString()); // big number then total tokens in vesting
        let block = await ethers.provider.getBlock("latest");
        let blockTime = block.timestamp;
        let time = new Date(blockTime);
        time.setMinutes(time.getMinutes() + 1);
        time = +time;
        let result = await unrealTokenVesting.connect(owner).addVesting(accounts[1].address,
                                                             time.toString(),
                                                             amount);
        
        // retrieve vesting id from events
        const receipt = await result.wait();
        const vestingId = receipt.events[0].args.vestingId;
        // Time travel
        let seconds = 60 * 1000;
        await increaseBlockTime(seconds);
        await mineOneBlock();
  
        //Insufficient balance
        await assertRevert(
            unrealTokenVesting.release(vestingId),
            "Insufficient balance"
        );
        await unrealTokenVesting.connect(owner).removeVesting(vestingId);
    });

    it("Trying to release the tokens associated with existing vesting entry", async function() {
        let amount = await unrealToken.balanceOf(unrealTokenVesting.address);
        await assertRevert(unrealTokenVesting.connect(owner).retrieveExcessTokens(amount));
    });
    
    it("should test token vesting for amount exactly equal to the balance of vesting contract", async function() {
        let p = []
        // Time travel
        let second = 10000 * 1560 * 60
        await increaseBlockTime(second)
        await mineOneBlock()
        // change num_vesting to number of vestings.
        let num_vesting = 1
        // Comment out below code if num_vesting > 1
        // for (let i = 1; i < num_vesting; i++) {
        //   p.push(unrealTokenVesting.release(i));
        // }
        // await Promise.all(p);
        // let balanceOfVesting = await unrealToken.balanceOf(unrealTokenVesting.address);
        // const vestingAmount = await unrealTokenVesting.vestingAmount(num_vesting);
        // assert.equal(balanceOfVesting.toString(), vestingAmount.toString());
        await unrealTokenVesting.release(num_vesting);
        let balanceOfVesting = await unrealToken.balanceOf(unrealTokenVesting.address);
        assert.equal(balanceOfVesting.toString(), "0");
    });
    

});
