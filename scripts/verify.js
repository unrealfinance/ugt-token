const hre = require("hardhat");
const readline = require("readline-sync");


async function main() {
  const token = readline.question("token address: ");
  const totalSupply = ethers.utils.parseEther("200000000");

  await hre.run("verify:verify", {
    address: token,
    constructorArguments: [
      totalSupply
    ],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });