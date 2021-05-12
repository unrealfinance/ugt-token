import { Contract, ContractFactory } from "ethers";
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");

  // We get the contract to deploy

  const totalSupply = ethers.utils.parseEther("1");

  const UnrealTokenFactory: ContractFactory = await ethers.getContractFactory("UnrealToken");
  const UnrealToken: Contract = await UnrealTokenFactory.deploy(totalSupply);
  await UnrealToken.deployed();

  const TokenVestingFactory: ContractFactory = await ethers.getContractFactory("TokenVesting");
  const TokenVesting: Contract = await TokenVestingFactory.deploy(UnrealToken.address);
  await TokenVesting.deployed();

  console.log("UnrealToken deployed to: ", UnrealToken.address);
  console.log("TokenVesting deployed to: ", TokenVesting.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
