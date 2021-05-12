import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deterministic } = deployments;
  const { deployer } = await getNamedAccounts();
  const totalSupply = ethers.utils.parseEther("1");
  const { address: addressUnrealToken, deploy: deployUnrealToken } = await deterministic("UnrealToken", {
    from: deployer,
    args: [totalSupply],
    log: true,
  });

  await deployUnrealToken();

  const { deploy: deployTokenVesting } = await deterministic("TokenVesting", {
    from: deployer,
    args: [addressUnrealToken],
    log: true,
  });

  await deployTokenVesting();
};
export default func;
