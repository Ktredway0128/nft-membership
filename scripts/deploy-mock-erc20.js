const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MockERC20 with account:", deployer.address);

  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy();
  await mockToken.deployed();
  console.log("MockERC20 deployed to:", mockToken.address);

  // Send 500 tokens to the NFT contract
  const deployment = JSON.parse(fs.readFileSync("deployments/local.json"));
  const nftAddress = deployment.NftMembership;
  const amount = hre.ethers.utils.parseUnits("500", 18);

  await mockToken.transfer(nftAddress, amount);
  console.log(`Sent 500 MOCK tokens to NFT contract at ${nftAddress}`);
  console.log("MockERC20 address:", mockToken.address);
  console.log("Use this address in the Recover ERC-20 panel");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});