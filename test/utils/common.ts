import { ethers } from "hardhat";

export async function increaseBlockTime(seconds: number) {
  return ethers.provider.send("evm_increaseTime", [seconds]);
}

export async function mineOneBlock() {
  return ethers.provider.send("evm_mine", []);
}

export function getUnixTimeStamp(date: any) {
  return (date.getTime() / 1000).toFixed(0);
}
