const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  console.log(`Deploying on: ${network}`);
  console.log("Deploying with account:", deployer.address);

  const NftMembership = await hre.ethers.getContractFactory("NftMembership");

  const name = "Membership Pass";
  const symbol = "PASS";
  const maxSupply = 100;
  const mintPrice = hre.ethers.utils.parseEther("0.05");
  const whitelistMintPrice = hre.ethers.utils.parseEther("0.03");
  const baseURI = "ipfs://YOUR_CID_HERE/";
  const merkleRoot = hre.ethers.constants.HashZero;

  const nft = await NftMembership.deploy(
    name, symbol, maxSupply, mintPrice, whitelistMintPrice, baseURI, merkleRoot
  );
  await nft.deployed();
  console.log("NftMembership deployed to:", nft.address);

  // Write to network-specific deployment file
  const deploymentDir = "deployments";
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir);
  const deployment = { NftMembership: nft.address };
  fs.writeFileSync(
    `${deploymentDir}/${network}.json`,
    JSON.stringify(deployment, null, 2)
  );
  console.log(`Deployment saved to deployments/${network}.json`);

  // Only verify on Sepolia
  if (network === "sepolia") {
    console.log("Waiting for block confirmations...");
    await nft.deployTransaction.wait(5);
    console.log("Verifying on Etherscan...");
    await hre.run("verify:verify", {
      address: nft.address,
      constructorArguments: [
        name, symbol, maxSupply, mintPrice, whitelistMintPrice, baseURI, merkleRoot,
      ],
    });
    console.log("Contract verified!");
  } else {
    console.log("Skipping verification (local network)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});